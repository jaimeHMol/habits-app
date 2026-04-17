import sys
import os

# Add current directory to path to allow absolute imports when running as a script
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlmodel import Session, select
from src.infrastructure.database import engine, create_db_and_tables
from src.domain.models import User
from src.api.security import get_password_hash
from src.core.config import settings


def upsert_admin_user():
    """
    Creates or updates the admin user based on the environment configuration.
    If the user exists, it updates the password and display name.
    """
    # Ensure tables exist
    create_db_and_tables()

    username = settings.admin_username
    password = settings.admin_password

    if not username or not password:
        print("Error: ADMIN_USERNAME or ADMIN_PASSWORD not set in environment.")
        return

    with Session(engine) as session:
        # Check if admin already exists
        statement = select(User).where(User.username == username)
        user = session.exec(statement).first()

        if user:
            print(f"User '{username}' already exists. Updating details...")
            user.hashed_password = get_password_hash(password)
            user.role = "admin"  # Ensure it keeps admin role
            # You can also update full_name here if needed
            session.add(user)
            print(f"Successfully updated user '{username}'.")
        else:
            print(f"Creating new admin user: '{username}'")
            user = User(
                username=username,
                full_name="Jaime Herran",
                role="admin",
                hashed_password=get_password_hash(password),
            )
            session.add(user)
            print(f"Successfully created user '{username}'.")

        session.commit()


if __name__ == "__main__":
    upsert_admin_user()
