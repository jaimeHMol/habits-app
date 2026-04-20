from pydantic_settings import BaseSettings
from pydantic import ConfigDict


class Settings(BaseSettings):
    # Security keys
    secret_key: str  # Mandatory: No default value to force env var
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24 * 7  # 7 days session

    # Single Admin User Credentials
    admin_username: str = "admin"
    admin_password: str  # Mandatory: No default value

    # Database
    database_url: str = "sqlite:///data/habits.db"

    # CORS configuration
    # Example: "https://habits.jaimehmol.me,http://localhost:5173"
    cors_origins_str: str = "*"

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins_str.split(",")]

    model_config = ConfigDict(env_file=".env")


settings = Settings()
