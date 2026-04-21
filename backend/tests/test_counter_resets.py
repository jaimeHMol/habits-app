from sqlmodel import Session
from src.domain.models import User, Task, ColumnId, TaskType
from src.application.services import TaskService
from src.infrastructure.sqlite_repository import (
    SQLiteTaskRepository,
    SQLiteReminderRepository,
)


def test_counter_reset_logic(session: Session):
    """
    Test that COUNTER tasks reset their current_count to 0 during resets.
    """
    user = User(username="counter_user", hashed_password="pw")
    session.add(user)
    session.commit()

    # 1. Setup counters in different columns
    c_daily = Task(
        title="C1",
        column_id=ColumnId.DAILY,
        user_id=user.id,
        task_type=TaskType.COUNTER,
        current_count=5,
    )
    c_monthly = Task(
        title="C2",
        column_id=ColumnId.MONTHLY,
        user_id=user.id,
        task_type=TaskType.COUNTER,
        current_count=10,
    )
    c_annually = Task(
        title="C3",
        column_id=ColumnId.ANNUALLY,
        user_id=user.id,
        task_type=TaskType.COUNTER,
        current_count=100,
    )
    session.add(c_daily)
    session.add(c_monthly)
    session.add(c_annually)
    session.commit()

    # 2. Setup Services
    task_repo = SQLiteTaskRepository(session)
    reminder_repo = SQLiteReminderRepository(session)
    task_service = TaskService(task_repo, reminder_repo)

    # 3. Perform Resets
    task_service.reset_daily_tasks(user.id)
    task_service.reset_monthly_tasks(user.id)
    task_service.reset_annually_tasks(user.id)

    # 4. Assertions
    session.refresh(c_daily)
    session.refresh(c_monthly)
    session.refresh(c_annually)

    assert c_daily.current_count == 0
    assert c_monthly.current_count == 0
    assert c_annually.current_count == 0
