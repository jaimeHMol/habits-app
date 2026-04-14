import pytest
from fastapi.testclient import TestClient
from sqlmodel import SQLModel, create_engine, Session
from sqlalchemy.pool import StaticPool  # 1. Añadimos esta importación
from src.main import app
from src.infrastructure.database import get_session
from src.api.security import get_current_user

# 2. Configuramos el engine para usar StaticPool
SQLITE_URL = "sqlite:///:memory:"
engine = create_engine(
    SQLITE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,  # ¡Esta es la pieza mágica que soluciona el error!
)


@pytest.fixture(name="session")
def session_fixture():
    """
    Creates fresh tables before each test and drops them after.
    Provides an isolated database session.
    """
    # Import the model to ensure it's registered with SQLModel metadata

    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        yield session
    SQLModel.metadata.drop_all(engine)


@pytest.fixture(name="client")
def client_fixture(session: Session):
    """
    Returns a FastAPI TestClient with the database dependency overridden.
    """

    def get_session_override():
        return session

    def get_current_user_override():
        return "testuser"

    app.dependency_overrides[get_session] = get_session_override
    app.dependency_overrides[get_current_user] = get_current_user_override

    client = TestClient(app)
    yield client

    app.dependency_overrides.clear()
