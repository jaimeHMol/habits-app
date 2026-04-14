from fastapi import Depends
from sqlmodel import Session
from src.infrastructure.database import get_session
from src.application.interfaces import ITaskRepository
from src.infrastructure.sqlite_repository import SQLiteTaskRepository
from src.application.services import TaskService


# 1. Provide the Repository implementation
# FastAPI will inject the 'Session' into this function
def get_task_repository(session: Session = Depends(get_session)) -> ITaskRepository:
    """
    Returns the concrete implementation of the task repository.
    If we switch to Postgres tomorrow, we ONLY change this single line
    to return PostgresTaskRepository(session).
    """
    return SQLiteTaskRepository(session=session)


# 2. Provide the Application Service
# FastAPI will inject the 'ITaskRepository' into this function
def get_task_service(
    repository: ITaskRepository = Depends(get_task_repository),
) -> TaskService:
    """
    Returns the application service injected with its required repository.
    """
    return TaskService(repository=repository)
