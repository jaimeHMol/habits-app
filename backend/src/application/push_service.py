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

    def _get_private_key_obj(self):
        """Reconstructs the EC Private Key object securely."""
        key_str = self.private_key.strip().replace('"', "").replace("'", "")
        padding = len(key_str) % 4
        if padding:
            key_str += "=" * (4 - padding)
        key_bytes = base64.urlsafe_b64decode(key_str)
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
        Sends a push notification using manual VAPID signing and manual encryption.
        'urgency' can be: very-low, low, normal, high.
        """
        results = []
        subscriptions = self.repository.get_all_for_user(user_id)
        if not subscriptions:
            return [{"error": "No subscriptions"}]

        try:
            priv_key_obj = self._get_private_key_obj()
        except Exception as e:
            return [{"error": f"Key Error: {str(e)}"}]

        payload_content = {
            "title": title,
            "body": body,
            "icon": "/pwa-192x192.png",
            "badge": "/pwa-192x192.png",
            "data": data or {},
        }
        payload_bytes = json.dumps(payload_content).encode("utf-8")

        for sub in subscriptions:
            try:
                # 1. Manual VAPID Token
                parsed_url = urlparse(sub.endpoint)
                audience = f"{parsed_url.scheme}://{parsed_url.netloc}"
                claims = {
                    "sub": self.subject,
                    "aud": audience,
                    "exp": int(time.time()) + 43200,
                }
                vapid_token = jwt.encode(claims, priv_key_obj, algorithm="ES256")

                headers = {
                    "Authorization": f"WebPush {vapid_token}",
                    "Crypto-Key": f"p256ecdsa={self.public_key.strip()}",
                    "TTL": "86400",
                    "Content-Encoding": "aes128gcm",
                    "Urgency": urgency,  # CRITICAL for background delivery
                }

                # 2. Manual Encryption using http_ece
                user_p256dh = base64.urlsafe_b64decode(
                    sub.p256dh + "===="[: len(sub.p256dh) % 4]
                )
                user_auth = base64.urlsafe_b64decode(
                    sub.auth + "===="[: len(sub.auth) % 4]
                )

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
                with httpx.Client() as client:
                    resp = client.post(
                        sub.endpoint,
                        content=encrypted_body,
                        headers=headers,
                        timeout=15.0,
                    )

                    if resp.status_code in [201, 202]:
                        results.append({"status": "sent"})
                    else:
                        results.append({"error": f"HTTP {resp.status_code}"})
                        if resp.status_code in [404, 410]:
                            self.repository.delete_by_endpoint(sub.endpoint)

            except Exception as e:
                results.append({"error": f"{type(e).__name__}: {str(e)}"})

        return results

    def get_public_key(self) -> str:
        return self.public_key
