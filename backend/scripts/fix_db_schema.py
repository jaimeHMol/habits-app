import sqlite3
import os

db_path = "backend/data/habits.db"
if not os.path.exists(db_path):
    db_path = "data/habits.db"  # If running from inside backend/

if not os.path.exists(db_path):
    print(f"Database not found at {db_path}. Please check your current directory.")
    exit(1)

print(f"Attempting to fix schema in {db_path}...")

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

try:
    # Check if column exists
    cursor.execute("PRAGMA table_info(user)")
    columns = [column[1] for column in cursor.fetchall()]

    if "last_period_reset_date" not in columns:
        print("Adding column 'last_period_reset_date' to 'user' table...")
        cursor.execute("ALTER TABLE user ADD COLUMN last_period_reset_date TEXT")
        conn.commit()
        print("Column added successfully.")
    else:
        print("Column 'last_period_reset_date' already exists.")

except Exception as e:
    print(f"An error occurred: {e}")
finally:
    conn.close()
