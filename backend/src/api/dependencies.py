from fastapi import Depends
from sqlmodel import Session
from src.infrastructure.database import get_session
from src.application.interfaces import (
    ITaskRepository,
    IReminderRepository,
    IPushSubscriptionRepository,
)
from src.infrastructure.sqlite_repository import (
    SQLiteTaskRepository,
    SQLiteReminderRepository,
    SQLiteUserRepository,
    SQLitePushSubscriptionRepository,
)
from src.application.services import TaskService, ReminderService, UserService
from src.application.push_service import PushService


# 1. Provide the Repository implementation
# FastAPI will inject the 'Session' into this function
def get_task_repository(session: Session = Depends(get_session)) -> ITaskRepository:
    """
    Returns the concrete implementation of the task repository.
    If we switch to Postgres tomorrow, we ONLY change this single line
    to return PostgresTaskRepository(session).
    """
    return SQLiteTaskRepository(session=session)


def get_reminder_repository(
    session: Session = Depends(get_session),
) -> IReminderRepository:
    return SQLiteReminderRepository(session=session)


# 2. Provide the Application Service
# FastAPI will inject the dependencies into this function
def get_task_service(
    repository: ITaskRepository = Depends(get_task_repository),
    reminder_repo: IReminderRepository = Depends(get_reminder_repository),
) -> TaskService:
    """
    Returns the application service injected with its required repository.
    """
    return TaskService(repository=repository, reminder_repo=reminder_repo)


def get_reminder_service(
    repository: IReminderRepository = Depends(get_reminder_repository),
) -> ReminderService:
    return ReminderService(repository=repository)


def get_user_repository(
    session: Session = Depends(get_session),
) -> SQLiteUserRepository:
    return SQLiteUserRepository(session=session)


def get_user_service(
    repository: SQLiteUserRepository = Depends(get_user_repository),
) -> UserService:
    return UserService(repository=repository)


def get_push_subscription_repository(
    session: Session = Depends(get_session),
) -> IPushSubscriptionRepository:
    return SQLitePushSubscriptionRepository(session=session)


def get_push_service(
    repository: IPushSubscriptionRepository = Depends(get_push_subscription_repository),
) -> PushService:
    return PushService(repository=repository)
