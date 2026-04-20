from sqlmodel import Session, select
from src.domain.models import User, Task, ColumnId, TaskCompletionLog
from src.application.services import TaskService, UserService
from src.infrastructure.sqlite_repository import (
    SQLiteTaskRepository,
    SQLiteUserRepository,
    SQLiteReminderRepository,
)


def test_period_reset_logic_and_db_sync(session: Session):
    """
    Test that period resets clear task status and sync the last_reset_date in DB.
    """
    # 1. Setup User with a past reset date
    user = User(
        username="test_sync_user",
        hashed_password="hash",
        last_period_reset_date="2026-04-10",  # Old date
    )
    session.add(user)
    session.commit()
    session.refresh(user)

    # 2. Setup Tasks in different columns
    t_daily = Task(
        title="D1", column_id=ColumnId.DAILY, user_id=user.id, completed=True
    )
    t_monthly = Task(
        title="M1", column_id=ColumnId.MONTHLY, user_id=user.id, completed=True
    )
    session.add(t_daily)
    session.add(t_monthly)
    session.commit()

    # 3. Initialize Services
    task_repo = SQLiteTaskRepository(session)
    user_repo = SQLiteUserRepository(session)
    reminder_repo = SQLiteReminderRepository(session)
    task_service = TaskService(task_repo, reminder_repo)
    user_service = UserService(user_repo)

    # 4. Simulate the reset process (what the frontend does)
    today_str = "2026-04-20"

    # Reset daily and monthly
    task_service.reset_daily_tasks(user.id)
    task_service.reset_monthly_tasks(user.id)

    # Confirm the reset in DB (Critical for multi-device sync)
    user_service.confirm_period_resets(user.id, today_str)

    # 5. Assertions
    session.refresh(user)
    session.refresh(t_daily)
    session.refresh(t_monthly)

    assert user.last_period_reset_date == today_str
    assert t_daily.completed is False
    assert t_monthly.completed is False


def test_reset_preserves_history(session: Session):
    """
    Test that resetting a task does NOT delete its previous completion logs.
    """
    user = User(username="history_user", hashed_password="pw")
    session.add(user)
    session.commit()

    task = Task(
        title="Habit", column_id=ColumnId.DAILY, user_id=user.id, completed=False
    )
    session.add(task)
    session.commit()

    task_repo = SQLiteTaskRepository(session)
    reminder_repo = SQLiteReminderRepository(session)
    task_service = TaskService(task_repo, reminder_repo)

    # 1. Complete the task normally (this creates a log)
    task_service.toggle_completion(task.id, user.id)

    logs_before = session.exec(
        select(TaskCompletionLog).where(TaskCompletionLog.task_id == task.id)
    ).all()
    assert len(logs_before) == 1

    # 2. Reset the daily column
    task_service.reset_daily_tasks(user.id)

    # 3. Verify task is uncompleted but log REMAINS
    session.refresh(task)
    assert task.completed is False

    logs_after = session.exec(
        select(TaskCompletionLog).where(TaskCompletionLog.task_id == task.id)
    ).all()
    assert len(logs_after) == 1
    assert logs_after[0].task_title == "Habit"
