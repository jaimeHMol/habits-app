from typing import List, Optional
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
from src.application.interfaces import ITaskRepository, IReminderRepository


class TaskService:
    """
    Application Service that orchestrates use cases for Tasks.
    It encapsulates business logic and interacts with the repository port.
    """

    def __init__(self, repository: ITaskRepository):
        self.repository = repository

    def get_all_tasks(self, user_id: int) -> List[Task]:
        return self.repository.get_all(user_id)

    def create_new_task(self, task_data: TaskCreate, user_id: int) -> Task:
        # 1. Create the task normally
        created_task = self.repository.create(task_data, user_id)

        # 2. FIX: If it's a date-based column, force re-sorting
        if created_task.column_id in [ColumnId.MONTHLY, ColumnId.ANNUALLY]:
            self._ensure_chronological_order(created_task.column_id, user_id)
            # Refrescamos la tarea desde la BD para devolverla con el order_index correcto
            created_task = self.repository.get_by_id(created_task.id, user_id)

        return created_task

    def update_task_details(
        self, task_id: int, task_data: TaskUpdate, user_id: int
    ) -> Optional[Task]:
        # Get existing task to check if column or dates changed
        existing_task = self.repository.get_by_id(task_id, user_id)
        if not existing_task:
            return None

        updated_task = self.repository.update(task_id, task_data, user_id)

        # Logic: If target_day or target_month changed in a recurring column,
        # we might want to trigger a full re-sort of that column.
        if updated_task and (task_data.target_day or task_data.target_month):
            self._ensure_chronological_order(updated_task.column_id, user_id)
            # Fetch updated version after re-sort
            updated_task = self.repository.get_by_id(task_id, user_id)

        return updated_task

    def delete_task(self, task_id: int, user_id: int) -> bool:
        return self.repository.delete(task_id, user_id)

    def toggle_completion(
        self, task_id: int, user_id: int, is_retroactive: bool = False
    ) -> Optional[Task]:
        task = self.repository.get_by_id(task_id, user_id)
        if not task:
            return None

        new_status = not task.completed
        update_data = TaskUpdate(completed=new_status)
        updated_task = self.repository.update(task_id, update_data, user_id)

        if updated_task.completed:
            self.repository.log_completion(updated_task, is_retroactive)
        else:
            self.repository.remove_last_completion_log(updated_task)

        return updated_task

    def increment_task(
        self, task_id: int, user_id: int, is_retroactive: bool = False
    ) -> Optional[Task]:
        """
        Orchestrates the increment of a counter task.
        """
        return self.repository.increment_task(task_id, user_id, is_retroactive)

    def decrement_task(self, task_id: int, user_id: int) -> Optional[Task]:
        """
        Orchestrates the decrement of a counter task.
        """
        return self.repository.decrement_task(task_id, user_id)

    def reorder_column(
        self, column_id: ColumnId, task_ids: List[int], user_id: int
    ) -> bool:
        """
        Persists the manual order from a Drag & Drop action in the UI.
        """
        return self.repository.reorder_tasks(column_id, task_ids, user_id)

    def reset_daily_tasks(self, user_id: int) -> bool:
        """
        Orchestrates the reset of all daily tasks to uncompleted status.
        """
        return self.repository.reset_daily_tasks(user_id)

    def reset_monthly_tasks(self, user_id: int) -> bool:
        """
        Orchestrates the reset of all monthly tasks to uncompleted status.
        """
        return self.repository.reset_monthly_tasks(user_id)

    def reset_annually_tasks(self, user_id: int) -> bool:
        """
        Orchestrates the reset of all annually tasks to uncompleted status.
        """
        return self.repository.reset_annually_tasks(user_id)

    def _ensure_chronological_order(self, column_id: ColumnId, user_id: int):
        """
        Internal helper to sort Monthly/Annually columns by date.
        This maintains business consistency regardless of how the UI sends data.
        """
        if column_id not in [ColumnId.MONTHLY, ColumnId.ANNUALLY]:
            return

        all_tasks = self.repository.get_all(user_id)
        column_tasks = [t for t in all_tasks if t.column_id == column_id]

        if column_id == ColumnId.MONTHLY:
            # Sort by target_day (None values at the end)
            sorted_tasks = sorted(
                column_tasks, key=lambda x: (x.target_day is None, x.target_day)
            )
        else:  # ANNUALLY
            # Sort by target_month, then target_day
            sorted_tasks = sorted(
                column_tasks,
                key=lambda x: (
                    x.target_month is None,
                    x.target_month,
                    x.target_day is None,
                    x.target_day,
                ),
            )

        # Apply the new order_index
        sorted_ids = [t.id for t in sorted_tasks if t.id is not None]
        self.repository.reorder_tasks(column_id, sorted_ids, user_id)


class ReminderService:
    """
    Application Service that orchestrates use cases for Reminders.
    """

    def __init__(self, repository: IReminderRepository):
        self.repository = repository

    def get_all_reminders(self, user_id: int) -> List[Reminder]:
        return self.repository.get_all(user_id)

    def get_reminder(self, reminder_id: int, user_id: int) -> Optional[Reminder]:
        return self.repository.get_by_id(reminder_id, user_id)

    def create_reminder(self, reminder_data: ReminderCreate, user_id: int) -> Reminder:
        return self.repository.create(reminder_data, user_id)

    def update_reminder(
        self, reminder_id: int, reminder_data: ReminderUpdate, user_id: int
    ) -> Optional[Reminder]:
        return self.repository.update(reminder_id, reminder_data, user_id)

    def delete_reminder(self, reminder_id: int, user_id: int) -> bool:
        return self.repository.delete(reminder_id, user_id)


class UserService:
    """
    Application Service for User-related operations (settings).
    """

    def __init__(self, repository):
        self.repository = repository

    def update_settings(
        self, user_id: int, start_time: str, end_time: str
    ) -> Optional[User]:
        return self.repository.update_settings(user_id, start_time, end_time)
