import logging
from datetime import datetime, timedelta, timezone
from typing import List
from sqlmodel import Session, select
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from src.domain.models import ColumnId, User, Task
from src.infrastructure.database import engine

from src.infrastructure.sqlite_repository import (
    SQLiteReminderRepository,
    SQLiteUserRepository,
    SQLiteTaskRepository,
    SQLitePushSubscriptionRepository,
)
from src.application.push_service import PushService

logger = logging.getLogger(__name__)


class ReminderScheduler:
    def __init__(self):
        # We no longer store a push_service here to avoid stale sessions
        self.scheduler = AsyncIOScheduler()

    def datetime_now(self):
        return datetime.now(timezone.utc)

    def start(self):
        self.scheduler.add_job(self.check_all_reminders, "interval", minutes=1)
        self.scheduler.start()
        logger.info("Reminder Scheduler started")

    def shutdown(self):
        self.scheduler.shutdown()
        logger.info("Reminder Scheduler stopped")

    async def check_all_reminders(self):
        # We create a fresh session and fresh repositories for EVERY cycle
        with Session(engine) as session:
            user_repo = SQLiteUserRepository(session)
            reminder_repo = SQLiteReminderRepository(session)
            task_repo = SQLiteTaskRepository(session)
            push_repo = SQLitePushSubscriptionRepository(session)

            # Create a localized PushService for this session
            push_service = PushService(push_repo)

            users = user_repo.get_all()
            for user in users:
                # 1. Standard Reminders (Window checked inside)
                await self._check_user_reminders(
                    user, reminder_repo, task_repo, push_service
                )

                # 2. Focus Timers (Urgency: High, No window check)
                await self._check_active_timers(user, task_repo, push_service)

    async def _check_active_timers(
        self, user: User, task_repo: SQLiteTaskRepository, push_service: PushService
    ):
        """Check for focus timers with High Urgency."""
        now_utc = self.datetime_now()
        statement = select(Task).where(
            Task.user_id == user.id,
            Task.timer_end_time.is_not(None),  # noqa: E711
            Task.timer_triggered == False,  # noqa: E712
            Task.completed == False,  # noqa: E712
        )
        active_tasks_with_timers = task_repo.session.exec(statement).all()

        for task in active_tasks_with_timers:
            end_time = task.timer_end_time
            if end_time.tzinfo is None:
                end_time = end_time.replace(tzinfo=timezone.utc)

            if now_utc >= end_time:
                # HIGH URGENCY to bypass Android Doze mode
                push_service.send_notification(
                    user_id=user.id,
                    title="RECUERDA",
                    body=f"Timer finalizado: {task.title}",
                    data={"task_id": task.id, "type": "timer_end"},
                    urgency="high",
                )

                task.timer_triggered = True
                task.completed = True
                task_repo.session.add(task)
                task_repo.session.commit()

    async def _check_user_reminders(
        self,
        user: User,
        reminder_repo: SQLiteReminderRepository,
        task_repo: SQLiteTaskRepository,
        push_service: PushService,
    ):
        now_utc = self.datetime_now()
        now_local = now_utc - timedelta(hours=5)
        current_str = now_local.strftime("%H:%M")
        today_date = now_local.date()

        if current_str < user.day_start_time or current_str > user.day_end_time:
            return

        reminders = reminder_repo.get_all(user.id)
        for reminder in reminders:
            if not reminder.is_active:
                continue

            if reminder.task_id:
                await self._handle_task_reminder(
                    user, reminder, task_repo, current_str, today_date, push_service
                )
            else:
                await self._handle_interval_reminder(
                    user, reminder, reminder_repo, now_utc, push_service
                )

    async def _handle_interval_reminder(
        self, user, reminder, reminder_repo, now_utc, push_service
    ):
        if now_utc.tzinfo is None:
            now_utc = now_utc.replace(tzinfo=timezone.utc)

        last_time = reminder.last_triggered_at
        if last_time:
            if last_time.tzinfo is None:
                last_time = last_time.replace(tzinfo=timezone.utc)
            diff_minutes = (now_utc - last_time).total_seconds() / 60
        else:
            diff_minutes = 999999

        if diff_minutes >= (reminder.interval_minutes - 0.16):
            push_service.send_notification(
                user_id=user.id,
                title="RECUERDA",
                body=reminder.title,
                data={"reminder_id": reminder.id},
                urgency="normal",
            )
            reminder.last_triggered_at = now_utc
            reminder_repo.session.add(reminder)
            reminder_repo.session.commit()

    async def _handle_task_reminder(
        self, user, reminder, task_repo, current_str, today_date, push_service
    ):
        task = task_repo.get_by_id(reminder.task_id, user.id)
        if not task or task.completed:
            return

        is_due_today = False
        if task.column_id == ColumnId.MONTHLY and task.target_day == today_date.day:
            is_due_today = True
        elif (
            task.column_id == ColumnId.ANNUALLY
            and task.target_day == today_date.day
            and task.target_month == today_date.month
        ):
            is_due_today = True

        if not is_due_today:
            return

        slots = self._calculate_slots(user.day_start_time, user.day_end_time)
        for index, slot_time in enumerate(slots):
            if current_str >= slot_time:
                last_triggered = reminder.last_triggered_at
                if last_triggered:
                    if last_triggered.tzinfo is None:
                        last_triggered = last_triggered.replace(tzinfo=timezone.utc)
                    last_triggered_local = last_triggered - timedelta(hours=5)
                    if (
                        last_triggered_local.date() == today_date
                        and last_triggered_local.strftime("%H:%M") >= slot_time
                    ):
                        continue

                push_service.send_notification(
                    user_id=user.id,
                    title="RECUERDA",
                    body=reminder.title,
                    data={
                        "task_id": task.id,
                        "slot_index": index,
                        "reminder_id": reminder.id,
                    },
                    urgency="normal",
                )

                # Fix: Define now_utc here
                now_utc = self.datetime_now()
                reminder.last_triggered_at = now_utc
                task_repo.session.add(reminder)
                task_repo.session.commit()
                break

    def _calculate_slots(self, start: str, end: str) -> List[str]:
        h_start, m_start = map(int, start.split(":"))
        h_end, m_end = map(int, end.split(":"))
        start_min, end_min = h_start * 60 + m_start, h_end * 60 + m_end
        duration = end_min - start_min

        def format_min(m):
            return f"{m // 60:02d}:{m % 60:02d}"

        return [
            start,
            format_min(start_min + duration // 2),
            format_min(end_min - 30),
        ]
