#!/bin/bash
# Backup diário do banco do histórico (SQLite) com retenção de 14 dias.
# Usa a API de backup do SQLite dentro do container: cópia consistente
# mesmo com o app gravando.
#
# Instalar (uma vez):  (crontab -l 2>/dev/null; echo "15 3 * * * $HOME/divup/scripts/backup_db.sh >> $HOME/divup/data/backups/backup.log 2>&1") | crontab -
set -euo pipefail

CONTAINER=divup-api-dev
STAMP=$(date +%Y%m%d)

mkdir -p "$HOME/divup/data/backups"
docker exec "$CONTAINER" python -c "
import sqlite3
src = sqlite3.connect('/app/data/divup.db')
dst = sqlite3.connect('/app/data/backups/divup-$STAMP.db')
src.backup(dst)
dst.close(); src.close()
"
find "$HOME/divup/data/backups" -name 'divup-*.db' -mtime +14 -delete
echo "$(date -Iseconds) backup ok: divup-$STAMP.db"
