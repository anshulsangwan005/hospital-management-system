#!/usr/bin/env bash
# Backup & recovery helper for the Hospital Management System.
# Usage:
#   ./backup.sh backup            -> timestamped compressed dump in ./backups
#   ./backup.sh restore FILE      -> restore a dump into the running container
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p backups

case "${1:-}" in
  backup)
    f="backups/hospital_$(date +%Y%m%d_%H%M%S).dump"
    docker compose exec -T db pg_dump -U hms -d hospital -Fc > "$f"
    echo "Backup written to $f"
    ;;
  restore)
    [ -f "${2:-}" ] || { echo "Usage: $0 restore backups/<file>.dump"; exit 1; }
    docker compose exec -T db dropdb -U hms --if-exists hospital_restore
    docker compose exec -T db createdb -U hms hospital_restore
    docker compose exec -T db pg_restore -U hms -d hospital_restore --no-owner < "$2"
    echo "Restored into database 'hospital_restore'. Verify, then swap or rename as needed."
    ;;
  *)
    echo "Usage: $0 {backup|restore FILE}"; exit 1 ;;
esac
