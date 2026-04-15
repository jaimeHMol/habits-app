from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from src.domain.models import (
    Task,
    TaskCreate,
    TaskUpdate,
    ColumnId,
    Reminder,
    ReminderCreate,
    ReminderUpdate,
    User,
)
from src.application.services import TaskService, ReminderService, UserService
from src.api.dependencies import (
    get_task_service,
    get_reminder_service,
    get_user_service,
)
from src.api.security import get_current_user

router = APIRouter(
    prefix="/tasks",
    tags=["Tasks"],
    dependencies=[Depends(get_current_user)],  # The lock
)


# --- Schemas for specific requests ---
class ReorderRequest(BaseModel):
    column_id: ColumnId
    task_ids: List[int]


# --- Endpoints ---


@router.get("/", response_model=List[Task])
def get_all_tasks(service: TaskService = Depends(get_task_service)):
    return service.get_all_tasks()


@router.post("/", response_model=Task, status_code=status.HTTP_201_CREATED)
def create_task(task_in: TaskCreate, service: TaskService = Depends(get_task_service)):
    return service.create_new_task(task_in)


@router.put("/{task_id}", response_model=Task)
def update_task(
    task_id: int, task_in: TaskUpdate, service: TaskService = Depends(get_task_service)
):
    task = service.update_task_details(task_id, task_in)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(task_id: int, service: TaskService = Depends(get_task_service)):
    success = service.delete_task(task_id)
    if not success:
        raise HTTPException(status_code=404, detail="Task not found")
    return None


@router.patch("/{task_id}/complete", response_model=Task)
def toggle_task_completion(
    task_id: int, service: TaskService = Depends(get_task_service)
):
    task = service.toggle_completion(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@router.put("/reorder/column", status_code=status.HTTP_200_OK)
def reorder_tasks(
    request: ReorderRequest, service: TaskService = Depends(get_task_service)
):
    success = service.reorder_column(request.column_id, request.task_ids)
    if not success:
        raise HTTPException(status_code=400, detail="Failed to reorder tasks")
    return {"message": "Reorder successful"}


@router.post("/reset-daily", status_code=status.HTTP_200_OK)
def reset_daily_tasks(service: TaskService = Depends(get_task_service)):
    success = service.reset_daily_tasks()
    if not success:
        raise HTTPException(status_code=500, detail="Failed to reset daily tasks")
    return {"message": "Daily tasks reset successfully"}


# --- Reminders Router ---
reminders_router = APIRouter(
    prefix="/reminders",
    tags=["Reminders"],
    dependencies=[Depends(get_current_user)],
)


@reminders_router.get("/", response_model=List[Reminder])
def get_reminders(service: ReminderService = Depends(get_reminder_service)):
    return service.get_all_reminders()


@reminders_router.post(
    "/", response_model=Reminder, status_code=status.HTTP_201_CREATED
)
def create_reminder(
    reminder_in: ReminderCreate,
    service: ReminderService = Depends(get_reminder_service),
):
    return service.create_reminder(reminder_in)


@reminders_router.put("/{reminder_id}", response_model=Reminder)
def update_reminder(
    reminder_id: int,
    reminder_in: ReminderUpdate,
    service: ReminderService = Depends(get_reminder_service),
):
    reminder = service.update_reminder(reminder_id, reminder_in)
    if not reminder:
        raise HTTPException(status_code=404, detail="Reminder not found")
    return reminder


@reminders_router.delete("/{reminder_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_reminder(
    reminder_id: int, service: ReminderService = Depends(get_reminder_service)
):
    success = service.delete_reminder(reminder_id)
    if not success:
        raise HTTPException(status_code=404, detail="Reminder not found")
    return None


# --- Users Router (Settings) ---
users_router = APIRouter(
    prefix="/users",
    tags=["Users"],
    dependencies=[Depends(get_current_user)],
)


class UserSettingsUpdate(BaseModel):
    day_start_time: str
    day_end_time: str


@users_router.get("/me", response_model=User)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@users_router.put("/settings", response_model=User)
def update_settings(
    settings: UserSettingsUpdate,
    current_user: User = Depends(get_current_user),
    service: UserService = Depends(get_user_service),
):
    user = service.update_settings(
        current_user.id, settings.day_start_time, settings.day_end_time
    )
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user
