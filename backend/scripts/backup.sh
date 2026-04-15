#!/bin/bash
set -e

# Configuration
DB_TYPE=${DB_TYPE:-"sqlite"}
DB_FILE=${DB_FILE:-"/app/habits.db"}
BACKUP_DIR=${BACKUP_DIR:-"/backups"}
RETENTION_DAYS=30
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

echo "[$(date)] Starting backup for DB_TYPE: $DB_TYPE..."

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

case $DB_TYPE in
  "sqlite")
    # Use sqlite3 CLI if available for a clean backup (atomic copy)
    if command -v sqlite3 >/dev/null 2>&1; then
      echo "Performing SQLite backup via sqlite3 CLI..."
      sqlite3 "$DB_FILE" ".backup '$BACKUP_DIR/habits_backup_$TIMESTAMP.db'"
    else
      echo "sqlite3 CLI not found, performing a direct file copy..."
      cp "$DB_FILE" "$BACKUP_DIR/habits_backup_$TIMESTAMP.db"
    fi
    ;;
  "postgres")
    # Placeholder for future Postgres support
    echo "Postgres backup via pg_dump (Placeholder)..."
    # pg_dump -h $DB_HOST -U $DB_USER $DB_NAME > "$BACKUP_DIR/habits_backup_$TIMESTAMP.sql"
    ;;
  *)
    echo "Unknown DB_TYPE: $DB_TYPE"
    exit 1
    ;;
esac

# Cleanup: Delete backups older than 30 days
echo "Cleaning up backups older than $RETENTION_DAYS days..."
find "$BACKUP_DIR" -name "habits_backup_*" -type f -mtime +$RETENTION_DAYS -delete

echo "[$(date)] Backup completed successfully."
