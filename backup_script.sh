#!/bin/bash

# Timestamp dan path
TIMESTAMP=$(date +"%Y%m%d_%H%M")
BASE_DIR="./backups"
BACKUP_DIR="$BASE_DIR/mattermost_$TIMESTAMP"
DB_USER="mmuser"
DB_NAME="mattermost"
CONTAINER_NAME="postgres-db"
FILES_DIR="./mattermost_data"  # volume mount ke host

# Buat folder backup baru
mkdir -p "$BACKUP_DIR"

echo "Backup PostgreSQL database..."
docker exec -i $CONTAINER_NAME pg_dump -U $DB_USER $DB_NAME > "$BACKUP_DIR/db.sql"

echo "Backup Mattermost file uploads..."
tar czf "$BACKUP_DIR/files.tar.gz" -C "$FILES_DIR" .

echo "Backup done at: $BACKUP_DIR"
