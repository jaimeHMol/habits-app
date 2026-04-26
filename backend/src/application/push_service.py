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

    def send_notification(
        self, user_id: int, title: str, body: str, data: Optional[dict] = None
    ):
        """
        Sends a push notification to all subscriptions of a user.
        """
        if not self.private_key or not self.public_key:
            logger.warning(
                f"Skipping push for user {user_id}: VAPID keys not configured"
            )
            return

        subscriptions = self.repository.get_all_for_user(user_id)
        if not subscriptions:
            return

        payload = {
            "title": title,
            "body": body,
            "icon": "/pwa-192x192.png",
            "badge": "/pwa-192x192.png",
            "data": data or {},
        }

        for sub in subscriptions:
            try:
                subscription_info = {
                    "endpoint": sub.endpoint,
                    "keys": {"p256dh": sub.p256dh, "auth": sub.auth},
                }

                webpush(
                    subscription_info=subscription_info,
                    data=json.dumps(payload),
                    vapid_private_key=self.private_key,
                    vapid_claims={"sub": self.subject},
                )
            except WebPushException as ex:
                logger.error(f"WebPush error: {ex}")
                # If the subscription is expired or invalid (410 Gone or 404 Not Found)
                if ex.response and ex.response.status_code in [404, 410]:
                    logger.info(
                        f"Removing invalid subscription for endpoint: {sub.endpoint}"
                    )
                    self.repository.delete_by_endpoint(sub.endpoint)
            except Exception as e:
                logger.exception(f"Unexpected error sending push: {e}")

    def get_public_key(self) -> str:
        return self.public_key
