from fastapi.testclient import TestClient
from src.domain.models import ColumnId, Priority


def test_create_task(client: TestClient):
    """
    Test standard task creation and default values.
    """
    payload = {
        "title": "Drink Water",
        "priority": Priority.MUTED,
        "column_id": ColumnId.DAILY,
    }
    response = client.post("/tasks/", json=payload)

    assert response.status_code == 201
    data = response.json()
    assert data["title"] == "Drink Water"
    assert data["completed"] is False
    assert data["is_collapsed"] is True
    assert "id" in data


def test_toggle_task_completion(client: TestClient):
    """
    Test the custom endpoint for toggling task status.
    """
    # 1. Create task
    response = client.post(
        "/tasks/", json={"title": "Workout", "column_id": ColumnId.DAILY}
    )
    task_id = response.json()["id"]

    # 2. Toggle to completed
    toggle_res = client.patch(f"/tasks/{task_id}/complete")
    assert toggle_res.status_code == 200
    assert toggle_res.json()["completed"] is True

    # 3. Toggle back to active
    toggle_res_2 = client.patch(f"/tasks/{task_id}/complete")
    assert toggle_res_2.json()["completed"] is False


def test_chronological_sorting_business_logic(client: TestClient):
    """
    Verify the Domain/Application logic: Monthly tasks must automatically
    sort themselves by 'target_day', overriding standard creation order.
    """
    # 1. Create a task for the 25th of the month
    client.post(
        "/tasks/",
        json={"title": "Pay Internet", "column_id": ColumnId.MONTHLY, "target_day": 25},
    )

    # 2. Create a task for the 5th of the month AFTER the 25th
    client.post(
        "/tasks/",
        json={"title": "Pay Rent", "column_id": ColumnId.MONTHLY, "target_day": 5},
    )

    # 3. Fetch all tasks
    response = client.get("/tasks/")
    assert response.status_code == 200
    tasks = response.json()

    # 4. Verify the Application Service reordered them automatically
    # "Pay Rent" (5th) should be index 0, "Pay Internet" (25th) should be index 1
    monthly_tasks = [t for t in tasks if t["column_id"] == ColumnId.MONTHLY]

    assert len(monthly_tasks) == 2
    assert monthly_tasks[0]["title"] == "Pay Rent"
    assert monthly_tasks[0]["target_day"] == 5
    assert monthly_tasks[1]["title"] == "Pay Internet"
    assert monthly_tasks[1]["target_day"] == 25


def test_reset_daily_tasks(client: TestClient):
    """
    Test that all daily tasks are reset to uncompleted status.
    """
    # 1. Create and complete a daily task
    res1 = client.post("/tasks/", json={"title": "Task 1", "column_id": ColumnId.DAILY})
    id1 = res1.json()["id"]
    client.patch(f"/tasks/{id1}/complete")

    # 2. Create another daily task and complete it
    res2 = client.post("/tasks/", json={"title": "Task 2", "column_id": ColumnId.DAILY})
    id2 = res2.json()["id"]
    client.patch(f"/tasks/{id2}/complete")

    # 3. Create a TODO task and complete it (should NOT be reset)
    res3 = client.post("/tasks/", json={"title": "Todo 1", "column_id": ColumnId.TODO})
    id3 = res3.json()["id"]
    client.patch(f"/tasks/{id3}/complete")

    # 4. Trigger reset
    reset_res = client.post("/tasks/reset-daily")
    assert reset_res.status_code == 200

    # 5. Verify results
    all_tasks = client.get("/tasks/").json()
    t1 = next(t for t in all_tasks if t["id"] == id1)
    t2 = next(t for t in all_tasks if t["id"] == id2)
    t3 = next(t for t in all_tasks if t["id"] == id3)

    assert t1["completed"] is False
    assert t2["completed"] is False
    assert t3["completed"] is True  # Todo column should remain untouched
