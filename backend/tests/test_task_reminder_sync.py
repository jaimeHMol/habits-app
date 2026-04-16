from src.domain.models import ColumnId, Priority, TaskType


def test_task_reminder_sync_create(client):
    # 1. Create a Monthly task with target_day
    task_payload = {
        "title": "Monthly Habit",
        "column_id": ColumnId.MONTHLY,
        "target_day": 15,
        "priority": Priority.FRAILEJON,
        "task_type": TaskType.CHECKBOX,
    }
    response = client.post("/tasks/", json=task_payload)
    print(f"DEBUG: Create task response: {response.json()}")
    assert response.status_code == 201
    task_id = response.json().get("id")
    assert task_id is not None, f"Response was: {response.json()}"

    # 2. Verify a reminder was created
    reminders_response = client.get("/reminders/")
    assert reminders_response.status_code == 200
    reminders = reminders_response.json()

    task_reminder = next((r for r in reminders if r["task_id"] == task_id), None)
    assert task_reminder is not None
    assert task_reminder["title"] == "Recuerda: Monthly Habit"


def test_task_reminder_sync_update_title(client):
    # 1. Create a task
    task_payload = {
        "title": "Initial Title",
        "column_id": ColumnId.MONTHLY,
        "target_day": 10,
    }
    create_res = client.post("/tasks/", json=task_payload)
    task_id = create_res.json().get("id")

    # 2. Update title - using PUT as per router
    update_payload = {"title": "New Title"}
    client.put(f"/tasks/{task_id}", json=update_payload)

    # 3. Verify reminder title updated
    reminders_res = client.get("/reminders/")
    reminders = reminders_res.json()
    task_reminder = next((r for r in reminders if r["task_id"] == task_id), None)
    assert task_reminder["title"] == "Recuerda: New Title"


def test_task_reminder_sync_remove_date(client):
    # 1. Create task with date
    task_payload = {
        "title": "Dated Task",
        "column_id": ColumnId.MONTHLY,
        "target_day": 5,
    }
    create_res = client.post("/tasks/", json=task_payload)
    task_id = create_res.json().get("id")

    # Check reminder exists
    reminders_res = client.get("/reminders/")
    assert any(r["task_id"] == task_id for r in reminders_res.json())

    # 2. Update task to remove target_day
    client.put(f"/tasks/{task_id}", json={"target_day": None})

    # 3. Verify reminder is gone
    reminders_res = client.get("/reminders/")
    assert not any(r["task_id"] == task_id for r in reminders_res.json())


def test_task_reminder_sync_delete_task(client):
    # 1. Create task
    task_payload = {
        "title": "To be deleted",
        "column_id": ColumnId.MONTHLY,
        "target_day": 1,
    }
    create_res = client.post("/tasks/", json=task_payload)
    task_id = create_res.json().get("id")

    # 2. Delete task
    client.delete(f"/tasks/{task_id}")

    # 3. Verify reminder is gone
    reminders_res = client.get("/reminders/")
    assert not any(r["task_id"] == task_id for r in reminders_res.json())
