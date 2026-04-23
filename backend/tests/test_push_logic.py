import pytest
from datetime import datetime, timedelta, timezone
from sqlmodel import Session, select
from src.domain.models import Reminder, User
from src.infrastructure.database import engine
from src.application.reminder_scheduler import ReminderScheduler
from src.application.push_service import PushService
from unittest.mock import MagicMock, patch


@pytest.fixture(autouse=True)
def clean_reminders():
    """Ensure no reminders are left from other tests."""
    with Session(engine) as session:
        statement = select(Reminder)
        results = session.exec(statement).all()
        for r in results:
            session.delete(r)
        session.commit()


@pytest.fixture
def db_session():
    with Session(engine) as session:
        yield session


@pytest.mark.asyncio
async def test_scheduler_triggers_interval_reminder(db_session):
    mock_push = MagicMock(spec=PushService)
    scheduler = ReminderScheduler(mock_push)

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
        is_active=True,
        user_id=user.id,
        last_triggered_at=two_hours_ago,
    )
    db_session.add(reminder)
    db_session.commit()
    db_session.refresh(reminder)

    # Mock time to exactly NOW (naive UTC)
    mock_now = now_utc_naive

    with patch.object(ReminderScheduler, "datetime_now", return_value=mock_now):
        await scheduler.check_all_reminders()

    # Use assert_any_call to ignore calls for other users if they somehow persisted
    mock_push.send_notification.assert_any_call(
        user_id=user.id, title="RECUERDA", body="Test Push"
    )

    db_session.refresh(reminder)
    assert reminder.last_triggered_at is not None


@pytest.mark.asyncio
async def test_scheduler_respects_activity_window(db_session):
    mock_push = MagicMock(spec=PushService)
    scheduler = ReminderScheduler(mock_push)

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

    with patch.object(ReminderScheduler, "datetime_now", return_value=mock_now):
        await scheduler.check_all_reminders()

    # Should NOT have called push for THIS user
    for call in mock_push.send_notification.call_args_list:
        assert call.kwargs["user_id"] != user.id
