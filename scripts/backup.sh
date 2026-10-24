#!/bin/bash
# Backup script for CyberSentinel
# Usage: ./scripts/backup.sh [full|incremental]

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-./backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/cybersentinel_backup_${TIMESTAMP}.sql.gz"

mkdir -p "${BACKUP_DIR}"

echo "[$(date -Iseconds)] Starting database backup..."

# Create database backup
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec -T postgres \
  pg_dump -U cybersentinel cybersentinel | gzip > "${BACKUP_FILE}"

echo "[$(date -Iseconds)] Database backup saved to ${BACKUP_FILE}"

# Backup ML models
MODEL_BACKUP="${BACKUP_DIR}/ml_models_${TIMESTAMP}.tar.gz"
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec -T ml-service \
  tar czf - /app/models/ 2>/dev/null > "${MODEL_BACKUP}" || true

echo "[$(date -Iseconds)] ML models backup saved to ${MODEL_BACKUP}"

# Rotate old backups (keep last 7 days)
find "${BACKUP_DIR}" -name "cybersentinel_backup_*.sql.gz" -mtime +7 -delete 2>/dev/null || true
find "${BACKUP_DIR}" -name "ml_models_*.tar.gz" -mtime +7 -delete 2>/dev/null || true

echo "[$(date -Iseconds)] Backup complete. Old backups (>7 days) rotated."
