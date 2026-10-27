import logging
from datetime import datetime, timedelta, timezone
from typing import List
from sqlmodel import Session, select
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from src.domain.models import (
    ColumnId,
    User,
    Task,
    PomodoroSession,
    PomodoroStatus,
    PomodoroPhase,
)
from src.infrastructure.database import engine

from src.infrastructure.sqlite_repository import (
    SQLiteReminderRepository,
    SQLiteUserRepository,
    SQLiteTaskRepository,
    SQLitePushSubscriptionRepository,
    SQLitePomodoroRepository,
)
from src.application.push_service import PushService
from src.core.timezone import get_user_zone

logger = logging.getLogger(__name__)


class ReminderScheduler:
    def __init__(self):
        # We no longer store a push_service here to avoid stale sessions
        self.scheduler = AsyncIOScheduler()

    def datetime_now(self):
        return datetime.now(timezone.utc)

    def start(self):
        # Timers are time-critical: check every 5 seconds for precise delivery
        self.scheduler.add_job(
            self._check_all_active_timers,
            "interval",
            seconds=5,
            id="timer_check",
            coalesce=True,
            max_instances=1,
            misfire_grace_time=30,
        )
        # Reminders use slot-based logic: 1-minute granularity is sufficient
        self.scheduler.add_job(
            self._check_all_user_reminders,
            "interval",
            minutes=1,
            id="reminder_check",
            coalesce=True,
            max_instances=1,
            misfire_grace_time=60,
        )
        self.scheduler.start()
        logger.info("Reminder Scheduler started")

    def schedule_exact_timer(self, task_id: int, end_time: datetime):
        """Schedules an exact one-shot check at the timer's expiration timestamp."""
        if not self.scheduler.running:
            return
        run_date = end_time
        if run_date.tzinfo is None:
            run_date = run_date.replace(tzinfo=timezone.utc)
        self.scheduler.add_job(
            self._check_all_active_timers,
            "date",
            run_date=run_date,
            id=f"timer_task_{task_id}",
            replace_existing=True,
            misfire_grace_time=30,
        )

    def cancel_exact_timer(self, task_id: int):
        """Removes a scheduled one-shot timer job if the timer was stopped early."""
        job_id = f"timer_task_{task_id}"
        if self.scheduler.running and self.scheduler.get_job(job_id):
            self.scheduler.remove_job(job_id)

    def schedule_exact_pomodoro(self, pomodoro_id: int, end_time: datetime):
        """Schedules an exact one-shot check at the pomodoro timer's expiration timestamp."""
        if not self.scheduler.running:
            return
        run_date = end_time
        if run_date.tzinfo is None:
            run_date = run_date.replace(tzinfo=timezone.utc)
        self.scheduler.add_job(
            self._check_all_active_timers,
            "date",
            run_date=run_date,
            id=f"pomodoro_{pomodoro_id}",
            replace_existing=True,
            misfire_grace_time=30,
        )

    def cancel_exact_pomodoro(self, pomodoro_id: int):
        """Removes a scheduled one-shot pomodoro job if stopped early."""
        job_id = f"pomodoro_{pomodoro_id}"
        if self.scheduler.running and self.scheduler.get_job(job_id):
            self.scheduler.remove_job(job_id)

    def shutdown(self):
        self.scheduler.shutdown()
        logger.info("Reminder Scheduler stopped")

    async def _check_all_active_timers(self):
        """Fast loop (every 5s) — checks focus timers and pomodoro sessions."""
        with Session(engine) as session:
            user_repo = SQLiteUserRepository(session)
            task_repo = SQLiteTaskRepository(session)
            push_repo = SQLitePushSubscriptionRepository(session)
            pomodoro_repo = SQLitePomodoroRepository(session)
            push_service = PushService(push_repo)

            users = user_repo.get_all()
            for user in users:
                try:
                    await self._check_active_timers(user, task_repo, push_service)
                except Exception as exc:
                    logger.error(
                        f"Error checking active timers for user {user.id}: {exc}"
                    )

            try:
                await self._check_active_pomodoros(
                    user_repo, pomodoro_repo, push_service
                )
            except Exception as exc:
                logger.error(f"Error checking active pomodoros: {exc}")

    async def _check_all_user_reminders(self):
        """Standard loop (every 60s) — checks interval and task-linked reminders."""
        with Session(engine) as session:
            user_repo = SQLiteUserRepository(session)
            reminder_repo = SQLiteReminderRepository(session)
            task_repo = SQLiteTaskRepository(session)
            push_repo = SQLitePushSubscriptionRepository(session)
            push_service = PushService(push_repo)

            users = user_repo.get_all()
            for user in users:
                try:
                    await self._check_user_reminders(
                        user, reminder_repo, task_repo, push_service
                    )
                except Exception as exc:
                    logger.error(f"Error checking reminders for user {user.id}: {exc}")

    async def check_all_reminders(self):
        """Combined check for both timers and reminders (used by tests)."""
        await self._check_all_active_timers()
        await self._check_all_user_reminders()

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
                results = push_service.send_notification(
                    user_id=user.id,
                    title="RECUERDA",
                    body=f"Timer finalizado: {task.title}",
                    data={"task_id": task.id, "type": "timer_end"},
                    urgency="high",
                )

                # Retry on next cycle if all subscriptions failed due to transient network error
                has_transient_failure = (
                    isinstance(results, list)
                    and len(results) > 0
                    and all(
                        "error" in r and r.get("error") != "No subscriptions"
                        for r in results
                    )
                    and (now_utc - end_time) < timedelta(minutes=2)
                )
                if has_transient_failure:
                    logger.warning(
                        f"Transient push failure for timer on task {task.id}; will retry next tick."
                    )
                    continue

                task.timer_triggered = True
                task.completed = True
                task_repo.session.add(task)
                task_repo.session.commit()
                task_repo.log_completion(task, is_retroactive=False)

    async def _check_active_pomodoros(
        self,
        user_repo: SQLiteUserRepository,
        pomodoro_repo: SQLitePomodoroRepository,
        push_service: PushService,
    ):
        """Check for active pomodoro sessions with High Urgency."""
        now_utc = self.datetime_now()
        statement = select(PomodoroSession).where(
            PomodoroSession.timer_end_time.is_not(None),  # noqa: E711
            PomodoroSession.notification_sent == False,  # noqa: E712
        )
        sessions = pomodoro_repo.session.exec(statement).all()

        for pom_session in sessions:
            end_time = pom_session.timer_end_time
            if end_time.tzinfo is None:
                end_time = end_time.replace(tzinfo=timezone.utc)

            if now_utc >= end_time:
                user = user_repo.get_by_id(pom_session.user_id)
                user_lang = getattr(user, "language", "en") if user else "en"

                if pom_session.phase == PomodoroPhase.FOCUS:
                    title = "POMODORO"
                    body = (
                        "¡Tiempo de foco terminado! Toma un descanso de 5 minutos"
                        if user_lang == "es"
                        else "Focus time finished! Take a 5-minute break"
                    )
                    push_service.send_notification(
                        user_id=pom_session.user_id,
                        title=title,
                        body=body,
                        data={
                            "pomodoro_id": pom_session.id,
                            "type": "pomodoro_focus_end",
                        },
                        urgency="high",
                    )
                    pom_session.status = PomodoroStatus.COMPLETED
                    pom_session.completed_at = now_utc
                    pom_session.elapsed_focus_seconds = 1500
                    pom_session.timer_end_time = None
                    pom_session.notification_sent = True
                    pomodoro_repo.session.add(pom_session)
                    pomodoro_repo.session.commit()

                elif pom_session.phase == PomodoroPhase.BREAK:
                    title = "POMODORO"
                    body = (
                        "¡Felicidades! Completaste tu Pomodoro y tu descanso"
                        if user_lang == "es"
                        else "Congratulations! You completed your Pomodoro and break"
                    )
                    push_service.send_notification(
                        user_id=pom_session.user_id,
                        title=title,
                        body=body,
                        data={
                            "pomodoro_id": pom_session.id,
                            "type": "pomodoro_break_end",
                        },
                        urgency="high",
                    )
                    pom_session.phase = PomodoroPhase.DONE
                    pom_session.timer_end_time = None
                    pom_session.notification_sent = True
                    pomodoro_repo.session.add(pom_session)
                    pomodoro_repo.session.commit()

    async def _check_user_reminders(
        self,
        user: User,
        reminder_repo: SQLiteReminderRepository,
        task_repo: SQLiteTaskRepository,
        push_service: PushService,
    ):
        user_tz = get_user_zone(getattr(user, "timezone", None))
        now_utc = self.datetime_now()
        if now_utc.tzinfo is None:
            now_utc = now_utc.replace(tzinfo=timezone.utc)
        now_local = now_utc.astimezone(user_tz)
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
                    user,
                    reminder,
                    task_repo,
                    current_str,
                    today_date,
                    user_tz,
                    push_service,
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
                urgency="high",
            )
            reminder.last_triggered_at = now_utc
            reminder_repo.session.add(reminder)
            reminder_repo.session.commit()

    async def _handle_task_reminder(
        self,
        user,
        reminder,
        task_repo,
        current_str,
        today_date,
        user_tz,
        push_service,
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
                    last_triggered_local = last_triggered.astimezone(user_tz)
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
