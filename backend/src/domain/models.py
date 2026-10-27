from typing import List, Optional
from enum import Enum
from sqlmodel import SQLModel, Field
from datetime import datetime, timezone


class ColumnId(str, Enum):
    DAILY = "daily"
    MONTHLY = "monthly"
    ANNUALLY = "annually"
    TODO = "todo"


class Priority(str, Enum):
    MUTED = "muted"
    FRAILEJON = "frailejon"
    TIERRA = "tierra"


class TaskType(str, Enum):
    CHECKBOX = "checkbox"
    COUNTER = "counter"


class TaskBase(SQLModel):
    title: str = Field(index=True)
    description: Optional[str] = Field(default=None)
    priority: Priority = Field(default=Priority.MUTED)
    task_type: TaskType = Field(default=TaskType.CHECKBOX)
    column_id: ColumnId = Field(default=ColumnId.TODO)
    target_day: Optional[int] = Field(default=None, ge=1, le=31)
    target_month: Optional[int] = Field(default=None, ge=1, le=12)
    completed: bool = Field(default=False)
    is_collapsed: bool = Field(default=True)
    is_pinned: bool = Field(default=False)
    duration_minutes: Optional[int] = Field(default=None)
    timer_end_time: Optional[datetime] = Field(default=None)
    timer_triggered: bool = Field(default=False)
    current_count: int = Field(default=0)
    order_index: int = Field(default=0)  # To persist Drag & Drop sorting
    user_id: Optional[int] = Field(default=None, index=True)


class Task(TaskBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class TaskCreate(TaskBase):
    pass


class TaskUpdate(SQLModel):
    title: Optional[str] = None
    description: Optional[str] = None
    priority: Optional[Priority] = None
    task_type: Optional[TaskType] = None
    column_id: Optional[ColumnId] = None
    target_day: Optional[int] = None
    target_month: Optional[int] = None
    completed: Optional[bool] = None
    is_collapsed: Optional[bool] = None
    is_pinned: Optional[bool] = None
    duration_minutes: Optional[int] = None
    timer_end_time: Optional[datetime] = None
    timer_triggered: Optional[bool] = None
    current_count: Optional[int] = None
    order_index: Optional[int] = None


class UserBase(SQLModel):
    username: str = Field(index=True, unique=True)
    full_name: str = Field(default="User")
    role: str = Field(default="user")
    is_active: bool = Field(default=True)
    day_start_time: str = Field(default="08:00")
    day_end_time: str = Field(default="20:00")
    language: str = Field(default="en")
    timezone: str = Field(default="America/Bogota")
    last_period_reset_date: Optional[str] = Field(default=None)


class User(UserBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    # Never store plain text! We store the salted hash.
    hashed_password: str


class UserCreate(UserBase):
    password: str


class ReminderBase(SQLModel):
    title: str
    interval_minutes: int = Field(gt=0)
    is_active: bool = Field(default=True)
    user_id: Optional[int] = Field(default=None, index=True)
    task_id: Optional[int] = Field(default=None, index=True)
    last_triggered_at: Optional[datetime] = Field(default=None)


class Reminder(ReminderBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ReminderCreate(ReminderBase):
    pass


class ReminderUpdate(SQLModel):
    title: Optional[str] = None
    interval_minutes: Optional[int] = Field(default=None, gt=0)
    is_active: Optional[bool] = None
    task_id: Optional[int] = None
    last_triggered_at: Optional[datetime] = None


class PushSubscription(SQLModel, table=True):
    __tablename__ = "push_subscriptions"
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(index=True)
    endpoint: str = Field(unique=True)
    p256dh: str
    auth: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class TaskCompletionLog(SQLModel, table=True):
    __tablename__ = "task_completion_log"
    id: Optional[int] = Field(default=None, primary_key=True)
    task_id: int = Field(index=True)
    user_id: int = Field(index=True)
    task_title: str
    column_id: ColumnId
    priority: Priority
    target_day: Optional[int] = None
    target_month: Optional[int] = None
    completed_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    is_retroactive: bool = Field(default=False)


class InvitationCode(SQLModel, table=True):
    code: str = Field(primary_key=True)
    is_used: bool = Field(default=False)
    used_by_id: Optional[int] = Field(default=None)
    created_by_id: int


class PomodoroStatus(str, Enum):
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    INTERRUPTED = "interrupted"


class PomodoroPhase(str, Enum):
    FOCUS = "focus"
    BREAK = "break"
    DONE = "done"


class DeviceType(str, Enum):
    DESKTOP = "desktop"
    MOBILE = "mobile"


class PomodoroSession(SQLModel, table=True):
    __tablename__ = "pomodoro_session"
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(index=True)
    status: PomodoroStatus = Field(default=PomodoroStatus.IN_PROGRESS, index=True)
    phase: PomodoroPhase = Field(default=PomodoroPhase.FOCUS)

    # Time dimensions for fast analytics queries (computed in the user's configured local timezone)
    date_str: str = Field(index=True)  # Format: "YYYY-MM-DD"
    year: int = Field(index=True)  # e.g., 2026
    month: int = Field(index=True)  # 1..12
    day: int = Field(index=True)  # 1..31
    hour_of_day: int = Field(index=True)  # 0..23 (time slot)

    # Exact UTC timestamps (for manual entries: minutes and seconds are set to 00)
    started_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    completed_at: Optional[datetime] = Field(default=None)
    interrupted_at: Optional[datetime] = Field(default=None)

    # Durations and metadata
    focus_duration_minutes: int = Field(default=25)
    break_duration_minutes: int = Field(default=5)
    elapsed_focus_seconds: int = Field(default=0)
    is_manual: bool = Field(default=False, index=True)
    device_type: DeviceType = Field(default=DeviceType.DESKTOP)

    # Scheduler and Push notification control (Focus and Break phases)
    timer_end_time: Optional[datetime] = Field(default=None, index=True)
    notification_sent: bool = Field(default=False)


class PomodoroStartRequest(SQLModel):
    device_type: DeviceType = DeviceType.DESKTOP


class PomodoroManualCreate(SQLModel):
    hour_of_day: int = Field(ge=0, le=23)
    device_type: DeviceType = DeviceType.DESKTOP


class PomodoroInterruptRequest(SQLModel):
    elapsed_seconds: Optional[int] = Field(default=None, ge=0, le=1500)


class PomodoroTodayStatsResponse(SQLModel):
    date_str: str
    completed_today_count: int
    interrupted_today_count: int
    active_session: Optional[PomodoroSession] = None
    today_sessions: List[PomodoroSession]
