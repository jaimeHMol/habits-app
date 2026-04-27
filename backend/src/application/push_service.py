import base64
import json
import logging
import time
from typing import Optional

from cryptography.hazmat.primitives.asymmetric import ec
from pywebpush import WebPushException, webpush
import jwt  # Usaremos PyJWT que ya está en tus requirements

from src.application.interfaces import IPushSubscriptionRepository
from src.core.config import settings

logger = logging.getLogger(__name__)


class PushService:
    def __init__(self, repository: IPushSubscriptionRepository):
        self.repository = repository
        self.public_key = settings.vapid_public_key
        self.private_key = settings.vapid_private_key
        self.subject = settings.vapid_subject

    def _generate_vapid_headers(self, endpoint):
        """
        Manually generates VAPID headers using PyJWT.
        This bypasses ALL the buggy logic in pywebpush and py-vapid.
        """
        try:
            # 1. Reconstruct the Private Key Object
            key_str = self.private_key.strip().replace('"', "").replace("'", "")
            padding = len(key_str) % 4
            if padding: key_str += "=" * (4 - padding)
            private_key_bytes = base64.urlsafe_b64decode(key_str)
            
            priv_key_obj = ec.derive_private_key(
                int.from_bytes(private_key_bytes, "big"), ec.SECP256R1()
            )

            # 2. Create the Claims
            # The 'aud' must be the origin of the push service
            from urllib.parse import urlparse
            parsed_url = urlparse(endpoint)
            audience = f"{parsed_url.scheme}://{parsed_url.netloc}"

            claims = {
                "sub": self.subject,
                "aud": audience,
                "exp": int(time.time()) + 43200  # 12 hours
            }

            # 3. Sign the JWT manually
            token = jwt.encode(claims, priv_key_obj, algorithm="ES256")

            # 4. Return the headers in the format pywebpush expects for 'vapid_headers'
            return {
                "Authorization": f"WebPush {token}",
                "Crypto-Key": f"p256ecdsa={self.public_key.strip()}"
            }
        except Exception as e:
            logger.error(f"Manual VAPID generation failed: {e}")
            return None

    def send_notification(
        self, user_id: int, title: str, body: str, data: Optional[dict] = None
    ):
        """
        Sends a push notification using manually generated VAPID headers.
        """
        results = []
        if not self.private_key or not self.public_key:
            return [{"error": "VAPID keys not configured"}]

        subscriptions = self.repository.get_all_for_user(user_id)
        if not subscriptions:
            return [{"error": "No subscriptions found for user"}]

        payload = {
            "title": title,
            "body": body,
            "icon": "/pwa-192x192.png",
            "badge": "/pwa-192x192.png",
            "data": data or {},
        }

        for sub in subscriptions:
            try:
                # Generate headers for THIS specific endpoint
                vapid_headers = self._generate_vapid_headers(sub.endpoint)
                
                if not vapid_headers:
                    results.append({"error": "Failed to generate manual VAPID headers"})
                    continue

                subscription_info = {
                    "endpoint": sub.endpoint,
                    "keys": {"p256dh": sub.p256dh, "auth": sub.auth},
                }

                # We pass 'vapid_headers' instead of 'vapid_private_key'.
                # This tells pywebpush: "Don't touch the keys, just use these headers".
                webpush(
                    subscription_info=subscription_info,
                    data=json.dumps(payload),
                    vapid_headers=vapid_headers
                )
                results.append({"endpoint": sub.endpoint[:20], "status": "sent"})
            except WebPushException as ex:
                results.append({"endpoint": sub.endpoint[:20], "error": str(ex)})
                if ex.response and ex.response.status_code in [404, 410]:
                    self.repository.delete_by_endpoint(sub.endpoint)
            except Exception as e:
                results.append({"error": str(e)})

        return results

    def get_public_key(self) -> str:
        return self.public_key
