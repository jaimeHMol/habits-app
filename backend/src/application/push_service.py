import base64
import json
import logging
import time
from typing import Optional
from urllib.parse import urlparse

import jwt
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

    def _generate_manual_vapid_headers(self, endpoint):
        """
        Gathers the VAPID headers manually with line-by-line debug tracking.
        """
        step = "INICIO"
        try:
            # 1. Reconstruct the EC Private Key
            step = "DECODE_BASE64"
            key_str = self.private_key.strip().replace('"', "").replace("'", "")
            padding = len(key_str) % 4
            if padding:
                key_str += "=" * (4 - padding)
            private_key_bytes = base64.urlsafe_b64decode(key_str)

            step = "DERIVE_KEY_OBJ"
            priv_key_obj = ec.derive_private_key(
                int.from_bytes(private_key_bytes, "big"), ec.SECP256R1()
            )

            # 2. Convert to PEM (This is the most compatible format for PyJWT)
            step = "CONVERT_TO_PEM"
            pem_key = priv_key_obj.private_bytes(
                encoding=serialization.Encoding.PEM,
                format=serialization.PrivateFormat.PKCS8,
                encryption_algorithm=serialization.NoEncryption(),
            )

            # 3. Prepare JWT Claims
            step = "PARSE_ENDPOINT"
            parsed_url = urlparse(endpoint)
            audience = f"{parsed_url.scheme}://{parsed_url.netloc}"

            step = "PREPARE_CLAIMS"
            claims = {
                "sub": self.subject,
                "aud": audience,
                "exp": int(time.time()) + 43200,
            }

            # 4. Sign JWT using the PEM key string (extremely robust)
            step = "JWT_ENCODE"
            token = jwt.encode(claims, pem_key, algorithm="ES256")

            step = "HEADERS_BUILD"
            return {
                "Authorization": f"WebPush {token}",
                "Crypto-Key": f"p256ecdsa={self.public_key.strip()}",
            }
        except Exception as e:
            msg = f"Falla en {step}: {type(e).__name__} - {str(e)}"
            logger.error(msg)
            return {"error_step": msg}

    def send_notification(
        self, user_id: int, title: str, body: str, data: Optional[dict] = None
    ):
        """
        Sends a push notification with verbose error reporting.
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
                # 1. Generate headers
                res_headers = self._generate_manual_vapid_headers(sub.endpoint)

                if "error_step" in res_headers:
                    results.append({"error": res_headers["error_step"]})
                    continue

                subscription_info = {
                    "endpoint": sub.endpoint,
                    "keys": {"p256dh": sub.p256dh, "auth": sub.auth},
                }

                # 2. Attempt push
                # Note: We pass vapid_private_key=None to force pywebpush
                # to NOT use its internal signing logic.
                webpush(
                    subscription_info=subscription_info,
                    data=json.dumps(payload),
                    vapid_private_key=None,
                    headers=res_headers,
                )
                results.append({"endpoint": sub.endpoint[:20], "status": "sent"})

            except WebPushException as ex:
                results.append({"error": f"Libreria_Push: {str(ex)}"})
            except Exception as e:
                results.append(
                    {"error": f"General_Error: {type(e).__name__}: {str(e)}"}
                )

        return results

    def get_public_key(self) -> str:
        return self.public_key
