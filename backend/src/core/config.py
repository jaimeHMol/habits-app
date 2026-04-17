from pydantic_settings import BaseSettings
from pydantic import ConfigDict


class Settings(BaseSettings):
    # Security keys
    secret_key: str = "super-secret-development-key-change-in-prod"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24 * 7  # 7 days session

    # Single Admin User Credentials
    admin_username: str = "admin"
    admin_password: str = "admin123"

    # Database
    database_url: str = "sqlite:///habits.db"

    model_config = ConfigDict(env_file=".env")


settings = Settings()
