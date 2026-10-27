from datetime import timezone
from typing import List, Optional
from sqlmodel import Session, select
from src.domain.models import (
    Task,
    TaskCreate,
    TaskUpdate,
    TaskCompletionLog,
    TaskType,
    ColumnId,
    Reminder,
    ReminderCreate,
    ReminderUpdate,
    User,
    PushSubscription,
    PomodoroSession,
    PomodoroStatus,
    PomodoroPhase,
)
from src.application.interfaces import (
    ITaskRepository,
    IReminderRepository,
    IPushSubscriptionRepository,
    IUserRepository,
    IPomodoroRepository,
)


def _normalize_task_tz(task: Optional[Task]) -> Optional[Task]:
    if not task:
        return None
    for attr in ("timer_end_time", "created_at"):
        val = getattr(task, attr, None)
        if val is not None:
            if val.tzinfo is None:
                setattr(task, attr, val.replace(tzinfo=timezone.utc))
            else:
                setattr(task, attr, val.astimezone(timezone.utc))
    return task


def _normalize_reminder_tz(reminder: Optional[Reminder]) -> Optional[Reminder]:
    if not reminder:
        return None
    for attr in ("last_triggered_at", "created_at"):
        val = getattr(reminder, attr, None)
        if val is not None:
            if val.tzinfo is None:
                setattr(reminder, attr, val.replace(tzinfo=timezone.utc))
            else:
                setattr(reminder, attr, val.astimezone(timezone.utc))
    return reminder


class SQLiteTaskRepository(ITaskRepository):
    """
    SQLite Adapter for the Task Repository using SQLModel.
    """

    def __init__(self, session: Session):
        self.session = session

    def get_all(self, user_id: int) -> List[Task]:
        # Sorting by is_pinned descending, then order_index to match UI expectations
        statement = (
            select(Task)
            .where(Task.user_id == user_id)
            .order_by(Task.is_pinned.desc(), Task.order_index)
        )
        results = self.session.exec(statement).all()
        return [_normalize_task_tz(t) for t in results]

    def get_by_id(self, task_id: int, user_id: int) -> Optional[Task]:
        statement = select(Task).where(Task.id == task_id, Task.user_id == user_id)
        res = self.session.exec(statement).first()
        return _normalize_task_tz(res)

    def create(self, task_data: TaskCreate, user_id: int) -> Task:
        db_task = Task.model_validate(task_data)
        db_task.user_id = user_id

        if db_task.order_index == 0:
            statement = select(Task).where(
                Task.column_id == db_task.column_id, Task.user_id == user_id
            )
            existing_tasks = self.session.exec(statement).all()
            for t in existing_tasks:
                t.order_index += 1
                self.session.add(t)
            db_task.order_index = 0

        _normalize_task_tz(db_task)
        self.session.add(db_task)
        self.session.commit()
        self.session.refresh(db_task)
        return _normalize_task_tz(db_task)

    def update(
        self, task_id: int, task_data: TaskUpdate, user_id: int
    ) -> Optional[Task]:
        db_task = self.get_by_id(task_id, user_id)
        if not db_task:
            return None

        update_data = task_data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(db_task, key, value)

        _normalize_task_tz(db_task)
        self.session.add(db_task)
        self.session.commit()
        self.session.refresh(db_task)
        return _normalize_task_tz(db_task)

    def delete(self, task_id: int, user_id: int) -> bool:
        db_task = self.get_by_id(task_id, user_id)
        if not db_task:
            return False

        self.session.delete(db_task)
        self.session.commit()
        return True

    def reorder_tasks(
        self, column_id: ColumnId, task_ids: List[int], user_id: int
    ) -> bool:
        """
        Bulk update of order_index for tasks in a column.
        """
        try:
            for index, t_id in enumerate(task_ids):
                db_task = self.get_by_id(t_id, user_id)
                if db_task and db_task.column_id == column_id:
                    db_task.order_index = index
                    self.session.add(db_task)

            self.session.commit()
            return True
        except Exception:
            self.session.rollback()
            return False

    def reset_daily_tasks(self, user_id: int) -> bool:
        """
        Sets completed=False for all tasks in the daily column.
        For COUNTER tasks, resets current_count to 0.
        """
        try:
            statement = select(Task).where(
                Task.column_id == ColumnId.DAILY, Task.user_id == user_id
            )
            results = self.session.exec(statement).all()
            for task in results:
                if task.task_type == TaskType.COUNTER:
                    task.current_count = 0
                else:
                    task.completed = False
                self.session.add(task)
            self.session.commit()
            return True
        except Exception:
            self.session.rollback()
            return False

    def reset_monthly_tasks(self, user_id: int) -> bool:
        """
        Sets completed=False for all monthly tasks.
        For COUNTER tasks, resets current_count to 0.
        """
        try:
            statement = select(Task).where(
                Task.column_id == ColumnId.MONTHLY, Task.user_id == user_id
            )
            results = self.session.exec(statement).all()
            for task in results:
                if task.task_type == TaskType.COUNTER:
                    task.current_count = 0
                else:
                    task.completed = False
                self.session.add(task)
            self.session.commit()
            return True
        except Exception:
            self.session.rollback()
            return False

    def reset_annually_tasks(self, user_id: int) -> bool:
        """
        Sets completed=False for all tasks in the annually column.
        For COUNTER tasks, resets current_count to 0.
        """
        try:
            statement = select(Task).where(
                Task.column_id == ColumnId.ANNUALLY, Task.user_id == user_id
            )
            results = self.session.exec(statement).all()
            for task in results:
                if task.task_type == TaskType.COUNTER:
                    task.current_count = 0
                else:
                    task.completed = False
                self.session.add(task)
            self.session.commit()
            return True
        except Exception:
            self.session.rollback()
            return False

    def increment_task(
        self, task_id: int, user_id: int, is_retroactive: bool
    ) -> Optional[Task]:
        """
        Increments current_count and logs the event.
        """
        task = self.get_by_id(task_id, user_id)
        if not task:
            return None

        task.current_count += 1
        self.session.add(task)
        self.session.commit()

        # Log the increment using the existing history system
        self.log_completion(task, is_retroactive)

        return task

    def decrement_task(self, task_id: int, user_id: int) -> Optional[Task]:
        """
        Decrements current_count and removes the last log.
        """
        task = self.get_by_id(task_id, user_id)
        if not task:
            return None

        if task.current_count > 0:
            task.current_count -= 1
            self.session.add(task)
            self.session.commit()
            # Remove the last log for this task
            self.remove_last_completion_log(task)

        return task

    def log_completion(self, task: Task, is_retroactive: bool) -> None:
        """
        Inserts a log entry for a task completion.
        """
        log_entry = TaskCompletionLog(
            task_id=task.id,
            user_id=task.user_id,
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
            .where(
                TaskCompletionLog.task_id == task.id,
                TaskCompletionLog.user_id == task.user_id,
            )
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

    def get_all(self, user_id: int) -> List[Reminder]:
        statement = (
            select(Reminder)
            .where(Reminder.user_id == user_id)
            .order_by(Reminder.created_at)
        )
        results = self.session.exec(statement).all()
        return [_normalize_reminder_tz(r) for r in results]

    def get_by_id(self, reminder_id: int, user_id: int) -> Optional[Reminder]:
        statement = select(Reminder).where(
            Reminder.id == reminder_id, Reminder.user_id == user_id
        )
        res = self.session.exec(statement).first()
        return _normalize_reminder_tz(res)

    def create(self, reminder_data: ReminderCreate, user_id: int) -> Reminder:
        db_reminder = Reminder.model_validate(reminder_data)
        db_reminder.user_id = user_id
        _normalize_reminder_tz(db_reminder)
        self.session.add(db_reminder)
        self.session.commit()
        self.session.refresh(db_reminder)
        return _normalize_reminder_tz(db_reminder)

    def update(
        self, reminder_id: int, reminder_data: ReminderUpdate, user_id: int
    ) -> Optional[Reminder]:
        db_reminder = self.get_by_id(reminder_id, user_id)
        if not db_reminder:
            return None

        update_data = reminder_data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(db_reminder, key, value)

        _normalize_reminder_tz(db_reminder)
        self.session.add(db_reminder)
        self.session.commit()
        self.session.refresh(db_reminder)
        return _normalize_reminder_tz(db_reminder)

    def delete(self, reminder_id: int, user_id: int) -> bool:
        db_reminder = self.get_by_id(reminder_id, user_id)
        if not db_reminder:
            return False

        self.session.delete(db_reminder)
        self.session.commit()
        return True


class SQLiteUserRepository(IUserRepository):
    """
    Minimal repository for user settings.
    """

    def __init__(self, session: Session):
        self.session = session

    def get_all(self) -> List[User]:
        statement = select(User)
        return self.session.exec(statement).all()

    def get_by_id(self, user_id: int) -> Optional[User]:
        return self.session.get(User, user_id)

    def update_settings(
        self,
        user_id: int,
        start_time: str,
        end_time: str,
        language: str,
        timezone: Optional[str] = None,
    ) -> Optional[User]:
        db_user = self.session.get(User, user_id)
        if not db_user:
            return None

        db_user.day_start_time = start_time
        db_user.day_end_time = end_time
        db_user.language = language
        if timezone:
            db_user.timezone = timezone

        self.session.add(db_user)
        self.session.commit()
        self.session.refresh(db_user)
        return db_user

    def update_last_reset_date(self, user_id: int, date_str: str) -> bool:
        """
        Updates the date when the user confirmed the period resets.
        """
        db_user = self.session.get(User, user_id)
        if not db_user:
            return False
        db_user.last_period_reset_date = date_str
        self.session.add(db_user)
        self.session.commit()
        return True


class SQLitePushSubscriptionRepository(IPushSubscriptionRepository):
    """
    SQLite Adapter for the Push Subscription Repository.
    """

    def __init__(self, session: Session):
        self.session = session

    def get_all_for_user(self, user_id: int) -> List[PushSubscription]:
        statement = select(PushSubscription).where(PushSubscription.user_id == user_id)
        return self.session.exec(statement).all()

    def get_all(self) -> List[PushSubscription]:
        statement = select(PushSubscription)
        return self.session.exec(statement).all()

    def create(
        self, user_id: int, endpoint: str, p256dh: str, auth: str
    ) -> PushSubscription:
        # Check if endpoint already exists to avoid duplicates (unique constraint handled by DB, but good to be explicit)
        statement = select(PushSubscription).where(
            PushSubscription.endpoint == endpoint
        )
        existing = self.session.exec(statement).first()
        if existing:
            existing.user_id = user_id
            existing.p256dh = p256dh
            existing.auth = auth
            db_sub = existing
        else:
            db_sub = PushSubscription(
                user_id=user_id, endpoint=endpoint, p256dh=p256dh, auth=auth
            )
            self.session.add(db_sub)

        self.session.commit()
        self.session.refresh(db_sub)
        return db_sub

    def delete_by_endpoint(self, endpoint: str) -> bool:
        statement = select(PushSubscription).where(
            PushSubscription.endpoint == endpoint
        )
        db_sub = self.session.exec(statement).first()
        if not db_sub:
            return False

        self.session.delete(db_sub)
        self.session.commit()
        return True


def _normalize_pomodoro_tz(
    session_obj: Optional[PomodoroSession],
) -> Optional[PomodoroSession]:
    if not session_obj:
        return None
    for attr in ("started_at", "timer_end_time", "completed_at", "interrupted_at"):
        val = getattr(session_obj, attr, None)
        if val is not None:
            if val.tzinfo is None:
                setattr(session_obj, attr, val.replace(tzinfo=timezone.utc))
            else:
                setattr(session_obj, attr, val.astimezone(timezone.utc))
    return session_obj


class SQLitePomodoroRepository(IPomodoroRepository):
    """
    SQLite Adapter for the Pomodoro Repository using SQLModel.
    """

    def __init__(self, session: Session):
        self.session = session

    def create(self, session_obj: PomodoroSession) -> PomodoroSession:
        _normalize_pomodoro_tz(session_obj)
        self.session.add(session_obj)
        self.session.commit()
        self.session.refresh(session_obj)
        return _normalize_pomodoro_tz(session_obj)

    def get_by_id(self, pomodoro_id: int, user_id: int) -> Optional[PomodoroSession]:
        statement = select(PomodoroSession).where(
            PomodoroSession.id == pomodoro_id, PomodoroSession.user_id == user_id
        )
        res = self.session.exec(statement).first()
        return _normalize_pomodoro_tz(res)

    def get_active_for_user(self, user_id: int) -> Optional[PomodoroSession]:
        statement = (
            select(PomodoroSession)
            .where(
                PomodoroSession.user_id == user_id,
                (PomodoroSession.status == PomodoroStatus.IN_PROGRESS)
                | (
                    (PomodoroSession.phase == PomodoroPhase.BREAK)
                    & (PomodoroSession.timer_end_time.is_not(None))  # noqa: E711
                ),
            )
            .order_by(PomodoroSession.id.desc())
        )
        res = self.session.exec(statement).first()
        return _normalize_pomodoro_tz(res)

    def get_by_date(self, user_id: int, date_str: str) -> List[PomodoroSession]:
        statement = (
            select(PomodoroSession)
            .where(
                PomodoroSession.user_id == user_id,
                PomodoroSession.date_str == date_str,
            )
            .order_by(PomodoroSession.started_at.desc(), PomodoroSession.id.desc())
        )
        sessions = self.session.exec(statement).all()
        return [_normalize_pomodoro_tz(s) for s in sessions]

    def update(self, session_obj: PomodoroSession) -> PomodoroSession:
        _normalize_pomodoro_tz(session_obj)
        self.session.add(session_obj)
        self.session.commit()
        self.session.refresh(session_obj)
        return _normalize_pomodoro_tz(session_obj)

    def delete(self, pomodoro_id: int, user_id: int) -> bool:
        session_obj = self.get_by_id(pomodoro_id, user_id)
        if not session_obj:
            return False
        self.session.delete(session_obj)
        self.session.commit()
        return True
