from fastapi.testclient import TestClient
from src.domain.models import ColumnId


def test_task_to_reminder_markdown_stripping(client: TestClient):
    """
    Verify that when a task with markdown in title is created in a column
    that triggers a reminder (Monthly/Annually), the reminder title is stripped of markdown.
    """
    # 1. Create a monthly task with markdown in title
    title_with_markdown = "Buy [Milk](https://milk.com) and **Eggs**"
    payload = {
        "title": title_with_markdown,
        "column_id": ColumnId.MONTHLY,
        "target_day": 15,
    }

    response = client.post("/tasks/", json=payload)
    assert response.status_code == 201
    task_id = response.json()["id"]

    # 2. Get all reminders
    reminders_res = client.get("/reminders/")
    assert reminders_res.status_code == 200
    reminders = reminders_res.json()

    # 3. Find the reminder linked to this task
    task_reminder = next((r for r in reminders if r["task_id"] == task_id), None)
    assert task_reminder is not None

    # 4. Verify title is stripped
    assert task_reminder["title"] == "Buy Milk and Eggs"
