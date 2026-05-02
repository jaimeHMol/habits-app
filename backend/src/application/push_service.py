import base64
import json
import logging
import time
from typing import Optional
from urllib.parse import urlparse

import httpx
import jwt
from cryptography.hazmat.primitives.asymmetric import ec
from pywebpush import WebPusher

from src.application.interfaces import IPushSubscriptionRepository
from src.core.config import settings

logger = logging.getLogger(__name__)


class PushService:
    def __init__(self, repository: IPushSubscriptionRepository):
        self.repository = repository
        self.public_key = settings.vapid_public_key
        self.private_key = settings.vapid_private_key
        self.subject = settings.vapid_subject

    def _get_private_key_obj(self):
        """Reconstructs the EC Private Key object."""
        key_str = self.private_key.strip().replace('"', "").replace("'", "")
        padding = len(key_str) % 4
        if padding:
            key_str += "=" * (4 - padding)
        key_bytes = base64.urlsafe_b64decode(key_str)
        return ec.derive_private_key(int.from_bytes(key_bytes, "big"), ec.SECP256R1())

    def send_notification(
        self, user_id: int, title: str, body: str, data: Optional[dict] = None
    ):
        """
        Final, nuclear-level fix for the EllipticCurve TypeError.
        Bypasses the library's buggy initialization and patches the curve globally.
        """
        results = []
        logs = []
        subscriptions = self.repository.get_all_for_user(user_id)
        if not subscriptions:
            return [{"error": "No hay suscripciones"}]

        try:
            priv_key_obj = self._get_private_key_obj()
            logs.append("Llave EC local OK")
        except Exception as e:
            return [{"error": f"Error de llave: {str(e)}"}]

        payload_content = {
            "title": title,
            "body": body,
            "icon": "/pwa-192x192.png",
            "badge": "/pwa-192x192.png",
            "data": data or {},
        }
        payload_bytes = json.dumps(payload_content).encode("utf-8")

        for sub in subscriptions:
            try:
                # 1. Preparar Headers VAPID Manuales
                parsed_url = urlparse(sub.endpoint)
                audience = f"{parsed_url.scheme}://{parsed_url.netloc}"
                claims = {
                    "sub": self.subject,
                    "aud": audience,
                    "exp": int(time.time()) + 43200,
                }
                vapid_token = jwt.encode(claims, priv_key_obj, algorithm="ES256")

                headers = {
                    "Authorization": f"WebPush {vapid_token}",
                    "Crypto-Key": f"p256ecdsa={self.public_key.strip()}",
                    "TTL": "86400",
                    "Content-Encoding": "aes128gcm",
                }

                # 2. PARCHE ATÓMICO: Inyectar la clase de curva en todas las dependencias
                import pywebpush
                import http_ece

                # Forzamos que tanto la CLASE como la INSTANCIA sean reconocidas como la misma
                # target_curve = ec.SECP256R1()

                # Parcheamos pywebpush
                pywebpush.ec.SECP256R1 = ec.SECP256R1

                # Parcheamos http_ece (donde ocurre la encriptación real)
                # Esta librería es la que suele lanzar el TypeError
                if hasattr(http_ece, "keys"):
                    http_ece.keys.Curve = ec.SECP256R1

                logs.append(f"Parche aplicado. Encriptando para {sub.endpoint[:20]}...")

                # 3. Obtener el cuerpo encriptado
                pusher = WebPusher(
                    {
                        "endpoint": sub.endpoint,
                        "keys": {"p256dh": sub.p256dh, "auth": sub.auth},
                    }
                )

                # Llamamos al motor de encriptación (usando el nombre descubierto: encode)
                encoded_res = pusher.encode(payload_bytes, "aes128gcm")
                encrypted_body = encoded_res.get("body")

                if not encrypted_body:
                    raise Exception("Error: Cuerpo encriptado vacío")

                # 4. Envío HTTP Directo con httpx
                with httpx.Client() as client:
                    resp = client.post(
                        sub.endpoint,
                        content=encrypted_body,
                        headers=headers,
                        timeout=15.0,
                    )

                    if resp.status_code in [201, 202]:
                        results.append({"status": "sent", "logs": logs})
                    else:
                        results.append(
                            {
                                "error": f"HTTP {resp.status_code}: {resp.text[:100]}",
                                "logs": logs,
                            }
                        )

            except Exception as e:
                results.append({"error": f"{type(e).__name__}: {str(e)}", "logs": logs})

        return results

    def get_public_key(self) -> str:
        return self.public_key
