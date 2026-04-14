from sqlmodel import SQLModel, create_engine, Session
import os

# The SQLite database file will be created in the root of the backend folder
SQLITE_FILE_NAME = "habits.db"
DATABASE_URL = f"sqlite:///{SQLITE_FILE_NAME}"

# check_same_thread=False is needed in FastAPI for SQLite
engine = create_engine(DATABASE_URL, echo=False, connect_args={"check_same_thread": False})

def create_db_and_tables():
    """
    Creates the database and all tables defined in SQLModel metadata.
    """
    # Import models here to ensure they are registered with SQLModel before creating tables
    from src.domain.models import Task
    SQLModel.metadata.create_all(engine)

def get_session():
    """
    Dependency to yield a database session for FastAPI endpoints.
    """
    with Session(engine) as session:
        yield session