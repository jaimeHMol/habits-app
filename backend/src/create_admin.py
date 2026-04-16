import sys
import os

# Add current directory to path to allow absolute imports when running as a script
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlmodel import Session, select
from src.infrastructure.database import engine, create_db_and_tables
from src.domain.models import User
from src.api.security import get_password_hash
from src.core.config import settings


def create_admin_user():
    """
    Creates an initial admin user based on the environment configuration.
    Safe to run multiple times; it checks for existing user first.
    """
    # Ensure tables exist (will create the User table if it doesn't)
    create_db_and_tables()

    with Session(engine) as session:
        # Check if admin already exists
        statement = select(User).where(User.username == settings.admin_username)
        existing_user = session.exec(statement).first()

        if existing_user:
            print(f"User '{settings.admin_username}' already exists in the database.")
            return

        # Create new admin securely using credentials from settings
        admin = User(
            username=settings.admin_username,
            full_name="Jaime",
            role="admin",
            hashed_password=get_password_hash(settings.admin_password),
        )
        session.add(admin)
        session.commit()
        print(
            f"Successfully created user '{settings.admin_username}' with salted hash."
        )


if __name__ == "__main__":
    create_admin_user()
