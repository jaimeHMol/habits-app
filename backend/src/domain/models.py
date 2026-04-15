from typing import Optional
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


class TaskBase(SQLModel):
    title: str = Field(index=True)
    description: Optional[str] = Field(default=None)
    priority: Priority = Field(default=Priority.MUTED)
    column_id: ColumnId = Field(default=ColumnId.TODO)
    target_day: Optional[int] = Field(default=None, ge=1, le=31)
    target_month: Optional[int] = Field(default=None, ge=1, le=12)
    completed: bool = Field(default=False)
    is_collapsed: bool = Field(default=True)
    duration_minutes: Optional[int] = Field(default=None)
    order_index: int = Field(default=0)  # To persist Drag & Drop sorting


class Task(TaskBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class TaskCreate(TaskBase):
    pass


class TaskUpdate(SQLModel):
    title: Optional[str] = None
    description: Optional[str] = None
    priority: Optional[Priority] = None
    column_id: Optional[ColumnId] = None
    target_day: Optional[int] = None
    target_month: Optional[int] = None
    completed: Optional[bool] = None
    is_collapsed: Optional[bool] = None
    duration_minutes: Optional[int] = None
    order_index: Optional[int] = None


class UserBase(SQLModel):
    username: str = Field(index=True, unique=True)
    is_active: bool = Field(default=True)
    day_start_time: str = Field(default="08:00")
    day_end_time: str = Field(default="20:00")


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


class Reminder(ReminderBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ReminderCreate(ReminderBase):
    pass


class ReminderUpdate(SQLModel):
    title: Optional[str] = None
    interval_minutes: Optional[int] = Field(default=None, gt=0)
    is_active: Optional[bool] = None
