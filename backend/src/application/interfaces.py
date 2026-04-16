from typing import List, Optional, Protocol
from src.domain.models import (
    Task,
    TaskCreate,
    TaskUpdate,
    ColumnId,
    Reminder,
    ReminderCreate,
    ReminderUpdate,
)


class ITaskRepository(Protocol):
    """
    Interface (Port) for Task data persistence.
    Following the Dependency Inversion Principle.
    """

    def get_all(self, user_id: int) -> List[Task]: ...

    def get_by_id(self, task_id: int, user_id: int) -> Optional[Task]: ...

    def create(self, task_data: TaskCreate, user_id: int) -> Task: ...

    def update(
        self, task_id: int, task_data: TaskUpdate, user_id: int
    ) -> Optional[Task]: ...

    def delete(self, task_id: int, user_id: int) -> bool: ...

    def reorder_tasks(
        self, column_id: ColumnId, task_ids: List[int], user_id: int
    ) -> bool:
        """
        Updates the order_index of multiple tasks in a specific column
        to persist the Drag & Drop state from the UI.
        """
        ...

    def reset_daily_tasks(self, user_id: int) -> bool:
        """
        Sets completed=False for all tasks in the daily column.
        """
        ...

    def reset_monthly_tasks(self, user_id: int) -> bool:
        """
        Sets completed=False for all tasks in the monthly column.
        """
        ...

    def reset_annually_tasks(self, user_id: int) -> bool:
        """
        Sets completed=False for all tasks in the annually column.
        """
        ...

    def log_completion(self, task: Task, is_retroactive: bool) -> None:
        """
        Records a task completion event in the log.
        Note: task object already contains user_id.
        """
        ...

    def remove_last_completion_log(self, task: Task) -> None:
        """
        Removes the most recent log for a specific task and refreshes the task.
        """
        ...

    def increment_task(
        self, task_id: int, user_id: int, is_retroactive: bool
    ) -> Optional[Task]:
        """
        Increments current_count and logs the event.
        """
        ...

    def decrement_task(self, task_id: int, user_id: int) -> Optional[Task]:
        """
        Decrements current_count and removes the last log.
        """
        ...


class IReminderRepository(Protocol):
    """
    Interface (Port) for Reminder data persistence.
    """

    def get_all(self, user_id: int) -> List[Reminder]: ...

    def get_by_id(self, reminder_id: int, user_id: int) -> Optional[Reminder]: ...

    def create(self, reminder_data: ReminderCreate, user_id: int) -> Reminder: ...

    def update(
        self, reminder_id: int, reminder_data: ReminderUpdate, user_id: int
    ) -> Optional[Reminder]: ...

    def delete(self, reminder_id: int, user_id: int) -> bool: ...
