import base64
import json
import logging
import time
from typing import Optional
from urllib.parse import urlparse

import jwt
from cryptography.hazmat.primitives.asymmetric import ec
from pywebpush import WebPushException, webpush

from src.application.interfaces import IPushSubscriptionRepository
from src.core.config import settings

logger = logging.getLogger(__name__)


class PushService:
    def __init__(self, repository: IPushSubscriptionRepository):
        self.repository = repository
        self.public_key = settings.vapid_public_key
        self.private_key = settings.vapid_private_key
        self.subject = settings.vapid_subject

    def _generate_manual_vapid_headers(self, endpoint):
        """
        Gathers the VAPID headers manually using PyJWT.
        This bypasses pywebpush and py-vapid completely for the VAPID part.
        """
        try:
            # 1. Reconstruct the EC Private Key from base64
            key_str = self.private_key.strip().replace('"', "").replace("'", "")
            padding = len(key_str) % 4
            if padding:
                key_str += "=" * (4 - padding)
            private_key_bytes = base64.urlsafe_b64decode(key_str)

            # Create the private key object
            priv_key_obj = ec.derive_private_key(
                int.from_bytes(private_key_bytes, "big"), ec.SECP256R1()
            )

            # 2. Prepare JWT Claims
            parsed_url = urlparse(endpoint)
            audience = f"{parsed_url.scheme}://{parsed_url.netloc}"

            claims = {
                "sub": self.subject,
                "aud": audience,
                "exp": int(time.time()) + 43200,  # 12 hours
            }

            # 3. Sign JWT using ES256 (The VAPID standard)
            token = jwt.encode(claims, priv_key_obj, algorithm="ES256")

            # 4. Construct Headers
            # We provide BOTH formats (modern and legacy) for maximum compatibility with FCM and Mozilla
            return {
                "Authorization": f"WebPush {token}",
                "Crypto-Key": f"p256ecdsa={self.public_key.strip()}",
            }
        except Exception as e:
            logger.error(f"Manual VAPID Header Generation failed: {e}")
            return None

    def send_notification(
        self, user_id: int, title: str, body: str, data: Optional[dict] = None
    ):
        """
        Sends a push notification using manually signed headers.
        """
        results = []
        if not self.private_key or not self.public_key:
            return [{"error": "VAPID keys not configured"}]

        subscriptions = self.repository.get_all_for_user(user_id)
        if not subscriptions:
            return [{"error": "No subscriptions found"}]

        payload = {
            "title": title,
            "body": body,
            "icon": "/pwa-192x192.png",
            "badge": "/pwa-192x192.png",
            "data": data or {},
        }

        for sub in subscriptions:
            try:
                # Generate headers for THIS endpoint
                vapid_headers = self._generate_manual_vapid_headers(sub.endpoint)
                if not vapid_headers:
                    results.append({"error": "Failed to sign VAPID token"})
                    continue

                subscription_info = {
                    "endpoint": sub.endpoint,
                    "keys": {"p256dh": sub.p256dh, "auth": sub.auth},
                }

                # CRITICAL: We pass the headers to the 'headers' argument via **kwargs.
                # We set vapid_private_key to None so the library doesn't try to parse it.
                webpush(
                    subscription_info=subscription_info,
                    data=json.dumps(payload),
                    vapid_private_key=None,
                    headers=vapid_headers,
                )
                results.append({"endpoint": sub.endpoint[:20], "status": "sent"})
            except WebPushException as ex:
                results.append({"endpoint": sub.endpoint[:20], "error": str(ex)})
                if ex.response and ex.response.status_code in [404, 410]:
                    self.repository.delete_by_endpoint(sub.endpoint)
            except Exception as e:
                # This will catch any other error and show the exact message in the alert
                results.append({"error": f"{type(e).__name__}: {str(e)}"})

        return results

    def get_public_key(self) -> str:
        return self.public_key
