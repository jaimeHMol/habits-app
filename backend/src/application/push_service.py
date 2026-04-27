import json
import logging
from typing import Optional

from pywebpush import WebPushException, webpush
from py_vapid import Vapid

from src.application.interfaces import IPushSubscriptionRepository
from src.core.config import settings

logger = logging.getLogger(__name__)


class PushService:
    def __init__(self, repository: IPushSubscriptionRepository):
        self.repository = repository
        self.public_key = settings.vapid_public_key
        self.private_key = settings.vapid_private_key
        self.subject = settings.vapid_subject
        self._vapid_instance = None

    def _get_vapid_instance(self):
        """
        Creates a Vapid instance from the Base64 private key.
        This uses the official 'from_string' method which handles raw base64.
        """
        if self._vapid_instance:
            return self._vapid_instance

        try:
            key_str = self.private_key.strip()
            # Ensure correct padding for base64
            padding = len(key_str) % 4
            if padding:
                key_str += "=" * (4 - padding)

            # Reconstruct Vapid object from the base64 string
            vapid = Vapid.from_string(key_str)
            self._vapid_instance = vapid
            return vapid
        except Exception as e:
            logger.error(f"Failed to load VAPID key: {e}")
            return None

    def send_notification(
        self, user_id: int, title: str, body: str, data: Optional[dict] = None
    ):
        """
        Sends a push notification to all subscriptions of a user.
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

        # Initialize the Vapid object
        vapid = self._get_vapid_instance()
        if not vapid:
            return [{"error": "Internal error: Could not initialize VAPID"}]

        for sub in subscriptions:
            try:
                subscription_info = {
                    "endpoint": sub.endpoint,
                    "keys": {"p256dh": sub.p256dh, "auth": sub.auth},
                }

                # Passing the Vapid object directly is the most stable method
                webpush(
                    subscription_info=subscription_info,
                    data=json.dumps(payload),
                    vapid_private_key=vapid,
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
