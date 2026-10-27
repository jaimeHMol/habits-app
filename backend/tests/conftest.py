import pytest
from fastapi.testclient import TestClient
from sqlmodel import SQLModel, create_engine, Session
from sqlalchemy.pool import StaticPool
import src.infrastructure.database as db_module

# Configure in-memory SQLite engine with StaticPool BEFORE importing main/scheduler
SQLITE_URL = "sqlite:///:memory:"
engine = create_engine(
    SQLITE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
db_module.engine = engine

from src.main import app  # noqa: E402
import src.main as main_module  # noqa: E402
import src.application.reminder_scheduler as scheduler_module  # noqa: E402
from src.infrastructure.database import get_session  # noqa: E402
from src.api.security import get_current_user, get_password_hash  # noqa: E402
from src.domain.models import User  # noqa: E402

main_module.engine = engine
scheduler_module.engine = engine


@pytest.fixture(name="session", autouse=True)
def session_fixture():
    """
    Creates fresh tables before each test and drops them after.
    Provides an isolated in-memory database session so tests never touch habits.db.
    """
    db_module.engine = engine
    main_module.engine = engine
    scheduler_module.engine = engine

    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        yield session
    SQLModel.metadata.drop_all(engine)


@pytest.fixture(name="client")
def client_fixture(session: Session):
    """
    Returns a FastAPI TestClient with the database dependency overridden.
    """
    # Create a test user in the DB
    test_user = User(username="testuser", hashed_password=get_password_hash("testpass"))
    session.add(test_user)
    session.commit()
    session.refresh(test_user)

    def get_session_override():
        return session

    def get_current_user_override():
        return test_user

    app.dependency_overrides[get_session] = get_session_override
    app.dependency_overrides[get_current_user] = get_current_user_override

    with TestClient(app) as client:
        yield client

    app.dependency_overrides.clear()
