from typing import List, Optional, Protocol
from src.domain.models import Task, TaskCreate, TaskUpdate, ColumnId


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
