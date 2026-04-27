import base64
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
        Creates and caches a Vapid instance directly from raw bytes.
        This bypasses all PEM/String/File parsing issues.
        """
        if self._vapid_instance:
            return self._vapid_instance

        try:
            # 1. Prepare raw bytes from base64
            key_str = self.private_key.strip()
            padding = len(key_str) % 4
            if padding:
                key_str += "=" * (4 - padding)
            private_key_bytes = base64.urlsafe_b64decode(key_str)

            # 2. Create Vapid instance using the internal from_raw method
            # This is the most direct way supported by py-vapid
            vapid = Vapid()
            # Internally py-vapid uses the 32 bytes of the private key
            vapid.private_key = vapid._private_key_from_bytes(private_key_bytes)
            self._vapid_instance = vapid
            return vapid
        except Exception as e:
            logger.error(f"Failed to create Vapid instance: {e}")
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

        # Get the initialized Vapid instance
        vapid = self._get_vapid_instance()

        for sub in subscriptions:
            try:
                subscription_info = {
                    "endpoint": sub.endpoint,
                    "keys": {"p256dh": sub.p256dh, "auth": sub.auth},
                }

                # We pass the Vapid instance to the 'vapid_private_key' parameter.
                # pywebpush is smart enough to use it if it's not a string.
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
