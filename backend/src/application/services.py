from datetime import datetime, timedelta, timezone
from typing import List, Optional
from src.domain.models import (
    Task,
    TaskCreate,
    TaskUpdate,
    ColumnId,
    Reminder,
    ReminderCreate,
    ReminderUpdate,
    User,
    PomodoroSession,
    PomodoroStatus,
    PomodoroPhase,
    DeviceType,
    PomodoroTodayStatsResponse,
)
from src.application.interfaces import (
    ITaskRepository,
    IReminderRepository,
    IPomodoroRepository,
)
from src.application.utils import strip_markdown
from src.core.timezone import get_user_zone


class TaskService:
    """
    Application Service that orchestrates use cases for Tasks.
    It encapsulates business logic and interacts with the repository port.
    """

    def __init__(
        self,
        repository: ITaskRepository,
        reminder_repo: IReminderRepository,
        push_service=None,
    ):
        self.repository = repository
        self.reminder_repo = reminder_repo
        self.push_service = push_service

    def get_all_tasks(self, user_id: int) -> List[Task]:
        return self.repository.get_all(user_id)

    def create_new_task(self, task_data: TaskCreate, user_id: int) -> Task:
        # 1. Create the task normally
        created_task = self.repository.create(task_data, user_id)

        # 2. FIX: If it's a date-based column, force re-sorting
        if created_task.column_id in [ColumnId.MONTHLY, ColumnId.ANNUALLY]:
            self._ensure_chronological_order(created_task.column_id, user_id)
            # Refresh the task from DB to return it with the updated order_index
            created_task = self.repository.get_by_id(created_task.id, user_id)

        # 3. Sync Reminder
        self._sync_task_reminder(created_task)

        # 4. Final refresh to ensure object is fresh after any commits in sync
        return self.repository.get_by_id(created_task.id, user_id)

    def update_task_details(
        self, task_id: int, task_data: TaskUpdate, user_id: int
    ) -> Optional[Task]:
        # Get existing task to check if column or dates changed
        existing_task = self.repository.get_by_id(task_id, user_id)
        if not existing_task:
            return None

        updated_task = self.repository.update(task_id, task_data, user_id)

        # Logic: If target_day or target_month changed in a recurring column,
        # we might want to trigger a full re-sort of that column.
        if updated_task and (task_data.target_day or task_data.target_month):
            self._ensure_chronological_order(updated_task.column_id, user_id)
            # Fetch updated version after re-sort
            updated_task = self.repository.get_by_id(task_id, user_id)

        # Sync Reminder
        if updated_task:
            self._sync_task_reminder(updated_task)
            # Final refresh
            updated_task = self.repository.get_by_id(updated_task.id, user_id)

        return updated_task

    def delete_task(self, task_id: int, user_id: int) -> bool:
        # Delete linked reminders first
        all_reminders = self.reminder_repo.get_all(user_id)
        linked_reminders = [r for r in all_reminders if r.task_id == task_id]
        for r in linked_reminders:
            self.reminder_repo.delete(r.id, user_id)

        return self.repository.delete(task_id, user_id)

    def toggle_completion(
        self,
        task_id: int,
        user_id: int,
        is_retroactive: bool = False,
        target_state: Optional[bool] = None,
        from_timer: bool = False,
    ) -> Optional[Task]:
        task = self.repository.get_by_id(task_id, user_id)
        if not task:
            return None

        new_status = not task.completed if target_state is None else target_state
        if new_status == task.completed:
            return task  # No change needed

        if new_status:
            if from_timer and not task.timer_triggered:
                if self.push_service:
                    self.push_service.send_notification(
                        user_id=user_id,
                        title="RECUERDA",
                        body=f"Timer finalizado: {task.title}",
                        data={"task_id": task.id, "type": "timer_end"},
                        urgency="high",
                    )
                update_data = TaskUpdate(
                    completed=True,
                    timer_triggered=True,
                )
            else:
                update_data = TaskUpdate(
                    completed=True,
                    timer_end_time=None,
                    timer_triggered=False,
                )
        else:
            update_data = TaskUpdate(
                completed=False,
                timer_end_time=None,
                timer_triggered=False,
            )

        updated_task = self.repository.update(task_id, update_data, user_id)

        if updated_task.completed:
            self.repository.log_completion(updated_task, is_retroactive)
        else:
            self.repository.remove_last_completion_log(updated_task)

        # Sync Reminder
        self._sync_task_reminder(updated_task)

        return updated_task

    def increment_task(
        self, task_id: int, user_id: int, is_retroactive: bool = False
    ) -> Optional[Task]:
        """
        Orchestrates the increment of a counter task.
        """
        updated_task = self.repository.increment_task(task_id, user_id, is_retroactive)
        if updated_task:
            self._sync_task_reminder(updated_task)
        return updated_task

    def decrement_task(self, task_id: int, user_id: int) -> Optional[Task]:
        """
        Orchestrates the decrement of a counter task.
        """
        updated_task = self.repository.decrement_task(task_id, user_id)
        if updated_task:
            self._sync_task_reminder(updated_task)
        return updated_task

    def reorder_column(
        self, column_id: ColumnId, task_ids: List[int], user_id: int
    ) -> bool:
        """
        Persists the manual order from a Drag & Drop action in the UI.
        """
        return self.repository.reorder_tasks(column_id, task_ids, user_id)

    def reset_daily_tasks(self, user_id: int) -> bool:
        """
        Orchestrates the reset of all daily tasks to uncompleted status.
        """
        return self.repository.reset_daily_tasks(user_id)

    def reset_monthly_tasks(self, user_id: int) -> bool:
        """
        Orchestrates the reset of all monthly tasks to uncompleted status.
        """
        success = self.repository.reset_monthly_tasks(user_id)
        if success:
            tasks = self.repository.get_all(user_id)
            for task in tasks:
                if task.column_id == ColumnId.MONTHLY:
                    self._sync_task_reminder(task)
        return success

    def reset_annually_tasks(self, user_id: int) -> bool:
        """
        Orchestrates the reset of all annually tasks to uncompleted status.
        """
        success = self.repository.reset_annually_tasks(user_id)
        if success:
            tasks = self.repository.get_all(user_id)
            for task in tasks:
                if task.column_id == ColumnId.ANNUALLY:
                    self._sync_task_reminder(task)
        return success

    def sync_all_task_reminders(self, user_id: int):
        """
        Self-healing mechanism to ensure all task-associated reminders perfectly match
        the current state of the tasks. Called dynamically on read to guarantee integrity.
        """
        tasks = self.repository.get_all(user_id)
        all_reminders = self.reminder_repo.get_all(user_id)
        existing_task_reminders = {
            r.task_id: r for r in all_reminders if r.task_id is not None
        }

        for task in tasks:
            should_have_reminder = (
                task.column_id in [ColumnId.MONTHLY, ColumnId.ANNUALLY]
                and task.target_day is not None
                and not task.completed
            )

            existing_reminder = existing_task_reminders.get(task.id)
            if should_have_reminder:
                reminder_title = strip_markdown(task.title)
                if existing_reminder:
                    if existing_reminder.title != reminder_title:
                        self.reminder_repo.update(
                            existing_reminder.id,
                            ReminderUpdate(title=reminder_title),
                            user_id,
                        )
                else:
                    self.reminder_repo.create(
                        ReminderCreate(
                            title=reminder_title,
                            interval_minutes=1440,  # Default value, frontend will handle the 3-alert logic
                            is_active=True,
                            task_id=task.id,
                        ),
                        user_id,
                    )
            elif existing_reminder:
                self.reminder_repo.delete(existing_reminder.id, user_id)

    def _sync_task_reminder(self, task: Task):
        """
        Automatically manages reminders for Monthly and Annually tasks with target dates.
        """
        user_id = task.user_id
        if user_id is None:
            return

        # We delegate to the bulk sync to ensure consistency
        self.sync_all_task_reminders(user_id)

    def _ensure_chronological_order(self, column_id: ColumnId, user_id: int):
        """
        Internal helper to sort Monthly/Annually columns by date.
        This maintains business consistency regardless of how the UI sends data.
        """
        if column_id not in [ColumnId.MONTHLY, ColumnId.ANNUALLY]:
            return

        all_tasks = self.repository.get_all(user_id)
        column_tasks = [t for t in all_tasks if t.column_id == column_id]

        if column_id == ColumnId.MONTHLY:
            # Sort by target_day (None values at the end)
            sorted_tasks = sorted(
                column_tasks, key=lambda x: (x.target_day is None, x.target_day)
            )
        else:  # ANNUALLY
            # Sort by target_month, then target_day
            sorted_tasks = sorted(
                column_tasks,
                key=lambda x: (
                    x.target_month is None,
                    x.target_month,
                    x.target_day is None,
                    x.target_day,
                ),
            )

        # Apply the new order_index
        sorted_ids = [t.id for t in sorted_tasks if t.id is not None]
        self.repository.reorder_tasks(column_id, sorted_ids, user_id)


class ReminderService:
    """
    Application Service that orchestrates use cases for Reminders.
    """

    def __init__(self, repository: IReminderRepository):
        self.repository = repository

    def get_all_reminders(self, user_id: int) -> List[Reminder]:
        return self.repository.get_all(user_id)

    def get_reminder(self, reminder_id: int, user_id: int) -> Optional[Reminder]:
        return self.repository.get_by_id(reminder_id, user_id)

    def create_reminder(self, reminder_data: ReminderCreate, user_id: int) -> Reminder:
        return self.repository.create(reminder_data, user_id)

    def update_reminder(
        self, reminder_id: int, reminder_data: ReminderUpdate, user_id: int
    ) -> Optional[Reminder]:
        return self.repository.update(reminder_id, reminder_data, user_id)

    def delete_reminder(self, reminder_id: int, user_id: int) -> bool:
        return self.repository.delete(reminder_id, user_id)


class UserService:
    """
    Application Service for User-related operations (settings).
    """

    def __init__(self, repository):
        self.repository = repository

    def update_settings(
        self,
        user_id: int,
        start_time: str,
        end_time: str,
        language: str,
        timezone: Optional[str] = None,
    ) -> Optional[User]:
        return self.repository.update_settings(
            user_id, start_time, end_time, language, timezone
        )

    def confirm_period_resets(self, user_id: int, date_str: str) -> bool:
        """
        Updates the last_period_reset_date in the database.
        """
        return self.repository.update_last_reset_date(user_id, date_str)


class PomodoroService:
    """
    Application Service that orchestrates use cases for Pomodoro sessions.
    """

    def __init__(
        self,
        repository: IPomodoroRepository,
        push_service=None,
        user_repo=None,
    ):
        self.repository = repository
        self.push_service = push_service
        self.user_repo = user_repo

    def _get_user_tz(self, user_id: int):
        user = self.user_repo.get_by_id(user_id) if self.user_repo else None
        return get_user_zone(getattr(user, "timezone", None))

    def get_today_stats(self, user_id: int) -> PomodoroTodayStatsResponse:
        user_tz = self._get_user_tz(user_id)
        now_utc = datetime.now(timezone.utc)
        now_local = now_utc.astimezone(user_tz)
        today_str = now_local.strftime("%Y-%m-%d")

        sessions = self.repository.get_by_date(user_id, today_str)
        completed_today_count = sum(
            1 for s in sessions if s.status == PomodoroStatus.COMPLETED
        )
        interrupted_today_count = sum(
            1 for s in sessions if s.status == PomodoroStatus.INTERRUPTED
        )
        active_session = self.repository.get_active_for_user(user_id)

        return PomodoroTodayStatsResponse(
            date_str=today_str,
            completed_today_count=completed_today_count,
            interrupted_today_count=interrupted_today_count,
            active_session=active_session,
            today_sessions=sessions,
        )

    def start_focus(
        self, user_id: int, device_type: DeviceType = DeviceType.DESKTOP
    ) -> PomodoroSession:
        user_tz = self._get_user_tz(user_id)
        now_utc = datetime.now(timezone.utc)
        active = self.repository.get_active_for_user(user_id)
        if active:
            if active.status == PomodoroStatus.IN_PROGRESS:
                active.status = PomodoroStatus.INTERRUPTED
                active.interrupted_at = now_utc
                started_at = active.started_at
                if started_at and started_at.tzinfo is None:
                    started_at = started_at.replace(tzinfo=timezone.utc)
                active.elapsed_focus_seconds = (
                    max(0, int((now_utc - started_at).total_seconds()))
                    if started_at
                    else 0
                )
                active.timer_end_time = None
                active.phase = PomodoroPhase.DONE
                self.repository.update(active)
            elif active.phase == PomodoroPhase.BREAK:
                active.timer_end_time = None
                active.phase = PomodoroPhase.DONE
                self.repository.update(active)

        now_local = now_utc.astimezone(user_tz)
        new_session = PomodoroSession(
            user_id=user_id,
            status=PomodoroStatus.IN_PROGRESS,
            phase=PomodoroPhase.FOCUS,
            date_str=now_local.strftime("%Y-%m-%d"),
            year=now_local.year,
            month=now_local.month,
            day=now_local.day,
            hour_of_day=now_local.hour,
            started_at=now_utc,
            focus_duration_minutes=25,
            break_duration_minutes=5,
            elapsed_focus_seconds=0,
            is_manual=False,
            device_type=device_type,
            timer_end_time=now_utc + timedelta(minutes=25),
            notification_sent=False,
        )
        return self.repository.create(new_session)

    def complete_focus(
        self, pomodoro_id: int, user_id: int, from_timer: bool = False
    ) -> Optional[PomodoroSession]:
        session = self.repository.get_by_id(pomodoro_id, user_id)
        if not session:
            return None

        now_utc = datetime.now(timezone.utc)
        if session.status != PomodoroStatus.COMPLETED:
            session.status = PomodoroStatus.COMPLETED
            session.completed_at = now_utc
            session.elapsed_focus_seconds = 1500
            session.timer_end_time = None

        if from_timer and not session.notification_sent and self.push_service:
            lang = "en"
            if self.user_repo:
                user = self.user_repo.get_by_id(user_id)
                if user and getattr(user, "language", None) == "es":
                    lang = "es"
            title = "POMODORO"
            body = (
                "¡Tiempo de foco terminado! Toma un descanso de 5 minutos"
                if lang == "es"
                else "Focus time finished! Take a 5-minute break"
            )
            self.push_service.send_notification(
                user_id=user_id,
                title=title,
                body=body,
                data={"pomodoro_id": session.id, "type": "pomodoro_focus_end"},
                urgency="high",
            )
            session.notification_sent = True

        return self.repository.update(session)

    def start_break(self, pomodoro_id: int, user_id: int) -> Optional[PomodoroSession]:
        session = self.repository.get_by_id(pomodoro_id, user_id)
        if not session or session.status != PomodoroStatus.COMPLETED:
            return None

        now_utc = datetime.now(timezone.utc)
        session.phase = PomodoroPhase.BREAK
        session.timer_end_time = now_utc + timedelta(minutes=5)
        session.notification_sent = False
        return self.repository.update(session)

    def complete_break(
        self, pomodoro_id: int, user_id: int, from_timer: bool = False
    ) -> Optional[PomodoroSession]:
        session = self.repository.get_by_id(pomodoro_id, user_id)
        if not session:
            return None

        session.phase = PomodoroPhase.DONE
        session.timer_end_time = None

        if from_timer and not session.notification_sent and self.push_service:
            lang = "en"
            if self.user_repo:
                user = self.user_repo.get_by_id(user_id)
                if user and getattr(user, "language", None) == "es":
                    lang = "es"
            title = "POMODORO"
            body = (
                "¡Felicidades! Completaste tu Pomodoro y tu descanso"
                if lang == "es"
                else "Congratulations! You completed your Pomodoro and break"
            )
            self.push_service.send_notification(
                user_id=user_id,
                title=title,
                body=body,
                data={"pomodoro_id": session.id, "type": "pomodoro_break_end"},
                urgency="high",
            )
            session.notification_sent = True

        return self.repository.update(session)

    def interrupt_session(
        self,
        pomodoro_id: int,
        user_id: int,
        elapsed_seconds: Optional[int] = None,
    ) -> Optional[PomodoroSession]:
        session = self.repository.get_by_id(pomodoro_id, user_id)
        if not session:
            return None

        now_utc = datetime.now(timezone.utc)
        if (
            session.phase == PomodoroPhase.FOCUS
            and session.status == PomodoroStatus.IN_PROGRESS
        ):
            session.status = PomodoroStatus.INTERRUPTED
            session.interrupted_at = now_utc
            started_at = session.started_at
            if started_at and started_at.tzinfo is None:
                started_at = started_at.replace(tzinfo=timezone.utc)
            if elapsed_seconds is not None:
                session.elapsed_focus_seconds = elapsed_seconds
            else:
                session.elapsed_focus_seconds = (
                    max(0, int((now_utc - started_at).total_seconds()))
                    if started_at
                    else 0
                )
            session.timer_end_time = None
            session.phase = PomodoroPhase.DONE
        elif session.phase == PomodoroPhase.BREAK:
            session.phase = PomodoroPhase.DONE
            session.timer_end_time = None

        return self.repository.update(session)

    def log_manual_pomodoro(
        self,
        user_id: int,
        hour_of_day: int,
        device_type: DeviceType = DeviceType.DESKTOP,
    ) -> PomodoroSession:
        user_tz = self._get_user_tz(user_id)
        now_utc = datetime.now(timezone.utc)
        now_local = now_utc.astimezone(user_tz)

        manual_local = datetime(
            now_local.year,
            now_local.month,
            now_local.day,
            hour_of_day,
            0,
            0,
            tzinfo=user_tz,
        )
        manual_utc = manual_local.astimezone(timezone.utc)

        session = PomodoroSession(
            user_id=user_id,
            status=PomodoroStatus.COMPLETED,
            phase=PomodoroPhase.DONE,
            date_str=now_local.strftime("%Y-%m-%d"),
            year=now_local.year,
            month=now_local.month,
            day=now_local.day,
            hour_of_day=hour_of_day,
            started_at=manual_utc,
            completed_at=manual_utc + timedelta(minutes=25),
            focus_duration_minutes=25,
            break_duration_minutes=5,
            elapsed_focus_seconds=1500,
            is_manual=True,
            device_type=device_type,
            timer_end_time=None,
            notification_sent=False,
        )
        return self.repository.create(session)

    def delete_manual_pomodoro(self, pomodoro_id: int, user_id: int) -> bool:
        session = self.repository.get_by_id(pomodoro_id, user_id)
        if not session or not session.is_manual:
            return False
        return self.repository.delete(pomodoro_id, user_id)
