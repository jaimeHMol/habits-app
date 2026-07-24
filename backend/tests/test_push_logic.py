import pytest
from datetime import datetime, timedelta, timezone
from sqlmodel import Session, select
from src.domain.models import Reminder, Task, User
from src.infrastructure.database import engine
from src.application.reminder_scheduler import ReminderScheduler
from unittest.mock import patch


@pytest.fixture(autouse=True)
def clean_reminders():
    """Ensure no reminders or timer tasks are left from other tests."""
    with Session(engine) as session:
        for r in session.exec(select(Reminder)).all():
            session.delete(r)
        for t in session.exec(
            select(Task).where(Task.timer_end_time.is_not(None))  # noqa: E711
        ).all():
            session.delete(t)
        session.commit()


@pytest.fixture
def db_session():
    with Session(engine) as session:
        yield session


@pytest.mark.asyncio
async def test_scheduler_triggers_interval_reminder(db_session):
    # Setup scheduler
    scheduler = ReminderScheduler()

    user_id_ts = int(datetime.now().timestamp())
    user = User(
        username=f"testuser_{user_id_ts}",
        hashed_password="pw",
        full_name="Test",
        day_start_time="00:00",
        day_end_time="23:59",
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)

    # Create reminder with last_triggered_at 2 hours ago (interval is 60 min)
    now_utc_naive = datetime.now(timezone.utc).replace(tzinfo=None)
    two_hours_ago = now_utc_naive - timedelta(hours=2)
    reminder = Reminder(
        title="Test Push",
        interval_minutes=60,
        isActive=True,  # Note the field name in current implementation
        user_id=user.id,
        last_triggered_at=two_hours_ago,
    )
    db_session.add(reminder)
    db_session.commit()
    db_session.refresh(reminder)

    # Mock time to exactly NOW (naive UTC)
    mock_now = now_utc_naive

    # We need to mock PushService at the point of instantiation in the loop
    with patch("src.application.reminder_scheduler.PushService") as MockPushService:
        mock_push = MockPushService.return_value
        with patch.object(ReminderScheduler, "datetime_now", return_value=mock_now):
            await scheduler.check_all_reminders()

        # Verify push was sent
        mock_push.send_notification.assert_any_call(
            user_id=user.id,
            title="RECUERDA",
            body="Test Push",
            data={"reminder_id": reminder.id},
            urgency="high",
        )

    db_session.refresh(reminder)
    assert reminder.last_triggered_at is not None


@pytest.mark.asyncio
async def test_scheduler_respects_activity_window(db_session):
    scheduler = ReminderScheduler()

    user_id_ts = int(datetime.now().timestamp()) + 1
    user = User(
        username=f"nightuser_{user_id_ts}",
        hashed_password="pw",
        full_name="Night",
        day_start_time="08:00",
        day_end_time="20:00",
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)

    now_utc_naive = datetime.now(timezone.utc).replace(tzinfo=None)
    reminder = Reminder(
        title="Night Push",
        interval_minutes=60,
        is_active=True,
        user_id=user.id,
        last_triggered_at=now_utc_naive - timedelta(hours=5),
    )
    db_session.add(reminder)
    db_session.commit()

    # 04:00 AM Bogota (09:00 UTC) -> Outside 08:00 window
    mock_now = now_utc_naive.replace(hour=9, minute=0, second=0, microsecond=0)

    with patch("src.application.reminder_scheduler.PushService") as MockPushService:
        mock_push = MockPushService.return_value
        with patch.object(ReminderScheduler, "datetime_now", return_value=mock_now):
            await scheduler.check_all_reminders()

        # Should NOT have called push for THIS user
        for call in mock_push.send_notification.call_args_list:
            assert call.kwargs["user_id"] != user.id


@pytest.mark.asyncio
async def test_scheduler_triggers_timer_with_high_urgency(db_session):
    """Timer notifications must use urgency='high' to bypass Android Doze mode."""
    scheduler = ReminderScheduler()

    user_id_ts = int(datetime.now().timestamp()) + 2
    user = User(
        username=f"timeruser_{user_id_ts}",
        hashed_password="pw",
        full_name="Timer",
        day_start_time="00:00",
        day_end_time="23:59",
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)

    # Create a task with an expired timer (ended 2 minutes ago)
    # Timer stored in DB is naive, but datetime_now() returns aware (UTC)
    now_utc = datetime.now(timezone.utc)
    task = Task(
        title="Read 10 minutes",
        column_id="daily",
        user_id=user.id,
        timer_end_time=now_utc.replace(tzinfo=None) - timedelta(minutes=2),
        timer_triggered=False,
        completed=False,
    )
    db_session.add(task)
    db_session.commit()
    db_session.refresh(task)

    with patch("src.application.reminder_scheduler.PushService") as MockPushService:
        mock_push = MockPushService.return_value
        with patch.object(ReminderScheduler, "datetime_now", return_value=now_utc):
            await scheduler.check_all_reminders()

        # Verify push was sent with HIGH urgency
        mock_push.send_notification.assert_any_call(
            user_id=user.id,
            title="RECUERDA",
            body=f"Timer finalizado: {task.title}",
            data={"task_id": task.id, "type": "timer_end"},
            urgency="high",
        )

    # Verify the task was marked as completed and triggered
    db_session.refresh(task)
    assert task.timer_triggered is True
    assert task.completed is True


@pytest.mark.asyncio
async def test_scheduler_does_not_trigger_untriggered_timer(db_session):
    """Timer that hasn't expired yet should NOT send a notification."""
    scheduler = ReminderScheduler()

    user_id_ts = int(datetime.now().timestamp()) + 3
    user = User(
        username=f"futureuser_{user_id_ts}",
        hashed_password="pw",
        full_name="Future",
        day_start_time="00:00",
        day_end_time="23:59",
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)

    # Create a task with a timer that ends in 5 minutes (not expired yet)
    now_utc = datetime.now(timezone.utc)
    task = Task(
        title="Future timer",
        column_id="daily",
        user_id=user.id,
        timer_end_time=now_utc.replace(tzinfo=None) + timedelta(minutes=5),
        timer_triggered=False,
        completed=False,
    )
    db_session.add(task)
    db_session.commit()
    db_session.refresh(task)

    with patch("src.application.reminder_scheduler.PushService") as MockPushService:
        mock_push = MockPushService.return_value
        with patch.object(ReminderScheduler, "datetime_now", return_value=now_utc):
            await scheduler.check_all_reminders()

        # Should NOT have sent any notification for this task
        for call in mock_push.send_notification.call_args_list:
            if "data" in call.kwargs:
                assert call.kwargs["data"].get("task_id") != task.id

    # Task should remain uncompleted
    db_session.refresh(task)
    assert task.timer_triggered is False
    assert task.completed is False
