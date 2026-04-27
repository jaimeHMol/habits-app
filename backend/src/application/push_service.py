import base64
import json
import logging
from typing import Optional

from pywebpush import WebPusher, WebPushException
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
        self._vapid_obj = None

    def _prepare_vapid_object(self):
        """
        Manually creates a Vapid object to bypass pywebpush's buggy path-checking logic.
        """
        if self._vapid_obj:
            return self._vapid_obj, None

        try:
            # 1. Decode base64 private key
            key_str = self.private_key.strip().replace('"', "").replace("'", "")
            padding = len(key_str) % 4
            if padding:
                key_str += "=" * (4 - padding)

            # Use urlsafe_b64decode as it's the standard for VAPID
            private_key_bytes = base64.urlsafe_b64decode(key_str)

            # 2. Create Vapid instance and set the private key
            vapid = Vapid()
            # We use the internal helper of py-vapid to ensure the curve is correctly set
            vapid.private_key = vapid._private_key_from_bytes(private_key_bytes)
            vapid.public_key = vapid.private_key.public_key()

            self._vapid_obj = vapid
            return vapid, None
        except Exception as e:
            error_msg = f"VAPID Init Error: {type(e).__name__} - {str(e)}"
            logger.error(error_msg)
            return None, error_msg

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

        # Prepare the Vapid object
        vapid_obj, error = self._prepare_vapid_object()
        if not vapid_obj:
            return [{"error": error or "Internal VAPID initialization failed"}]

        for sub in subscriptions:
            try:
                subscription_info = {
                    "endpoint": sub.endpoint,
                    "keys": {"p256dh": sub.p256dh, "auth": sub.auth},
                }

                # Using WebPusher directly
                wp = WebPusher(
                    subscription_info=subscription_info,
                    data=json.dumps(payload),
                    vapid_private_key=None,
                    vapid_claims={"sub": self.subject},
                )
                wp._vapid = vapid_obj
                wp.send()

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
