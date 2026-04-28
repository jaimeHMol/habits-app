import base64
import json
import logging
from typing import Optional

from cryptography.hazmat.primitives.asymmetric import ec
from pywebpush import webpush, WebPushException
import py_vapid

from src.application.interfaces import IPushSubscriptionRepository
from src.core.config import settings

logger = logging.getLogger(__name__)


class PushService:
    def __init__(self, repository: IPushSubscriptionRepository):
        self.repository = repository
        self.public_key = settings.vapid_public_key
        self.private_key = settings.vapid_private_key
        self.subject = settings.vapid_subject

    def _apply_cryptography_patch(self):
        """
        Applies a monkeypatch to py_vapid to fix the 'EllipticCurve' and 'stat' errors.
        This forces the library to use a correctly constructed EC key object.
        """
        try:
            # 1. Reconstruct the real EC Private Key object
            key_str = self.private_key.strip().replace('"', "").replace("'", "")
            padding = len(key_str) % 4
            if padding:
                key_str += "=" * (4 - padding)
            private_key_bytes = base64.urlsafe_b64decode(key_str)

            # Create the valid instance that cryptography.ES256 expects
            valid_priv_key_obj = ec.derive_private_key(
                int.from_bytes(private_key_bytes, "big"), ec.SECP256R1()
            )

            # 2. Define the patch: a function that ignores the faulty internal key
            # and uses our valid_priv_key_obj instead.
            def patched_sign(self_vapid, message):
                from cryptography.hazmat.primitives import hashes

                # ES256 signing
                signature = valid_priv_key_obj.sign(message, ec.ECDSA(hashes.SHA256()))
                return signature

            # 3. Apply the patch to the class
            py_vapid.Vapid.sign = patched_sign
            return True
        except Exception as e:
            logger.error(f"Failed to apply VAPID monkeypatch: {e}")
            return False

    def send_notification(
        self, user_id: int, title: str, body: str, data: Optional[dict] = None
    ):
        """
        Sends a push notification using a monkeypatched Vapid class.
        """
        results = []
        if not self.private_key or not self.public_key:
            return [{"error": "VAPID keys not configured"}]

        subscriptions = self.repository.get_all_for_user(user_id)
        if not subscriptions:
            return [{"error": "No subscriptions found"}]

        # Apply the fix before calling the library
        if not self._apply_cryptography_patch():
            return [{"error": "Internal fix failed"}]

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

                # Now we can use the library normally!
                # We pass the public key string to vapid_private_key
                # just to satisfy the 'is string' check of the library.
                # Our monkeypatch will ignore this string and use the real object.
                webpush(
                    subscription_info=subscription_info,
                    data=json.dumps(payload),
                    vapid_private_key=self.public_key,  # Dummy string to pass checks
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
