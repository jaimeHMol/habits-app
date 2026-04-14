from sqlmodel import Session, select
from src.infrastructure.database import engine, create_db_and_tables
from src.domain.models import User
from src.api.security import get_password_hash


def create_admin_user():
    # Ensure tables exist (will create the User table if it doesn't)
    create_db_and_tables()

    with Session(engine) as session:
        # Check if admin already exists
        statement = select(User).where(User.username == "admin")
        existing_user = session.exec(statement).first()

        if existing_user:
            print("Admin user already exists in the database.")
            return

        # Create new admin securely
        admin = User(
            username="admin",
            hashed_password=get_password_hash(
                "admin123"
            ),  # Change "admin123" to your real secure password
        )
        session.add(admin)
        session.commit()
        print("Successfully created admin user with salted hash.")


if __name__ == "__main__":
    create_admin_user()
