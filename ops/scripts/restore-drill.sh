#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Nashr — automated restore drill.
#
#   ./ops/scripts/restore-drill.sh [dump-file]
#
# Restores the most recent PRODUCTION dump into an isolated throwaway Postgres
# container (never staging, never production) and reports row counts for the
# tables that matter. Run monthly. An untested backup is not a backup.
#
# Exit 0 = the backup restored cleanly and contains plausible data.
# ---------------------------------------------------------------------------
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/nashr}"
PG_IMAGE="postgres:17.7-alpine@sha256:bb377b7239d2774ac8cc76f481596ce96c5a6b5e9d141f6d0a0ee371a6e7c0f2"
CONTAINER="nashr-restore-drill-$$"

log()  { printf '%s [drill] %s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "$*"; }
fail() { printf '%s [drill] ERROR: %s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "$*" >&2; exit 1; }

DUMP_FILE="${1:-}"
if [ -z "${DUMP_FILE}" ]; then
  DUMP_FILE="$(find "${BACKUP_DIR}/daily" -maxdepth 1 -type f -name 'nashr-prod-*.dump' ! -name '*.sha256' 2>/dev/null \
               | sort | tail -n 1)"
  [ -z "${DUMP_FILE}" ] && fail "no dump found in ${BACKUP_DIR}/daily — has backup-postgres.sh ever run?"
fi
[ -f "${DUMP_FILE}" ] || fail "dump '${DUMP_FILE}' not found"
log "drilling with: ${DUMP_FILE}"

if [ -f "${DUMP_FILE}.sha256" ]; then
  ( cd "$(dirname "${DUMP_FILE}")" && sha256sum --check --status "$(basename "${DUMP_FILE}").sha256" ) \
    || fail "checksum mismatch — this backup is CORRUPT"
  log "checksum ok"
fi

WORK_FILE="${DUMP_FILE}"
TMP_PLAIN=""
case "${DUMP_FILE}" in
  *.enc)
    [ -n "${BACKUP_PASSPHRASE_FILE:-}" ] || fail "encrypted dump; set BACKUP_PASSPHRASE_FILE"
    TMP_PLAIN="$(mktemp -t nashr-drill-XXXXXX.dump)"; chmod 600 "${TMP_PLAIN}"
    openssl enc -d -aes-256-cbc -pbkdf2 -iter 600000 -in "${DUMP_FILE}" -out "${TMP_PLAIN}" \
      -pass "file:${BACKUP_PASSPHRASE_FILE}" || fail "decryption failed"
    WORK_FILE="${TMP_PLAIN}"
    ;;
esac

DRILL_PW="$(openssl rand -hex 24)"

cleanup() {
  docker rm -f "${CONTAINER}" >/dev/null 2>&1 || true
  [ -n "${TMP_PLAIN}" ] && { shred -u "${TMP_PLAIN}" 2>/dev/null || rm -f "${TMP_PLAIN}"; }
  unset DRILL_PW
}
trap cleanup EXIT INT TERM

log "starting a throwaway Postgres (no volume, no network, discarded at the end)"
docker run -d --rm --name "${CONTAINER}" \
  --network none \
  -e POSTGRES_PASSWORD="${DRILL_PW}" \
  -e POSTGRES_USER=drill \
  -e POSTGRES_DB=drill \
  "${PG_IMAGE}" >/dev/null

for _ in $(seq 1 45); do
  docker exec "${CONTAINER}" pg_isready -U drill -q >/dev/null 2>&1 && break
  sleep 2
done
docker exec "${CONTAINER}" pg_isready -U drill -q || fail "throwaway Postgres never became ready"

START="$(date +%s)"
log "restoring..."
docker exec -i "${CONTAINER}" pg_restore --username drill --dbname drill \
  --no-owner --no-privileges --exit-on-error < "${WORK_FILE}" \
  || fail "RESTORE FAILED — this backup is not usable. Investigate immediately."
ELAPSED=$(( $(date +%s) - START ))
log "restore succeeded in ${ELAPSED}s (this is your measured RTO for the database step)"

log "sanity-checking contents"
q() { docker exec -i "${CONTAINER}" psql -U drill -d drill -tAc "$1" 2>/dev/null | tr -d '[:space:]'; }

TABLES="$(q "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'")"
[ "${TABLES:-0}" -lt 20 ] && fail "only ${TABLES} tables restored — expected ~50. The backup is incomplete."
log "tables restored: ${TABLES}"

for t in User Organization Integration Post; do
  n="$(q "SELECT count(*) FROM \"${t}\"")"
  if [ -z "${n}" ]; then
    log "WARNING: table \"${t}\" not present or not readable"
  else
    log "  ${t}: ${n} row(s)"
  fi
done

MIGRATIONS="$(q "SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NOT NULL")"
if [ -n "${MIGRATIONS}" ]; then
  log "applied migrations recorded in the dump: ${MIGRATIONS}"
else
  log "WARNING: no _prisma_migrations table — this dump predates the migration baseline"
fi

echo
log "DRILL PASSED. Record the date, the dump used, and the ${ELAPSED}s restore time in BACKUP_AND_RECOVERY.md's drill log."
