from sqlmodel import SQLModel, create_engine, Session
from src.core.config import settings

DATABASE_URL = settings.database_url

# check_same_thread=False is needed in FastAPI for SQLite
engine = create_engine(
    DATABASE_URL, echo=False, connect_args={"check_same_thread": False}
)


def create_db_and_tables():
    """
    Creates the database and all tables defined in SQLModel metadata.
    """
    # Import models here to ensure they are registered with SQLModel before creating tables
    SQLModel.metadata.create_all(engine)


def get_session():
    """
    Dependency to yield a database session for FastAPI endpoints.
    """
    with Session(engine) as session:
        yield session
