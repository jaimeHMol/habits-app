from fastapi.testclient import TestClient


def test_create_and_get_reminders(client: TestClient):
    # 1. Create a reminder
    payload = {"title": "Drink Water", "interval_minutes": 60, "is_active": True}
    response = client.post("/reminders/", json=payload)
    assert response.status_code == 201
    reminder_id = response.json()["id"]

    # 2. Get all reminders
    get_res = client.get("/reminders/")
    assert get_res.status_code == 200
    reminders = get_res.json()
    assert len(reminders) >= 1
    assert any(r["id"] == reminder_id for r in reminders)


def test_update_user_settings(client: TestClient):
    # 1. Initial check (default values)
    me_res = client.get("/users/me")
    assert me_res.status_code == 200
    assert me_res.json()["day_start_time"] == "08:00"

    # 2. Update settings
    payload = {"day_start_time": "09:00", "day_end_time": "21:00", "language": "es"}
    update_res = client.put("/users/settings", json=payload)
    assert update_res.status_code == 200
    assert update_res.json()["day_start_time"] == "09:00"
    assert update_res.json()["day_end_time"] == "21:00"
    assert update_res.json()["language"] == "es"

    # 3. Verify persistence
    me_res_2 = client.get("/users/me")
    assert me_res_2.json()["day_start_time"] == "09:00"
    assert me_res_2.json()["language"] == "es"
