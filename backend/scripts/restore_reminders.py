import sys
import os
from sqlmodel import Session, select

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.infrastructure.database import engine
from src.domain.models import Task, ColumnId
from src.infrastructure.sqlite_repository import (
    SQLiteTaskRepository,
    SQLiteReminderRepository,
)
from src.application.services import TaskService

def restore_reminders():
    with Session(engine) as session:
        task_repo = SQLiteTaskRepository(session)
        reminder_repo = SQLiteReminderRepository(session)
        
        # Instantiate TaskService correctly (it only takes 2 arguments: task_repo and reminder_repo based on previous reads, let's verify)
        task_service = TaskService(task_repo, reminder_repo)
        
        statement = select(Task).where(Task.column_id.in_([ColumnId.MONTHLY, ColumnId.ANNUALLY]))
        tasks = session.exec(statement).all()
        
        restored_count = 0
        for task in tasks:
            if not task.completed and task.target_day is not None:
                # _sync_task_reminder creates it if missing
                task_service._sync_task_reminder(task)
                restored_count += 1
                
        print(f"✅ Executed reminder sync for {restored_count} uncompleted monthly/annually tasks.")

if __name__ == "__main__":
    restore_reminders()
