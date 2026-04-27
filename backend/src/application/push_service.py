import base64
import json
import logging
from typing import Optional

from pywebpush import WebPusher, WebPushException
from py_vapid import Vapid
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
        self._vapid_obj = None

    def _prepare_vapid_object(self):
        """
        Manually creates a Vapid object to bypass pywebpush's buggy path-checking logic.
        This is the most professional way to handle modern cryptography compatibility.
        """
        if self._vapid_obj:
            return self._vapid_obj

        try:
            # 1. Decode base64 private key
            key_str = self.private_key.strip().replace('"', "").replace("'", "")
            padding = len(key_str) % 4
            if padding:
                key_str += "=" * (4 - padding)
            private_key_bytes = base64.urlsafe_b64decode(key_str)

            # 2. Create a Vapid instance and manually set the private key object
            # This ensures cryptography receives a real EllipticCurvePrivateKey instance
            vapid = Vapid()
            vapid.private_key = ec.derive_private_key(
                int.from_bytes(private_key_bytes, "big"), ec.SECP256R1()
            )
            # Public key must also be set for signing
            vapid.public_key = vapid.private_key.public_key()

            self._vapid_obj = vapid
            return vapid
        except Exception as e:
            logger.error(f"Critical error initializing VAPID object: {e}")
            return None

    def send_notification(
        self, user_id: int, title: str, body: str, data: Optional[dict] = None
    ):
        """
        Sends a push notification bypassing the buggy webpush() constructor.
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

        # Prepare the Vapid object once
        vapid_obj = self._prepare_vapid_object()
        if not vapid_obj:
            return [{"error": "Internal VAPID initialization failed"}]

        for sub in subscriptions:
            try:
                subscription_info = {
                    "endpoint": sub.endpoint,
                    "keys": {"p256dh": sub.p256dh, "auth": sub.auth},
                }

                # CRITICAL FIX: We instantiate WebPusher with vapid_private_key=None
                # to prevent it from calling its internal (and buggy) Vapid.from_string()
                wp = WebPusher(
                    subscription_info=subscription_info,
                    data=json.dumps(payload),
                    vapid_private_key=None,
                    vapid_claims={"sub": self.subject},
                )

                # We manually inject our perfectly constructed Vapid object
                wp._vapid = vapid_obj

                # Now send() will use our injected object without any path/string checks
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
