import pytest
from datetime import datetime, timedelta, timezone
from unittest.mock import patch
from fastapi.testclient import TestClient
from sqlmodel import Session
from src.domain.models import (
    PomodoroSession,
    PomodoroStatus,
    PomodoroPhase,
    DeviceType,
    User,
)
from src.application.reminder_scheduler import ReminderScheduler
from src.infrastructure.database import engine


def test_start_and_complete_pomodoro_cycle(client: TestClient):
    """
    Test full lifecycle:
    Start focus (25m) -> Complete focus -> Start break (5m) -> Complete break.
    """
    # 1. Start Pomodoro (Focus)
    start_res = client.post(
        "/pomodoros/start",
        json={"device_type": DeviceType.DESKTOP.value},
    )
    assert start_res.status_code == 201
    data = start_res.json()
    pomodoro_id = data["id"]
    assert data["status"] == PomodoroStatus.IN_PROGRESS.value
    assert data["phase"] == PomodoroPhase.FOCUS.value
    assert data["focus_duration_minutes"] == 25
    assert data["break_duration_minutes"] == 5
    assert data["timer_end_time"] is not None

    # Check stats - active session should be this one
    stats_res = client.get("/pomodoros/today")
    assert stats_res.status_code == 200
    stats = stats_res.json()
    assert stats["active_session"] is not None
    assert stats["active_session"]["id"] == pomodoro_id
    assert stats["completed_today_count"] == 0

    # 2. Complete Focus
    focus_res = client.post(f"/pomodoros/{pomodoro_id}/complete-focus")
    assert focus_res.status_code == 200
    focus_data = focus_res.json()
    assert focus_data["status"] == PomodoroStatus.COMPLETED.value
    assert focus_data["phase"] == PomodoroPhase.FOCUS.value
    assert focus_data["elapsed_focus_seconds"] == 1500
    assert focus_data["timer_end_time"] is None

    # 3. Start Break
    break_res = client.post(f"/pomodoros/{pomodoro_id}/start-break")
    assert break_res.status_code == 200
    break_data = break_res.json()
    assert break_data["phase"] == PomodoroPhase.BREAK.value
    assert break_data["timer_end_time"] is not None

    # 4. Complete Break
    done_res = client.post(f"/pomodoros/{pomodoro_id}/complete-break")
    assert done_res.status_code == 200
    done_data = done_res.json()
    assert done_data["phase"] == PomodoroPhase.DONE.value
    assert done_data["timer_end_time"] is None

    # Stats after completion
    stats_after = client.get("/pomodoros/today").json()
    assert stats_after["completed_today_count"] == 1
    assert stats_after["active_session"] is None


def test_interrupt_focus_vs_interrupt_break(client: TestClient):
    """
    Test that interrupting during focus sets status=INTERRUPTED,
    while interrupting during break retains status=COMPLETED.
    """
    # 1. Start Pomodoro and interrupt during FOCUS
    start_res = client.post("/pomodoros/start")
    pom_id_1 = start_res.json()["id"]

    int_res_1 = client.post(
        f"/pomodoros/{pom_id_1}/interrupt",
        json={"elapsed_seconds": 600},
    )
    assert int_res_1.status_code == 200
    data_1 = int_res_1.json()
    assert data_1["status"] == PomodoroStatus.INTERRUPTED.value
    assert data_1["phase"] == PomodoroPhase.DONE.value
    assert data_1["elapsed_focus_seconds"] == 600
    assert data_1["interrupted_at"] is not None
    assert data_1["timer_end_time"] is None

    # 2. Start new Pomodoro, complete focus, start break, then interrupt
    start_res_2 = client.post("/pomodoros/start")
    pom_id_2 = start_res_2.json()["id"]
    client.post(f"/pomodoros/{pom_id_2}/complete-focus")
    client.post(f"/pomodoros/{pom_id_2}/start-break")

    int_res_2 = client.post(f"/pomodoros/{pom_id_2}/interrupt")
    assert int_res_2.status_code == 200
    data_2 = int_res_2.json()
    # Should still be COMPLETED because focus succeeded!
    assert data_2["status"] == PomodoroStatus.COMPLETED.value
    assert data_2["phase"] == PomodoroPhase.DONE.value
    assert data_2["timer_end_time"] is None


def test_starting_new_pomodoro_interrupts_previous_active_session(
    client: TestClient,
):
    """
    If a user starts a new pomodoro while one is running, the previous one
    is automatically marked as INTERRUPTED.
    """
    res1 = client.post("/pomodoros/start")
    pom_id_1 = res1.json()["id"]

    res2 = client.post("/pomodoros/start")
    pom_id_2 = res2.json()["id"]
    assert pom_id_1 != pom_id_2

    # Check that pom_id_1 was interrupted
    stats = client.get("/pomodoros/today").json()
    interrupted_session = next(
        (s for s in stats["today_sessions"] if s["id"] == pom_id_1), None
    )
    assert interrupted_session is not None
    assert interrupted_session["status"] == PomodoroStatus.INTERRUPTED.value


def test_manual_pomodoro_creation_and_deletion(client: TestClient):
    """
    Test logging a manual pomodoro with hour_of_day, ensuring minutes and seconds
    are 00:00, and deleting it.
    """
    manual_res = client.post(
        "/pomodoros/manual",
        json={"hour_of_day": 14, "device_type": DeviceType.MOBILE.value},
    )
    assert manual_res.status_code == 201
    data = manual_res.json()
    assert data["is_manual"] is True
    assert data["status"] == PomodoroStatus.COMPLETED.value
    assert data["phase"] == PomodoroPhase.DONE.value
    assert data["hour_of_day"] == 14
    assert data["device_type"] == DeviceType.MOBILE.value

    # Validate started_at timestamp has 0 minutes and 0 seconds
    started_dt = datetime.fromisoformat(data["started_at"].replace("Z", "+00:00"))
    assert started_dt.minute == 0
    assert started_dt.second == 0

    # Verify stats
    stats = client.get("/pomodoros/today").json()
    assert stats["completed_today_count"] >= 1

    # Delete manual pomodoro
    del_res = client.delete(f"/pomodoros/{data['id']}")
    assert del_res.status_code == 204

    # Non-manual pomodoros cannot be deleted via this endpoint
    start_res = client.post("/pomodoros/start")
    regular_id = start_res.json()["id"]
    del_reg_res = client.delete(f"/pomodoros/{regular_id}")
    assert del_reg_res.status_code == 404


@pytest.mark.asyncio
async def test_scheduler_triggers_pomodoro_push_notifications():
    """
    Test that the ReminderScheduler properly detects expired pomodoro focus and break
    timers, sends High-Urgency push notifications in the user's preferred language,
    and transitions session statuses.
    """
    scheduler = ReminderScheduler()

    with Session(engine) as session:
        user_es = User(
            username=f"user_es_{int(datetime.now().timestamp())}",
            hashed_password="pw",
            language="es",
        )
        user_en = User(
            username=f"user_en_{int(datetime.now().timestamp())}",
            hashed_password="pw",
            language="en",
        )
        session.add(user_es)
        session.add(user_en)
        session.commit()
        session.refresh(user_es)
        session.refresh(user_en)

        now_utc = datetime.now(timezone.utc)
        past_end_time = now_utc - timedelta(seconds=10)

        # 1. Expired Focus session for Spanish user
        focus_session = PomodoroSession(
            user_id=user_es.id,
            status=PomodoroStatus.IN_PROGRESS,
            phase=PomodoroPhase.FOCUS,
            date_str="2026-10-26",
            year=2026,
            month=10,
            day=26,
            hour_of_day=10,
            started_at=now_utc - timedelta(minutes=25),
            timer_end_time=past_end_time,
            notification_sent=False,
        )

        # 2. Expired Break session for English user
        break_session = PomodoroSession(
            user_id=user_en.id,
            status=PomodoroStatus.COMPLETED,
            phase=PomodoroPhase.BREAK,
            date_str="2026-10-26",
            year=2026,
            month=10,
            day=26,
            hour_of_day=11,
            started_at=now_utc - timedelta(minutes=30),
            timer_end_time=past_end_time,
            notification_sent=False,
        )

        session.add(focus_session)
        session.add(break_session)
        session.commit()
        session.refresh(focus_session)
        session.refresh(break_session)

        with patch("src.application.reminder_scheduler.PushService") as MockPushService:
            mock_push = MockPushService.return_value
            with patch.object(ReminderScheduler, "datetime_now", return_value=now_utc):
                await scheduler._check_all_active_timers()

            # Verify ES Focus push
            mock_push.send_notification.assert_any_call(
                user_id=user_es.id,
                title="POMODORO",
                body="¡Tiempo de foco terminado! Toma un descanso de 5 minutos",
                data={"pomodoro_id": focus_session.id, "type": "pomodoro_focus_end"},
                urgency="high",
            )

            # Verify EN Break push
            mock_push.send_notification.assert_any_call(
                user_id=user_en.id,
                title="POMODORO",
                body="Congratulations! You completed your Pomodoro and break",
                data={"pomodoro_id": break_session.id, "type": "pomodoro_break_end"},
                urgency="high",
            )

        # Re-fetch from DB and verify statuses
        session.refresh(focus_session)
        session.refresh(break_session)

        assert focus_session.status == PomodoroStatus.COMPLETED
        assert focus_session.timer_end_time is None
        assert focus_session.notification_sent is True

        assert break_session.phase == PomodoroPhase.DONE
        assert break_session.timer_end_time is None
        assert break_session.notification_sent is True


def test_timezone_travel_colombia_to_spain_pomodoro_and_reminders(client: TestClient):
    """
    Verify that when a user travels from Colombia (America/Bogota, UTC-5) to
    Spain (Europe/Madrid, UTC+1/UTC+2), Pomodoro daily buckets, manual hours,
    and UTC timestamps work seamlessly without breaking existing records.
    """
    # 1. User is in Colombia (America/Bogota, UTC-5)
    # Fixed UTC instant: 2026-10-27 23:30:00 UTC
    # In Colombia (UTC-5): 2026-10-27 18:30:00 (Date: 2026-10-27, Hour: 18)
    # In Spain (CET, UTC+1 after Oct 25 DST): 2026-10-28 00:30:00 (Date: 2026-10-28, Hour: 0)
    fixed_utc = datetime(2026, 10, 27, 23, 30, 0, tzinfo=timezone.utc)

    settings_co = client.put(
        "/users/settings",
        json={
            "day_start_time": "08:00",
            "day_end_time": "20:00",
            "language": "es",
            "timezone": "America/Bogota",
        },
    )
    assert settings_co.status_code == 200
    assert settings_co.json()["timezone"] == "America/Bogota"

    with patch("src.application.services.datetime") as mock_dt:
        mock_dt.now.return_value = fixed_utc
        mock_dt.side_effect = lambda *args, **kw: datetime(*args, **kw)

        start_co = client.post("/pomodoros/start")
        assert start_co.status_code == 201
        co_data = start_co.json()
        assert co_data["date_str"] == "2026-10-27"
        assert co_data["hour_of_day"] == 18
        client.post(f"/pomodoros/{co_data['id']}/complete-focus")

        stats_co = client.get("/pomodoros/today").json()
        assert stats_co["date_str"] == "2026-10-27"
        assert stats_co["completed_today_count"] == 1

    # 2. User travels to Spain (Europe/Madrid) at the exact same UTC instant (or next day)
    settings_es = client.put(
        "/users/settings",
        json={
            "day_start_time": "08:00",
            "day_end_time": "20:00",
            "language": "es",
            "timezone": "Europe/Madrid",
        },
    )
    assert settings_es.status_code == 200
    assert settings_es.json()["timezone"] == "Europe/Madrid"

    with patch("src.application.services.datetime") as mock_dt:
        mock_dt.now.return_value = fixed_utc
        mock_dt.side_effect = lambda *args, **kw: datetime(*args, **kw)

        # In Spain it is already 2026-10-28 (00:30 local time), so today's count for Oct 28 starts at 0
        stats_es_before = client.get("/pomodoros/today").json()
        assert stats_es_before["date_str"] == "2026-10-28"
        assert stats_es_before["completed_today_count"] == 0

        # Log a manual pomodoro at 10:00 Spain time (CET UTC+1 -> 09:00 UTC)
        manual_es = client.post(
            "/pomodoros/manual",
            json={"hour_of_day": 10, "device_type": "mobile"},
        )
        assert manual_es.status_code == 201
        manual_data = manual_es.json()
        assert manual_data["date_str"] == "2026-10-28"
        assert manual_data["hour_of_day"] == 10
        started_utc = datetime.fromisoformat(
            manual_data["started_at"].replace("Z", "+00:00")
        )
        assert started_utc == datetime(2026, 10, 28, 9, 0, 0, tzinfo=timezone.utc)


def test_security_validation_on_settings_and_pomodoro_inputs(client: TestClient):
    """
    Verify that invalid timezones, path traversal attempts, malformed HH:MM times,
    and out-of-range elapsed_seconds are rejected with 422 Unprocessable Entity.
    """
    # 1. Invalid timezone / path traversal attempt
    bad_tz = client.put(
        "/users/settings",
        json={
            "day_start_time": "08:00",
            "day_end_time": "20:00",
            "language": "en",
            "timezone": "../../etc/passwd",
        },
    )
    assert bad_tz.status_code == 422

    # 2. Malformed day_start_time
    bad_time = client.put(
        "/users/settings",
        json={
            "day_start_time": "invalid",
            "day_end_time": "20:00",
            "language": "en",
            "timezone": "America/Bogota",
        },
    )
    assert bad_time.status_code == 422

    # 3. Negative elapsed_seconds in interrupt request
    start_res = client.post("/pomodoros/start")
    pom_id = start_res.json()["id"]
    bad_int = client.post(
        f"/pomodoros/{pom_id}/interrupt",
        json={"elapsed_seconds": -50},
    )
    assert bad_int.status_code == 422
