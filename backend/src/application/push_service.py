import base64
import json
import logging
from typing import Optional

from cryptography.hazmat.primitives import serialization
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

    def _get_private_key_pem(self):
        """
        Converts the raw Base64 private key from .env into a PEM formatted string.
        This is the ONLY format that pywebpush accepts as a string while
        preserving the EllipticCurve instance requirement.
        """
        try:
            key_str = self.private_key.strip()
            # 1. Add padding if missing
            padding = len(key_str) % 4
            if padding:
                key_str += "=" * (4 - padding)

            # 2. Decode to raw bytes
            private_key_bytes = base64.urlsafe_b64decode(key_str)

            # 3. Reconstruct the cryptography object
            priv_key_obj = ec.derive_private_key(
                int.from_bytes(private_key_bytes, "big"), ec.SECP256R1()
            )

            # 4. Export to PEM format (which is a string that pywebpush can 'stat')
            pem_bytes = priv_key_obj.private_bytes(
                encoding=serialization.Encoding.PEM,
                format=serialization.PrivateFormat.TraditionalOpenSSL,
                encryption_algorithm=serialization.NoEncryption(),
            )
            return pem_bytes.decode("utf-8")
        except Exception as e:
            logger.error(f"Critical error reconstructing VAPID PEM: {e}")
            return self.private_key

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

        # The library expects a PEM string to avoid the 'stat' error and load the curve
        vapid_key_pem = self._get_private_key_pem()

        for sub in subscriptions:
            try:
                subscription_info = {
                    "endpoint": sub.endpoint,
                    "keys": {"p256dh": sub.p256dh, "auth": sub.auth},
                }

                webpush(
                    subscription_info=subscription_info,
                    data=json.dumps(payload),
                    vapid_private_key=vapid_key_pem,
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
