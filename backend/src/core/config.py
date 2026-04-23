from pathlib import Path
from pydantic_settings import BaseSettings
from pydantic import ConfigDict

# Get the absolute path of the backend directory (root of /backend)
BACKEND_ROOT = Path(__file__).resolve().parent.parent.parent


class Settings(BaseSettings):
    # Environment
    debug: bool = False

    # Security keys
    secret_key: str  # Mandatory
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24 * 7  # 7 days session

    # Single Admin User Credentials
    admin_username: str = "admin"
    admin_password: str  # Mandatory

    # Web Push (VAPID)
    vapid_public_key: str = ""
    vapid_private_key: str = ""
    vapid_subject: str = "mailto:admin@example.com"

    # Database
    @property
    def database_url(self) -> str:
        data_dir = BACKEND_ROOT / "data"
        data_dir.mkdir(parents=True, exist_ok=True)
        db_path = data_dir / "habits.db"
        return f"sqlite:///{db_path}"

    # Cookies
    @property
    def cookie_secure(self) -> bool:
        # If debug is True, we allow cookies over HTTP (local dev)
        return not self.debug

    # CORS configuration
    cors_origins_str: str = "*"

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins_str.split(",")]

    model_config = ConfigDict(env_file=".env")


settings = Settings()
