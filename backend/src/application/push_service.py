import base64
import json
import logging
import os
import tempfile
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
        Reconstructs the Elliptic Curve private key and exports it as a PEM string.
        """
        try:
            key_str = self.private_key.strip().replace('"', "").replace("'", "")
            padding = len(key_str) % 4
            if padding:
                key_str += "=" * (4 - padding)

            private_key_bytes = base64.urlsafe_b64decode(key_str)

            # Reconstruct the key object using the exact Elliptic Curve (SECP256R1)
            priv_key_obj = ec.derive_private_key(
                int.from_bytes(private_key_bytes, "big"), ec.SECP256R1()
            )

            # Export to PEM format (Traditional OpenSSL)
            pem_bytes = priv_key_obj.private_bytes(
                encoding=serialization.Encoding.PEM,
                format=serialization.PrivateFormat.TraditionalOpenSSL,
                encryption_algorithm=serialization.NoEncryption(),
            )
            return pem_bytes.decode("utf-8")
        except Exception as e:
            logger.error(f"Critical error loading VAPID key: {e}")
            return None

    def send_notification(
        self, user_id: int, title: str, body: str, data: Optional[dict] = None
    ):
        """
        Sends a push notification using a temporary file for the VAPID key.
        This is the most bulletproof way to use the library.
        """
        results = []
        if not self.private_key or not self.public_key:
            return [{"error": "VAPID keys not configured"}]

        subscriptions = self.repository.get_all_for_user(user_id)
        if not subscriptions:
            return [{"error": "No subscriptions found for user"}]

        # Prepare payload
        payload = {
            "title": title,
            "body": body,
            "icon": "/pwa-192x192.png",
            "badge": "/pwa-192x192.png",
            "data": data or {},
        }

        # Generate PEM string
        pem_content = self._get_private_key_pem()
        if not pem_content:
            return [{"error": "Could not generate VAPID PEM content"}]

        # Use a temporary file to bypass all library parsing bugs
        tmp_file = tempfile.NamedTemporaryFile(mode="w", delete=False)
        try:
            tmp_file.write(pem_content)
            tmp_file.close()
            tmp_path = tmp_file.name

            for sub in subscriptions:
                try:
                    subscription_info = {
                        "endpoint": sub.endpoint,
                        "keys": {"p256dh": sub.p256dh, "auth": sub.auth},
                    }

                    # Passing a REAL FILE PATH is the library's most supported path
                    webpush(
                        subscription_info=subscription_info,
                        data=json.dumps(payload),
                        vapid_private_key=tmp_path,
                        vapid_claims={"sub": self.subject},
                    )
                    results.append({"endpoint": sub.endpoint[:20], "status": "sent"})
                except WebPushException as ex:
                    results.append({"endpoint": sub.endpoint[:20], "error": str(ex)})
                    if ex.response and ex.response.status_code in [404, 410]:
                        self.repository.delete_by_endpoint(sub.endpoint)
                except Exception as e:
                    results.append({"error": str(e)})

        finally:
            # Always clean up the temporary key file
            if os.path.exists(tmp_path):
                os.remove(tmp_path)

        return results

    def get_public_key(self) -> str:
        return self.public_key
