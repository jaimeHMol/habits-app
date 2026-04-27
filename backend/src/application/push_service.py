import json
import logging
from typing import Optional
from pywebpush import webpush, WebPushException
from src.core.config import settings
from src.application.interfaces import IPushSubscriptionRepository

logger = logging.getLogger(__name__)


class PushService:
    def __init__(self, repository: IPushSubscriptionRepository):
        self.repository = repository
        self.public_key = settings.vapid_public_key
        self.private_key = settings.vapid_private_key
        self.subject = settings.vapid_subject

    def _get_formatted_private_key(self):
        """
        Pywebpush expects the private key as a base64 encoded string.
        However, it needs correct padding to avoid decoding errors.
        """
        try:
            key = self.private_key.strip()
            # Ensure it's a string, not bytes
            if isinstance(key, bytes):
                key = key.decode("utf-8")

            # Remove any existing padding and re-add it correctly
            key = key.rstrip("=")
            padding = len(key) % 4
            if padding:
                key += "=" * (4 - padding)
            return key
        except Exception as e:
            logger.error(f"Failed to format private key: {e}")
            return self.private_key

    def send_notification(
        self, user_id: int, title: str, body: str, data: Optional[dict] = None
    ):
        """
        Sends a push notification to all subscriptions of a user.
        Returns a list of results for debugging.
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

        # Get correctly formatted private key string
        private_key_ready = self._get_formatted_private_key()

        for sub in subscriptions:
            try:
                subscription_info = {
                    "endpoint": sub.endpoint,
                    "keys": {"p256dh": sub.p256dh, "auth": sub.auth},
                }

                webpush(
                    subscription_info=subscription_info,
                    data=json.dumps(payload),
                    vapid_private_key=private_key_ready,
                    vapid_claims={"sub": self.subject},
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
