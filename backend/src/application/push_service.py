import base64
import json
import logging
import time
from typing import Optional
from urllib.parse import urlparse

import httpx
import jwt
import pywebpush
from cryptography.hazmat.primitives.asymmetric import ec
from pywebpush import WebPusher

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
        self, user_id: int, title: str, body: str, data: Optional[dict] = None
    ):
        """Sends notification using manual VAPID signing and fixed encryption."""
        results = []
        subscriptions = self.repository.get_all_for_user(user_id)
        if not subscriptions:
            return [{"error": "No subscriptions"}]

        # 1. Pre-generate VAPID key object
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
                parsed_url = urlparse(sub.endpoint)
                audience = f"{parsed_url.scheme}://{parsed_url.netloc}"

                # Manual VAPID Token via PyJWT
                claims = {
                    "sub": self.subject,
                    "aud": audience,
                    "exp": int(time.time()) + 43200,
                }
                vapid_token = jwt.encode(claims, priv_key_obj, algorithm="ES256")

                headers = {
                    "Authorization": f"WebPush {vapid_token}",
                    "Crypto-Key": f"p256ecdsa={self.public_key.strip()}",
                    "Content-Encoding": "aes128gcm",
                    "TTL": "86400",
                }

                # We use WebPusher just to get the encrypted body
                pusher = WebPusher(
                    {
                        "endpoint": sub.endpoint,
                        "keys": {"p256dh": sub.p256dh, "auth": sub.auth},
                    }
                )

                # --- THE CRITICAL PATCH ---
                # This fixes the 'curve must be an EllipticCurve instance' error
                # by forcing the library to use the exact same class reference as cryptography
                original_curve = pywebpush.ec.SECP256R1
                pywebpush.ec.SECP256R1 = lambda: ec.SECP256R1()

                try:
                    # pusher._encode_data handles AES128GCM encryption
                    # If this succeeds, it returns a byte string.
                    encrypted_body = pusher._encode_data(payload_bytes, "aes128gcm")

                    # Perform manual HTTP request to bypass library bugs
                    with httpx.Client() as client:
                        response = client.post(
                            sub.endpoint,
                            content=encrypted_body,
                            headers=headers,
                            timeout=15.0,
                        )

                        if response.status_code in [201, 202]:
                            results.append({"status": "sent"})
                        else:
                            error_text = response.text[:100]
                            results.append(
                                {"error": f"HTTP {response.status_code}: {error_text}"}
                            )
                            if response.status_code in [404, 410]:
                                self.repository.delete_by_endpoint(sub.endpoint)
                finally:
                    # Restore the original library state
                    pywebpush.ec.SECP256R1 = original_curve

            except Exception as e:
                results.append({"error": f"{type(e).__name__}: {str(e)}"})

        return results

    def get_public_key(self) -> str:
        return self.public_key
