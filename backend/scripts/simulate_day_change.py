import sys
import os
from sqlmodel import Session, select
from datetime import datetime, timedelta

# Add current directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.infrastructure.database import engine
from src.domain.models import User, Task, ColumnId


def simulate_day_change(username: str):
    with Session(engine) as session:
        statement = select(User).where(User.username == username)
        user = session.exec(statement).first()
        if not user:
            print(f"User {username} not found")
            return

        # 1. Set last_period_reset_date to YESTERDAY
        # This triggers the "New Day" detection in the frontend
        yesterday = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")
        user.last_period_reset_date = yesterday
        session.add(user)

        # 2. Set tasks to NOT COMPLETED
        # This way you can manually mark them in the Review Modal to test the logic
        tasks_stmt = select(Task).where(
            Task.user_id == user.id, Task.column_id == ColumnId.DAILY
        )
        tasks = session.exec(tasks_stmt).all()

        if not tasks:
            print("Creating a sample daily task for simulation...")
            task = Task(
                title="Test Daily Task",
                column_id=ColumnId.DAILY,
                user_id=user.id,
                completed=False,
            )
            session.add(task)
        else:
            for task in tasks:
                task.completed = (
                    False  # IMPORTANT: Set to False so YOU can mark them in the modal
                )
                session.add(task)

        session.commit()
        print(f"✅ Simulation fixed for user '{username}'.")
        print(f"📅 Last reset date set to: {yesterday}")
        print("💡 Tasks in DAILY are now UNCOMPLETED.")
        print(
            "🚀 Now refresh the app. You should see the Review Modal and tasks will be available to check."
        )


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser()
    parser.add_argument("--username", default="admin")
    args = parser.parse_args()
    simulate_day_change(args.username)
