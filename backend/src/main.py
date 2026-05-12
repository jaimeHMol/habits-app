from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session, select
from src.infrastructure.database import engine
from src.domain.models import Task, ColumnId
from src.infrastructure.sqlite_repository import (
    SQLiteTaskRepository,
    SQLiteReminderRepository,
)
from src.application.services import TaskService
from src.core.config import settings
from src.api.routers import (
    router as tasks_router,
    reminders_router,
    users_router,
    push_router,
)
from src.api.auth_router import router as auth_router
from src.application.reminder_scheduler import ReminderScheduler


def _ensure_reminder_integrity():
    with Session(engine) as session:
        task_repo = SQLiteTaskRepository(session)
        reminder_repo = SQLiteReminderRepository(session)
        task_service = TaskService(task_repo, reminder_repo)

        statement = select(Task).where(
            Task.column_id.in_([ColumnId.MONTHLY, ColumnId.ANNUALLY])
        )
        tasks = session.exec(statement).all()
        for task in tasks:
            if not task.completed and task.target_day is not None:
                task_service._sync_task_reminder(task)


# Lifespan context manager runs code before the app starts accepting requests
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Run integrity check for missing reminders on startup
    _ensure_reminder_integrity()

    # Initialize Scheduler (it will create its own PushService/Sessions internally)
    scheduler = ReminderScheduler()
    app.state.scheduler = scheduler
    scheduler.start()

    yield
    # Shutdown scheduler on app stop
    app.state.scheduler.shutdown()


app = FastAPI(
    title="Habit Tracker API",
    description="Backend for the Hexagonal Habit Tracker built with FastAPI and SQLModel",
    version="1.0.0",
    lifespan=lifespan,
)

# Configure CORS so the React frontend can communicate with the API
origins = settings.cors_origins

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],  # Allows GET, POST, PUT, DELETE, etc.
    allow_headers=["*"],
)

# Include the routers
app.include_router(auth_router)
app.include_router(tasks_router)
app.include_router(reminders_router)
app.include_router(users_router)
app.include_router(push_router)


@app.get("/")
def root():
    return {
        "message": "Habit Tracker API is running. Go to /docs for the interactive Swagger UI."
    }
