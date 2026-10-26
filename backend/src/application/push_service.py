import base64
import json
import logging
import os
import time
from typing import Optional
from urllib.parse import urlparse

import http_ece
import httpx
import jwt
from cryptography.hazmat.primitives.asymmetric import ec

from src.application.interfaces import IPushSubscriptionRepository
from src.core.config import settings

logger = logging.getLogger(__name__)


class PushService:
    def __init__(self, repository: IPushSubscriptionRepository):
        self.repository = repository
        self.public_key = settings.vapid_public_key
        self.private_key = settings.vapid_private_key
        self.subject = settings.vapid_subject

    def _b64_decode(self, data: str) -> bytes:
        """Safely decodes Base64 or Base64URL strings with proper padding."""
        cleaned = data.strip().replace('"', "").replace("'", "").rstrip("=")
        padding = (4 - len(cleaned) % 4) % 4
        return base64.urlsafe_b64decode(cleaned + ("=" * padding))

    def _get_private_key_obj(self):
        """Reconstructs the EC Private Key object securely."""
        key_bytes = self._b64_decode(self.private_key)
        return ec.derive_private_key(int.from_bytes(key_bytes, "big"), ec.SECP256R1())

    def send_notification(
        self,
        user_id: int,
        title: str,
        body: str,
        data: Optional[dict] = None,
        urgency: str = "normal",
    ):
        """
        Sends a push notification using RFC 8292 VAPID signing and RFC 8291 aes128gcm encryption.
        'urgency' can be: very-low, low, normal, high.
        """
        results = []
        subscriptions = self.repository.get_all_for_user(user_id)
        if not subscriptions:
            return [{"error": "No subscriptions"}]

        try:
            priv_key_obj = self._get_private_key_obj()
        except Exception as e:
            logger.error(f"VAPID Private Key Error for user {user_id}: {e}")
            return [{"error": f"Key Error: {str(e)}"}]

        clean_pub_key = (
            self.public_key.strip().replace('"', "").replace("'", "").rstrip("=")
        )

        payload_content = {
            "title": title,
            "body": body,
            "icon": "/pwa-192x192.png",
            "badge": "/pwa-192x192.png",
            "data": data or {},
        }
        payload_bytes = json.dumps(payload_content).encode("utf-8")

        with httpx.Client(timeout=10.0) as client:
            for sub in subscriptions:
                try:
                    # 1. RFC 8292 VAPID Token
                    parsed_url = urlparse(sub.endpoint)
                    audience = f"{parsed_url.scheme}://{parsed_url.netloc}"
                    claims = {
                        "sub": self.subject,
                        "aud": audience,
                        "exp": int(time.time()) + 43200,
                    }
                    vapid_token = jwt.encode(claims, priv_key_obj, algorithm="ES256")
                    if isinstance(vapid_token, bytes):
                        vapid_token = vapid_token.decode("utf-8")
                    vapid_token = vapid_token.rstrip("=")

                    headers = {
                        "Authorization": f"vapid t={vapid_token}, k={clean_pub_key}",
                        "TTL": "86400",
                        "Content-Type": "application/octet-stream",
                        "Content-Encoding": "aes128gcm",
                        "Urgency": urgency,  # CRITICAL for Android Doze background delivery
                    }

                    # 2. Manual Encryption using http_ece (RFC 8291 aes128gcm)
                    user_p256dh = self._b64_decode(sub.p256dh)
                    user_auth = self._b64_decode(sub.auth)

                    salt = os.urandom(16)
                    srv_priv = ec.generate_private_key(ec.SECP256R1())

                    encrypted_body = http_ece.encrypt(
                        payload_bytes,
                        salt=salt,
                        private_key=srv_priv,
                        dh=user_p256dh,
                        auth_secret=user_auth,
                        version="aes128gcm",
                    )

                    # 3. Direct HTTP Post
                    resp = client.post(
                        sub.endpoint,
                        content=encrypted_body,
                        headers=headers,
                    )

                    if resp.status_code in [201, 202]:
                        results.append({"status": "sent"})
                    else:
                        logger.warning(
                            f"Push notification failed for user {user_id} "
                            f"(HTTP {resp.status_code}): {resp.text[:120]}"
                        )
                        results.append({"error": f"HTTP {resp.status_code}"})
                        if resp.status_code in [404, 410]:
                            self.repository.delete_by_endpoint(sub.endpoint)

                except Exception as e:
                    logger.error(
                        f"Push delivery exception for user {user_id}: {type(e).__name__}: {e}"
                    )
                    results.append({"error": f"{type(e).__name__}: {str(e)}"})

        return results

    def get_public_key(self) -> str:
        return self.public_key
