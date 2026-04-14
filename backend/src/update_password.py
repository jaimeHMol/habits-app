import getpass
from sqlmodel import Session, select
from src.infrastructure.database import engine
from src.domain.models import User
from src.api.security import get_password_hash


def update_admin_password():
    # We use getpass to avoid the password appearing in the terminal history
    new_password = getpass.getpass("Enter new robust password: ")
    confirm_password = getpass.getpass("Confirm password: ")

    if new_password != confirm_password:
        print("Error: Passwords do not match.")
        return

    if len(new_password) < 12:
        print("Warning: Use at least 12 characters for a robust password.")
        return

    with Session(engine) as session:
        statement = select(User).where(User.username == "admin")
        user = session.exec(statement).first()

        if not user:
            print("Error: Admin user not found. Run create_admin.py first.")
            return

        user.hashed_password = get_password_hash(new_password)
        session.add(user)
        session.commit()
        print("Success: Admin password updated with a new salted hash.")


if __name__ == "__main__":
    update_admin_password()
