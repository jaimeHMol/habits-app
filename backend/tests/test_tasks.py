from fastapi.testclient import TestClient
from src.domain.models import ColumnId, Priority

def test_create_task(client: TestClient):
    """
    Test standard task creation and default values.
    """
    payload = {
        "title": "Drink Water",
        "priority": Priority.MUTED,
        "column_id": ColumnId.DAILY
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
    response = client.post("/tasks/", json={"title": "Workout", "column_id": ColumnId.DAILY})
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
    client.post("/tasks/", json={
        "title": "Pay Internet", 
        "column_id": ColumnId.MONTHLY,
        "target_day": 25
    })
    
    # 2. Create a task for the 5th of the month AFTER the 25th
    client.post("/tasks/", json={
        "title": "Pay Rent", 
        "column_id": ColumnId.MONTHLY,
        "target_day": 5
    })
    
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