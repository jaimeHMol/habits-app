from typing import List, Optional
from sqlmodel import Session, select
from src.domain.models import Task, TaskCreate, TaskUpdate, ColumnId
from src.application.interfaces import ITaskRepository


class SQLiteTaskRepository(ITaskRepository):
    """
    SQLite Adapter for the Task Repository using SQLModel.
    """

    def __init__(self, session: Session):
        self.session = session

    def get_all(self) -> List[Task]:
        # Sorting by order_index by default to match UI expectations
        statement = select(Task).order_by(Task.order_index)
        results = self.session.exec(statement)
        return results.all()

    def get_by_id(self, task_id: int) -> Optional[Task]:
        return self.session.get(Task, task_id)

    def create(self, task_data: TaskCreate) -> Task:
        # FIX: Changed from_orm to model_validate (Pydantic V2)
        db_task = Task.model_validate(task_data)

        if db_task.order_index == 0:
            statement = select(Task).where(Task.column_id == db_task.column_id)
            count = len(self.session.exec(statement).all())
            db_task.order_index = count

        self.session.add(db_task)
        self.session.commit()
        self.session.refresh(db_task)
        return db_task

    def update(self, task_id: int, task_data: TaskUpdate) -> Optional[Task]:
        db_task = self.get_by_id(task_id)
        if not db_task:
            return None

        # FIX: Changed dict() to model_dump() (Pydantic V2)
        update_data = task_data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(db_task, key, value)

        self.session.add(db_task)
        self.session.commit()
        self.session.refresh(db_task)
        return db_task

    def delete(self, task_id: int) -> bool:
        db_task = self.get_by_id(task_id)
        if not db_task:
            return False

        self.session.delete(db_task)
        self.session.commit()
        return True

    def reorder_tasks(self, column_id: ColumnId, task_ids: List[int]) -> bool:
        """
        Bulk update of order_index for tasks in a column.
        """
        try:
            for index, t_id in enumerate(task_ids):
                db_task = self.get_by_id(t_id)
                if db_task and db_task.column_id == column_id:
                    db_task.order_index = index
                    self.session.add(db_task)

            self.session.commit()
            return True
        except Exception:
            self.session.rollback()
            return False
