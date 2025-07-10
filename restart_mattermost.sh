#!/bin/bash

set -e

echo "=== [0/4] Ensure clean local volume folders (bind mounts) ==="

VOLUMES=(db_data grafana_data loki_data promtail_data mattermost_data)

for VOL in "${VOLUMES[@]}"; do
  echo "→ Checking volume folder: $VOL"
  if [ -d "$VOL" ]; then
    echo "   ✅ Exists, cleaning: $VOL/*"
    rm -rf "$VOL"/*
  else
    echo "   ❌ Not found, creating: $VOL"
    mkdir -p "$VOL"
  fi
  chmod -R 777 "$VOL"
done

# Fix known nested paths (like logs)
mkdir -p mattermost_data/logs
chmod -R 777 mattermost_data/logs

mkdir -p loki_data/wal loki_data/index loki_data/chunks loki_data/compactor
chmod -R 777 loki_data

echo "=== [1/4] Stop and remove all containers & volumes ==="
docker-compose down -v
docker volume prune -f

echo "=== [2/4] Skip chown on macOS for protected paths ==="

echo "=== [3/4] Restarting Mattermost stack ==="
docker-compose up --scale mattermost=3 -d

echo "=== [4/4] ✅ Stack restarted successfully. All bind volumes are clean and mounted ==="
