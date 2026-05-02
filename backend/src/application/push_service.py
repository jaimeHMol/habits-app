import base64
import json
import logging
import time
from typing import Optional
from urllib.parse import urlparse

import httpx
import jwt
import pywebpush
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

    def _get_private_key_obj(self, log_list):
        """Reconstructs the EC Private Key object securely."""
        try:
            key_str = self.private_key.strip().replace('"', "").replace("'", "")
            padding = len(key_str) % 4
            if padding:
                key_str += "=" * (4 - padding)
            key_bytes = base64.urlsafe_b64decode(key_str)
            log_list.append("Llave privada decodificada")
            return ec.derive_private_key(
                int.from_bytes(key_bytes, "big"), ec.SECP256R1()
            )
        except Exception as e:
            log_list.append(f"Error en llave: {str(e)}")
            raise

    def send_notification(
        self, user_id: int, title: str, body: str, data: Optional[dict] = None
    ):
        """
        Sends a push notification with a total bypass and surgical curve patch.
        """
        results = []
        logs = []
        subscriptions = self.repository.get_all_for_user(user_id)
        if not subscriptions:
            return [{"error": "Sin suscripciones activas"}]

        try:
            priv_key_obj = self._get_private_key_obj(logs)
            logs.append("Objeto de llave EC creado")
        except Exception as e:
            return [{"error": f"Error inicial: {str(e)}", "logs": logs}]

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
                # 1. Generar VAPID manual
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
                }
                logs.append(
                    f"Headers VAPID creados para endpoint {sub.endpoint[:15]}..."
                )

                # 2. Encriptar el payload usando WebPusher.encode con PARCHE QUIRÚRGICO
                pusher = WebPusher(
                    {
                        "endpoint": sub.endpoint,
                        "keys": {"p256dh": sub.p256dh, "auth": sub.auth},
                    }
                )

                # --- EL PARCHE DEFINITIVO ---
                # Forzamos a pywebpush a usar EXACTAMENTE la misma instancia de la curva que nosotros
                # Esto soluciona el 'curve must be an EllipticCurve instance'
                original_curve_func = pywebpush.ec.SECP256R1
                pywebpush.ec.SECP256R1 = lambda: ec.SECP256R1()

                try:
                    logs.append("Iniciando encriptación aes128gcm...")
                    # El nombre correcto según dir() es 'encode'
                    encoded_res = pusher.encode(payload_bytes, "aes128gcm")
                    encrypted_body = encoded_res.get("body")

                    if not encrypted_body:
                        raise Exception("No se pudo obtener el cuerpo encriptado")

                    logs.append("Cuerpo encriptado con éxito")

                    # 3. Envío HTTP Manual
                    with httpx.Client() as client:
                        response = client.post(
                            sub.endpoint,
                            content=encrypted_body,
                            headers={
                                **headers,
                                "Content-Type": "application/octet-stream",
                                "Content-Encoding": "aes128gcm",
                            },
                            timeout=15.0,
                        )

                        if response.status_code in [201, 202]:
                            results.append({"status": "sent", "logs": logs})
                        else:
                            results.append(
                                {
                                    "error": f"HTTP {response.status_code}: {response.text[:50]}",
                                    "logs": logs,
                                }
                            )
                finally:
                    # Restauramos la librería a su estado original
                    pywebpush.ec.SECP256R1 = original_curve_func

            except Exception as e:
                results.append({"error": f"{type(e).__name__}: {str(e)}", "logs": logs})

        return results

    def get_public_key(self) -> str:
        return self.public_key
