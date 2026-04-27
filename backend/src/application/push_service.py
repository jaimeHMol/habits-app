import base64
import json
import logging
import time
from typing import Optional
from urllib.parse import urlparse

from cryptography.hazmat.primitives.asymmetric import ec
from pywebpush import WebPusher, WebPushException
import jwt

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
        Manually generates VAPID headers using PyJWT to bypass library bugs.
        """
        try:
            key_str = self.private_key.strip().replace('"', "").replace("'", "")
            padding = len(key_str) % 4
            if padding:
                key_str += "=" * (4 - padding)
            private_key_bytes = base64.urlsafe_b64decode(key_str)

            priv_key_obj = ec.derive_private_key(
                int.from_bytes(private_key_bytes, "big"), ec.SECP256R1()
            )

            parsed_url = urlparse(endpoint)
            audience = f"{parsed_url.scheme}://{parsed_url.netloc}"

            claims = {
                "sub": self.subject,
                "aud": audience,
                "exp": int(time.time()) + 43200,
            }

            token = jwt.encode(claims, priv_key_obj, algorithm="ES256")

            return {
                "Authorization": f"WebPush {token}",
                "Crypto-Key": f"p256ecdsa={self.public_key.strip()}",
            }
        except Exception as e:
            logger.error(f"VAPID Header Gen Failed: {e}")
            return None

    def send_notification(
        self, user_id: int, title: str, body: str, data: Optional[dict] = None
    ):
        """
        Sends a push notification using WebPusher and manual headers.
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
                vapid_headers = self._generate_vapid_headers(sub.endpoint)
                if not vapid_headers:
                    results.append({"error": "Header generation failed"})
                    continue

                subscription_info = {
                    "endpoint": sub.endpoint,
                    "keys": {"p256dh": sub.p256dh, "auth": sub.auth},
                }

                # We use WebPusher directly, which allows passing headers manually
                pusher = WebPusher(subscription_info)
                pusher.send(data=json.dumps(payload), vapid_headers=vapid_headers)

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
