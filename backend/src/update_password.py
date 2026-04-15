import sys
import os
import getpass

# Add current directory to path to allow absolute imports when running as a script
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlmodel import Session, select
from src.infrastructure.database import engine
from src.domain.models import User
from src.api.security import get_password_hash
from src.core.config import settings


def update_admin_password():
    """
    Interactively updates the password for the configured admin user.
    """
    username = settings.admin_username
    print(f"Updating password for user: {username}")

    # We use getpass to avoid the password appearing in the terminal history
    new_password = getpass.getpass("Enter new robust password: ")
    confirm_password = getpass.getpass("Confirm password: ")

    if new_password != confirm_password:
        print("Error: Passwords do not match.")
        return

    if len(new_password) < 8:
        print("Warning: Use at least 8 characters for a robust password.")
        return

    with Session(engine) as session:
        statement = select(User).where(User.username == username)
        user = session.exec(statement).first()

        if not user:
            print(f"Error: User '{username}' not found. Run create_admin.py first.")
            return

        user.hashed_password = get_password_hash(new_password)
        session.add(user)
        session.commit()
        print(f"Success: Password for '{username}' updated with a new salted hash.")


if __name__ == "__main__":
    update_admin_password()
