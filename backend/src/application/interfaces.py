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

    def get_all(self) -> List[Task]: ...

    def get_by_id(self, task_id: int) -> Optional[Task]: ...

    def create(self, task_data: TaskCreate) -> Task: ...

    def update(self, task_id: int, task_data: TaskUpdate) -> Optional[Task]: ...

    def delete(self, task_id: int) -> bool: ...

    def reorder_tasks(self, column_id: ColumnId, task_ids: List[int]) -> bool:
        """
        Updates the order_index of multiple tasks in a specific column
        to persist the Drag & Drop state from the UI.
        """
        ...

    def reset_daily_tasks(self) -> bool:
        """
        Sets completed=False for all tasks in the daily column.
        """
        ...

    def reset_monthly_tasks(self) -> bool:
        """
        Sets completed=False for all tasks in the monthly column.
        """
        ...

    def reset_annually_tasks(self) -> bool:
        """
        Sets completed=False for all tasks in the annually column.
        """
        ...

    def log_completion(self, task: Task, is_retroactive: bool) -> None:
        """
        Records a task completion event in the log.
        """
        ...

    def remove_last_completion_log(self, task: Task) -> None:
        """
        Removes the most recent log for a specific task and refreshes the task.
        """
        ...


class IReminderRepository(Protocol):
    """
    Interface (Port) for Reminder data persistence.
    """

    def get_all(self) -> List[Reminder]: ...

    def get_by_id(self, reminder_id: int) -> Optional[Reminder]: ...

    def create(self, reminder_data: ReminderCreate) -> Reminder: ...

    def update(
        self, reminder_id: int, reminder_data: ReminderUpdate
    ) -> Optional[Reminder]: ...

    def delete(self, reminder_id: int) -> bool: ...
