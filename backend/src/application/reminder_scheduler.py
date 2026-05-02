import logging
from datetime import datetime, timedelta, timezone
from typing import List
from sqlmodel import Session
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from src.domain.models import ColumnId, Reminder, User
from src.infrastructure.database import engine
from src.infrastructure.sqlite_repository import (
    SQLiteReminderRepository,
    SQLiteUserRepository,
    SQLiteTaskRepository,
)
from src.application.push_service import PushService

logger = logging.getLogger(__name__)


class ReminderScheduler:
    def __init__(self, push_service: PushService):
        self.push_service = push_service
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
        # We create a new session for each background check
        with Session(engine) as session:
            user_repo = SQLiteUserRepository(session)
            reminder_repo = SQLiteReminderRepository(session)
            task_repo = SQLiteTaskRepository(session)

            users = user_repo.get_all()
            for user in users:
                await self._check_user_reminders(user, reminder_repo, task_repo)

    async def _check_user_reminders(
        self,
        user: User,
        reminder_repo: SQLiteReminderRepository,
        task_repo: SQLiteTaskRepository,
    ):
        # Currently, the app works in America/Bogota as per ReminderEngine.jsx
        # For a truly global app, we should use the user's timezone.
        # For now, let's keep it consistent with the frontend (approximate with UTC-5)
        # In a real scenario, we'd use pytz and user.timezone
        now_utc = self.datetime_now()
        now_local = now_utc - timedelta(hours=5)
        current_str = now_local.strftime("%H:%M")
        today_date = now_local.date()

        # Check if within activity window
        if current_str < user.day_start_time or current_str > user.day_end_time:
            return

        reminders = reminder_repo.get_all(user.id)
        for reminder in reminders:
            if not reminder.is_active:
                continue

            if reminder.task_id:
                # Logic B: Slot-based
                await self._handle_task_reminder(
                    user, reminder, task_repo, current_str, today_date
                )
            else:
                # Logic A: Interval-based
                await self._handle_interval_reminder(
                    user, reminder, reminder_repo, now_utc
                )

    async def _handle_interval_reminder(
        self,
        user: User,
        reminder: Reminder,
        reminder_repo: SQLiteReminderRepository,
        now_utc: datetime,
    ):
        if now_utc.tzinfo is None:
            now_utc = now_utc.replace(tzinfo=timezone.utc)

        last_time = reminder.last_triggered_at
        if last_time:
            if last_time.tzinfo is None:
                last_time = last_time.replace(tzinfo=timezone.utc)
            diff_minutes = (now_utc - last_time).total_seconds() / 60
        else:
            diff_minutes = 999999  # First time

        # Give a small 10-second margin (0.16 min) to avoid missing cycles due to millisecond delays
        if diff_minutes >= (reminder.interval_minutes - 0.16):
            self.push_service.send_notification(
                user_id=user.id,
                title="RECUERDA",
                body=reminder.title,
                data={"reminder_id": reminder.id},
            )
            # Update last_triggered_at
            reminder_repo.update(
                reminder.id, Reminder(last_triggered_at=now_utc), user.id
            )

    async def _handle_task_reminder(
        self,
        user: User,
        reminder: Reminder,
        task_repo: SQLiteTaskRepository,
        current_str: str,
        today_date: datetime.date,
    ):
        task = task_repo.get_by_id(reminder.task_id, user.id)
        if not task or task.completed:
            return

        # Check if due today
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

        # In the backend, we need to track if we already sent for this slot TODAY.
        # We can use last_triggered_at's DATE to see if it was already sent today.
        # However, there are 3 slots. To be precise, we'd need more state.
        # Simple approach: If current_str is >= slot_time AND last_triggered_at was NOT in this slot range today.

        for index, slot_time in enumerate(slots):
            if current_str >= slot_time:
                # Check if we already sent a push for this specific slot today
                # We'll use a naming convention for the "data" or just check if last_triggered_at is close to this slot

                # To avoid complex state, let's see if last_triggered_at was today
                # AND if it was after the start of this slot but before the next one (if any)
                last_triggered = reminder.last_triggered_at
                if last_triggered:
                    if last_triggered.tzinfo is None:
                        last_triggered = last_triggered.replace(tzinfo=timezone.utc)

                    # Bogota is UTC-5
                    last_triggered_local = last_triggered - timedelta(hours=5)

                    if last_triggered_local.date() == today_date:
                        last_triggered_str = last_triggered_local.strftime("%H:%M")
                        # If we already triggered today after this slot_time, we skip
                        if last_triggered_str >= slot_time:
                            continue

                # Trigger Push
                self.push_service.send_notification(
                    user_id=user.id,
                    title="RECUERDA",
                    body=reminder.title,
                    data={
                        "task_id": task.id,
                        "slot_index": index,
                        "reminder_id": reminder.id,
                    },
                )

                # Update last_triggered_at
                now_utc = datetime.now(timezone.utc)
                # We need a direct update here because reminder_repo.update expects ReminderUpdate or similar
                # but we want to be surgical. Let's use the session directly for speed or repo.
                reminder.last_triggered_at = now_utc
                # We need to commit the session
                task_repo.session.add(reminder)
                task_repo.session.commit()
                break  # Only trigger one slot at a time

    def _calculate_slots(self, start: str, end: str) -> List[str]:
        h_start, m_start = map(int, start.split(":"))
        h_end, m_end = map(int, end.split(":"))

        start_min = h_start * 60 + m_start
        end_min = h_end * 60 + m_end
        duration = end_min - start_min

        def format_min(total_min):
            h = total_min // 60
            m = total_min % 60
            return f"{h:02d}:{m:02d}"

        return [start, format_min(start_min + duration // 2), format_min(end_min - 30)]
