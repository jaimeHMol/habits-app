from typing import List, Optional
from sqlmodel import Session, select
from src.domain.models import (
    Task,
    TaskCreate,
    TaskUpdate,
    TaskCompletionLog,
    ColumnId,
    Reminder,
    ReminderCreate,
    ReminderUpdate,
    User,
)
from src.application.interfaces import ITaskRepository, IReminderRepository


class SQLiteTaskRepository(ITaskRepository):
    """
    SQLite Adapter for the Task Repository using SQLModel.
    """

    def __init__(self, session: Session):
        self.session = session

    def get_all(self) -> List[Task]:
        # Sorting by order_index by default to match UI expectations
        statement = select(Task).order_by(Task.order_index)
        results = self.session.exec(statement)
        return results.all()

    def get_by_id(self, task_id: int) -> Optional[Task]:
        return self.session.get(Task, task_id)

    def create(self, task_data: TaskCreate) -> Task:
        # FIX: Changed from_orm to model_validate (Pydantic V2)
        db_task = Task.model_validate(task_data)

        if db_task.order_index == 0:
            statement = select(Task).where(Task.column_id == db_task.column_id)
            count = len(self.session.exec(statement).all())
            db_task.order_index = count

        self.session.add(db_task)
        self.session.commit()
        self.session.refresh(db_task)
        return db_task

    def update(self, task_id: int, task_data: TaskUpdate) -> Optional[Task]:
        db_task = self.get_by_id(task_id)
        if not db_task:
            return None

        # FIX: Changed dict() to model_dump() (Pydantic V2)
        update_data = task_data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(db_task, key, value)

        self.session.add(db_task)
        self.session.commit()
        self.session.refresh(db_task)
        return db_task

    def delete(self, task_id: int) -> bool:
        db_task = self.get_by_id(task_id)
        if not db_task:
            return False

        self.session.delete(db_task)
        self.session.commit()
        return True

    def reorder_tasks(self, column_id: ColumnId, task_ids: List[int]) -> bool:
        """
        Bulk update of order_index for tasks in a column.
        """
        try:
            for index, t_id in enumerate(task_ids):
                db_task = self.get_by_id(t_id)
                if db_task and db_task.column_id == column_id:
                    db_task.order_index = index
                    self.session.add(db_task)

            self.session.commit()
            return True
        except Exception:
            self.session.rollback()
            return False

    def reset_daily_tasks(self) -> bool:
        """
        Sets completed=False for all tasks in the daily column.
        """
        try:
            statement = select(Task).where(Task.column_id == ColumnId.DAILY)
            results = self.session.exec(statement)
            for task in results:
                task.completed = False
                self.session.add(task)
            self.session.commit()
            return True
        except Exception:
            self.session.rollback()
            return False

    def reset_monthly_tasks(self) -> bool:
        """
        Sets completed=False for all tasks in the monthly column.
        """
        try:
            statement = select(Task).where(Task.column_id == ColumnId.MONTHLY)
            results = self.session.exec(statement)
            for task in results:
                task.completed = False
                self.session.add(task)
            self.session.commit()
            return True
        except Exception:
            self.session.rollback()
            return False

    def reset_annually_tasks(self) -> bool:
        """
        Sets completed=False for all tasks in the annually column.
        """
        try:
            statement = select(Task).where(Task.column_id == ColumnId.ANNUALLY)
            results = self.session.exec(statement)
            for task in results:
                task.completed = False
                self.session.add(task)
            self.session.commit()
            return True
        except Exception:
            self.session.rollback()
            return False

    def log_completion(self, task: Task, is_retroactive: bool) -> None:
        """
        Inserts a log entry for a task completion.
        """
        log_entry = TaskCompletionLog(
            task_id=task.id,
            task_title=task.title,
            column_id=task.column_id,
            priority=task.priority,
            target_day=task.target_day,
            target_month=task.target_month,
            is_retroactive=is_retroactive,
        )
        self.session.add(log_entry)
        self.session.commit()
        self.session.refresh(task)  # Important: keep the task object alive

    def remove_last_completion_log(self, task: Task) -> None:
        """
        Deletes the most recent log for a given task.
        """
        statement = (
            select(TaskCompletionLog)
            .where(TaskCompletionLog.task_id == task.id)
            .order_by(TaskCompletionLog.completed_at.desc())
        )

        result = self.session.exec(statement).first()
        if result:
            self.session.delete(result)
            self.session.commit()
            self.session.refresh(task)  # Keep it alive


class SQLiteReminderRepository(IReminderRepository):
    """
    SQLite Adapter for the Reminder Repository using SQLModel.
    """

    def __init__(self, session: Session):
        self.session = session

    def get_all(self) -> List[Reminder]:
        statement = select(Reminder).order_by(Reminder.created_at)
        results = self.session.exec(statement)
        return results.all()

    def get_by_id(self, reminder_id: int) -> Optional[Reminder]:
        return self.session.get(Reminder, reminder_id)

    def create(self, reminder_data: ReminderCreate) -> Reminder:
        db_reminder = Reminder.model_validate(reminder_data)
        self.session.add(db_reminder)
        self.session.commit()
        self.session.refresh(db_reminder)
        return db_reminder

    def update(
        self, reminder_id: int, reminder_data: ReminderUpdate
    ) -> Optional[Reminder]:
        db_reminder = self.get_by_id(reminder_id)
        if not db_reminder:
            return None

        update_data = reminder_data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(db_reminder, key, value)

        self.session.add(db_reminder)
        self.session.commit()
        self.session.refresh(db_reminder)
        return db_reminder

    def delete(self, reminder_id: int) -> bool:
        db_reminder = self.get_by_id(reminder_id)
        if not db_reminder:
            return False

        self.session.delete(db_reminder)
        self.session.commit()
        return True


class SQLiteUserRepository:
    """
    Minimal repository for user settings.
    """

    def __init__(self, session: Session):
        self.session = session

    def update_settings(
        self, user_id: int, start_time: str, end_time: str
    ) -> Optional[User]:
        db_user = self.session.get(User, user_id)
        if not db_user:
            return None

        db_user.day_start_time = start_time
        db_user.day_end_time = end_time

        self.session.add(db_user)
        self.session.commit()
        self.session.refresh(db_user)
        return db_user
