import re
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, field_validator
from src.core.timezone import normalize_timezone_name
from src.domain.models import (
    Task,
    TaskCreate,
    TaskUpdate,
    ColumnId,
    Reminder,
    ReminderCreate,
    ReminderUpdate,
    User,
    PomodoroSession,
    PomodoroStartRequest,
    PomodoroManualCreate,
    PomodoroInterruptRequest,
    PomodoroTodayStatsResponse,
)
from src.application.services import (
    TaskService,
    ReminderService,
    UserService,
    PomodoroService,
)
from src.api.dependencies import (
    get_task_service,
    get_reminder_service,
    get_user_service,
    get_pomodoro_service,
    get_push_subscription_repository,
    get_push_service,
)
from src.api.security import get_current_user
from src.application.push_service import PushService
from src.application.interfaces import IPushSubscriptionRepository

router = APIRouter(
    prefix="/tasks",
    tags=["Tasks"],
    dependencies=[Depends(get_current_user)],
)


# --- Schemas for specific requests ---
class ReorderRequest(BaseModel):
    column_id: ColumnId
    task_ids: List[int]


# --- Endpoints ---


@router.get("/", response_model=List[Task])
def get_all_tasks(
    current_user: User = Depends(get_current_user),
    service: TaskService = Depends(get_task_service),
):
    return service.get_all_tasks(current_user.id)


@router.post("/", response_model=Task, status_code=status.HTTP_201_CREATED)
def create_task(
    task_in: TaskCreate,
    current_user: User = Depends(get_current_user),
    service: TaskService = Depends(get_task_service),
):
    return service.create_new_task(task_in, current_user.id)


@router.put("/{task_id}", response_model=Task)
def update_task(
    task_id: int,
    task_in: TaskUpdate,
    request: Request,
    current_user: User = Depends(get_current_user),
    service: TaskService = Depends(get_task_service),
):
    task = service.update_task_details(task_id, task_in, current_user.id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    scheduler = getattr(request.app.state, "scheduler", None)
    if scheduler:
        if task.timer_end_time and not task.timer_triggered and not task.completed:
            scheduler.schedule_exact_timer(task.id, task.timer_end_time)
        elif task.timer_end_time is None or task.completed:
            scheduler.cancel_exact_timer(task.id)

    return task


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(
    task_id: int,
    current_user: User = Depends(get_current_user),
    service: TaskService = Depends(get_task_service),
):
    success = service.delete_task(task_id, current_user.id)
    if not success:
        raise HTTPException(status_code=404, detail="Task not found")
    return None


@router.patch("/{task_id}/complete", response_model=Task)
def toggle_task_completion(
    task_id: int,
    request: Request,
    is_retroactive: bool = False,
    target_state: Optional[bool] = None,
    from_timer: bool = False,
    current_user: User = Depends(get_current_user),
    service: TaskService = Depends(get_task_service),
):
    task = service.toggle_completion(
        task_id,
        current_user.id,
        is_retroactive,
        target_state,
        from_timer=from_timer,
    )
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    scheduler = getattr(request.app.state, "scheduler", None)
    if scheduler and task.completed:
        scheduler.cancel_exact_timer(task.id)

    return task


@router.patch("/{task_id}/increment", response_model=Task)
def increment_task(
    task_id: int,
    is_retroactive: bool = False,
    current_user: User = Depends(get_current_user),
    service: TaskService = Depends(get_task_service),
):
    task = service.increment_task(task_id, current_user.id, is_retroactive)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@router.patch("/{task_id}/decrement", response_model=Task)
def decrement_task(
    task_id: int,
    current_user: User = Depends(get_current_user),
    service: TaskService = Depends(get_task_service),
):
    task = service.decrement_task(task_id, current_user.id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@router.put("/reorder/column", status_code=status.HTTP_200_OK)
def reorder_tasks(
    request: ReorderRequest,
    current_user: User = Depends(get_current_user),
    service: TaskService = Depends(get_task_service),
):
    success = service.reorder_column(
        request.column_id, request.task_ids, current_user.id
    )
    if not success:
        raise HTTPException(status_code=400, detail="Failed to reorder tasks")
    return {"message": "Reorder successful"}


@router.post("/reset-daily", status_code=status.HTTP_200_OK)
def reset_daily_tasks(
    current_user: User = Depends(get_current_user),
    service: TaskService = Depends(get_task_service),
):
    success = service.reset_daily_tasks(current_user.id)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to reset daily tasks")
    return {"message": "Daily tasks reset successfully"}


@router.post("/reset-monthly", status_code=status.HTTP_200_OK)
def reset_monthly_tasks(
    current_user: User = Depends(get_current_user),
    service: TaskService = Depends(get_task_service),
):
    success = service.reset_monthly_tasks(current_user.id)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to reset monthly tasks")
    return {"message": "Monthly tasks reset successfully"}


@router.post("/reset-annually", status_code=status.HTTP_200_OK)
def reset_annually_tasks(
    current_user: User = Depends(get_current_user),
    service: TaskService = Depends(get_task_service),
):
    success = service.reset_annually_tasks(current_user.id)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to reset annually tasks")
    return {"message": "Annually tasks reset successfully"}


# --- Reminders Router ---
reminders_router = APIRouter(
    prefix="/reminders",
    tags=["Reminders"],
    dependencies=[Depends(get_current_user)],
)


@reminders_router.get("/", response_model=List[Reminder])
def get_reminders(
    current_user: User = Depends(get_current_user),
    service: ReminderService = Depends(get_reminder_service),
    task_service: TaskService = Depends(get_task_service),
):
    # Auto-healing mechanism: Ensure task-associated reminders are perfectly synced
    task_service.sync_all_task_reminders(current_user.id)
    return service.get_all_reminders(current_user.id)


@reminders_router.post(
    "/", response_model=Reminder, status_code=status.HTTP_201_CREATED
)
def create_reminder(
    reminder_in: ReminderCreate,
    current_user: User = Depends(get_current_user),
    service: ReminderService = Depends(get_reminder_service),
):
    return service.create_reminder(reminder_in, current_user.id)


@reminders_router.put("/{reminder_id}", response_model=Reminder)
def update_reminder(
    reminder_id: int,
    reminder_in: ReminderUpdate,
    current_user: User = Depends(get_current_user),
    service: ReminderService = Depends(get_reminder_service),
):
    reminder = service.update_reminder(reminder_id, reminder_in, current_user.id)
    if not reminder:
        raise HTTPException(status_code=404, detail="Reminder not found")
    return reminder


@reminders_router.delete("/{reminder_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_reminder(
    reminder_id: int,
    current_user: User = Depends(get_current_user),
    service: ReminderService = Depends(get_reminder_service),
):
    success = service.delete_reminder(reminder_id, current_user.id)
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
    language: str
    timezone: Optional[str] = None

    @field_validator("day_start_time", "day_end_time")
    @classmethod
    def validate_time_format(cls, value: str) -> str:
        if not re.match(r"^(?:[01]\d|2[0-3]):[0-5]\d$", value):
            raise ValueError("Time must be in HH:MM 24-hour format (00:00 to 23:59)")
        return value

    @field_validator("language")
    @classmethod
    def validate_language(cls, value: str) -> str:
        if value not in ("en", "es"):
            raise ValueError("Supported languages are 'en' and 'es'")
        return value

    @field_validator("timezone")
    @classmethod
    def validate_timezone(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        return normalize_timezone_name(value)


class ResetConfirmationRequest(BaseModel):
    date_str: str

    @field_validator("date_str")
    @classmethod
    def validate_date_str(cls, value: str) -> str:
        if not re.match(r"^\d{4}-\d{2}-\d{2}$", value):
            raise ValueError("date_str must be in YYYY-MM-DD format")
        return value


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
        current_user.id,
        settings.day_start_time,
        settings.day_end_time,
        settings.language,
        settings.timezone,
    )
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@users_router.post("/confirm-reset")
def confirm_reset(
    request: ResetConfirmationRequest,
    current_user: User = Depends(get_current_user),
    service: UserService = Depends(get_user_service),
):
    success = service.confirm_period_resets(current_user.id, request.date_str)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to update reset date")
    return {"message": "Reset confirmed"}


# --- Push Notifications Router ---
push_router = APIRouter(
    prefix="/push",
    tags=["Push Notifications"],
)


class PushSubscriptionCreate(BaseModel):
    endpoint: str
    p256dh: str
    auth: str


@push_router.get("/vapid-public-key")
def get_vapid_public_key(service: PushService = Depends(get_push_service)):
    return {"public_key": service.get_public_key()}


@push_router.post("/subscribe", status_code=status.HTTP_201_CREATED)
def subscribe(
    subscription: PushSubscriptionCreate,
    current_user: User = Depends(get_current_user),
    repo: IPushSubscriptionRepository = Depends(get_push_subscription_repository),
):
    repo.create(
        user_id=current_user.id,
        endpoint=subscription.endpoint,
        p256dh=subscription.p256dh,
        auth=subscription.auth,
    )
    return {"message": "Subscribed successfully"}


@push_router.post("/unsubscribe")
def unsubscribe(
    subscription: PushSubscriptionCreate,
    current_user: User = Depends(get_current_user),
    repo: IPushSubscriptionRepository = Depends(get_push_subscription_repository),
):
    # We use endpoint to identify the subscription to remove
    success = repo.delete_by_endpoint(subscription.endpoint)
    if not success:
        raise HTTPException(status_code=404, detail="Subscription not found")
    return {"message": "Unsubscribed successfully"}


pomodoro_router = APIRouter(
    prefix="/pomodoros",
    tags=["Pomodoros"],
    dependencies=[Depends(get_current_user)],
)


@pomodoro_router.get("/today", response_model=PomodoroTodayStatsResponse)
def get_today_pomodoro_stats(
    current_user: User = Depends(get_current_user),
    service: PomodoroService = Depends(get_pomodoro_service),
):
    return service.get_today_stats(current_user.id)


@pomodoro_router.post(
    "/start",
    response_model=PomodoroSession,
    status_code=status.HTTP_201_CREATED,
)
def start_pomodoro(
    request: Request,
    body: PomodoroStartRequest = PomodoroStartRequest(),
    current_user: User = Depends(get_current_user),
    service: PomodoroService = Depends(get_pomodoro_service),
):
    session = service.start_focus(current_user.id, body.device_type)
    scheduler = getattr(request.app.state, "scheduler", None)
    if scheduler and session.timer_end_time:
        scheduler.schedule_exact_pomodoro(session.id, session.timer_end_time)
    return session


@pomodoro_router.post("/{pomodoro_id}/complete-focus", response_model=PomodoroSession)
def complete_focus(
    pomodoro_id: int,
    request: Request,
    current_user: User = Depends(get_current_user),
    service: PomodoroService = Depends(get_pomodoro_service),
):
    session = service.complete_focus(pomodoro_id, current_user.id)
    if not session:
        raise HTTPException(status_code=404, detail="Pomodoro session not found")
    scheduler = getattr(request.app.state, "scheduler", None)
    if scheduler:
        scheduler.cancel_exact_pomodoro(pomodoro_id)
    return session


@pomodoro_router.post("/{pomodoro_id}/start-break", response_model=PomodoroSession)
def start_break(
    pomodoro_id: int,
    request: Request,
    current_user: User = Depends(get_current_user),
    service: PomodoroService = Depends(get_pomodoro_service),
):
    session = service.start_break(pomodoro_id, current_user.id)
    if not session:
        raise HTTPException(
            status_code=404,
            detail="Pomodoro session not found or not eligible for break",
        )
    scheduler = getattr(request.app.state, "scheduler", None)
    if scheduler and session.timer_end_time:
        scheduler.schedule_exact_pomodoro(session.id, session.timer_end_time)
    return session


@pomodoro_router.post("/{pomodoro_id}/complete-break", response_model=PomodoroSession)
def complete_break(
    pomodoro_id: int,
    request: Request,
    current_user: User = Depends(get_current_user),
    service: PomodoroService = Depends(get_pomodoro_service),
):
    session = service.complete_break(pomodoro_id, current_user.id)
    if not session:
        raise HTTPException(status_code=404, detail="Pomodoro session not found")
    scheduler = getattr(request.app.state, "scheduler", None)
    if scheduler:
        scheduler.cancel_exact_pomodoro(pomodoro_id)
    return session


@pomodoro_router.post("/{pomodoro_id}/interrupt", response_model=PomodoroSession)
def interrupt_pomodoro(
    pomodoro_id: int,
    request: Request,
    body: PomodoroInterruptRequest = PomodoroInterruptRequest(),
    current_user: User = Depends(get_current_user),
    service: PomodoroService = Depends(get_pomodoro_service),
):
    session = service.interrupt_session(
        pomodoro_id, current_user.id, body.elapsed_seconds
    )
    if not session:
        raise HTTPException(status_code=404, detail="Pomodoro session not found")
    scheduler = getattr(request.app.state, "scheduler", None)
    if scheduler:
        scheduler.cancel_exact_pomodoro(pomodoro_id)
    return session


@pomodoro_router.post(
    "/manual",
    response_model=PomodoroSession,
    status_code=status.HTTP_201_CREATED,
)
def create_manual_pomodoro(
    body: PomodoroManualCreate,
    current_user: User = Depends(get_current_user),
    service: PomodoroService = Depends(get_pomodoro_service),
):
    return service.log_manual_pomodoro(
        current_user.id, body.hour_of_day, body.device_type
    )


@pomodoro_router.delete("/{pomodoro_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_manual_pomodoro(
    pomodoro_id: int,
    current_user: User = Depends(get_current_user),
    service: PomodoroService = Depends(get_pomodoro_service),
):
    success = service.delete_manual_pomodoro(pomodoro_id, current_user.id)
    if not success:
        raise HTTPException(
            status_code=404,
            detail="Pomodoro session not found or cannot be deleted",
        )
    return None
