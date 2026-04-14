from typing import List, Optional
from src.domain.models import Task, TaskCreate, TaskUpdate, ColumnId
from src.application.interfaces import ITaskRepository

class TaskService:
    """
    Application Service that orchestrates use cases for Tasks.
    It encapsulates business logic and interacts with the repository port.
    """
    def __init__(self, repository: ITaskRepository):
        self.repository = repository

    def get_all_tasks(self) -> List[Task]:
        return self.repository.get_all()

    def create_new_task(self, task_data: TaskCreate) -> Task:
        # 1. Create the task normally
        created_task = self.repository.create(task_data)
        
        # 2. FIX: If it's a date-based column, force re-sorting
        if created_task.column_id in [ColumnId.MONTHLY, ColumnId.ANNUALLY]:
            self._ensure_chronological_order(created_task.column_id)
            # Refrescamos la tarea desde la BD para devolverla con el order_index correcto
            created_task = self.repository.get_by_id(created_task.id)
            
        return created_task

    def update_task_details(self, task_id: int, task_data: TaskUpdate) -> Optional[Task]:
        # Get existing task to check if column or dates changed
        existing_task = self.repository.get_by_id(task_id)
        if not existing_task:
            return None

        updated_task = self.repository.update(task_id, task_data)
        
        # Logic: If target_day or target_month changed in a recurring column,
        # we might want to trigger a full re-sort of that column.
        if updated_task and (task_data.target_day or task_data.target_month):
            self._ensure_chronological_order(updated_task.column_id)
            # Fetch updated version after re-sort
            updated_task = self.repository.get_by_id(task_id)

        return updated_task

    def delete_task(self, task_id: int) -> bool:
        return self.repository.delete(task_id)

    def toggle_completion(self, task_id: int) -> Optional[Task]:
        task = self.repository.get_by_id(task_id)
        if not task:
            return None
        
        update_data = TaskUpdate(completed=not task.completed)
        return self.repository.update(task_id, update_data)

    def reorder_column(self, column_id: ColumnId, task_ids: List[int]) -> bool:
        """
        Persists the manual order from a Drag & Drop action in the UI.
        """
        return self.repository.reorder_tasks(column_id, task_ids)

    def _ensure_chronological_order(self, column_id: ColumnId):
        """
        Internal helper to sort Monthly/Annually columns by date.
        This maintains business consistency regardless of how the UI sends data.
        """
        if column_id not in [ColumnId.MONTHLY, ColumnId.ANNUALLY]:
            return

        all_tasks = self.repository.get_all()
        column_tasks = [t for t in all_tasks if t.column_id == column_id]
        
        if column_id == ColumnId.MONTHLY:
            # Sort by target_day (None values at the end)
            sorted_tasks = sorted(column_tasks, key=lambda x: (x.target_day is None, x.target_day))
        else: # ANNUALLY
            # Sort by target_month, then target_day
            sorted_tasks = sorted(
                column_tasks, 
                key=lambda x: (x.target_month is None, x.target_month, x.target_day is None, x.target_day)
            )
        
        # Apply the new order_index
        sorted_ids = [t.id for t in sorted_tasks if t.id is not None]
        self.repository.reorder_tasks(column_id, sorted_ids)