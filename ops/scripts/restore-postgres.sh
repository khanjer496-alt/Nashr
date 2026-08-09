#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Nashr — PostgreSQL restore.
#
#   ./ops/scripts/restore-postgres.sh <dump-file> [compose-file] [env-file]
#
# Example (the monthly drill, into staging):
#   ./ops/scripts/restore-postgres.sh \
#       /var/backups/nashr/daily/nashr-prod-20260808T020000Z.dump \
#       docker-compose.staging.yaml .env.staging
#
# Safety properties, in order of importance:
#   1. It refuses to touch a PRODUCTION database unless you type the database
#      name AND pass --i-know-this-destroys-data. Restoring over live data is
#      the single most destructive operation in this runbook.
#   2. It takes a safety dump of the CURRENT database first, so a bad restore
#      is itself recoverable.
#   3. It verifies the archive before dropping anything.
#   4. It stops the app so no writes race the restore.
#
# See BACKUP_AND_RECOVERY.md for the full drill.
# ---------------------------------------------------------------------------
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${REPO_ROOT}"

log()  { printf '%s [restore] %s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "$*"; }
fail() { printf '%s [restore] ERROR: %s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "$*" >&2; exit 1; }

DUMP_FILE="${1:-}"
COMPOSE_FILE="${2:-docker-compose.staging.yaml}"
ENV_FILE="${3:-.env.staging}"
FORCE="${4:-}"

if [ -z "${DUMP_FILE}" ]; then
  cat >&2 <<'USAGE'
usage: restore-postgres.sh <dump-file> [compose-file] [env-file] [--i-know-this-destroys-data]

  dump-file     .dump or .dump.enc produced by ops/scripts/backup-postgres.sh
  compose-file  default: docker-compose.staging.yaml   (deliberately NOT production)
  env-file      default: .env.staging
USAGE
  exit 2
fi

[ -f "${DUMP_FILE}" ]    || fail "dump file '${DUMP_FILE}' not found"
[ -f "${COMPOSE_FILE}" ] || fail "compose file '${COMPOSE_FILE}' not found"
[ -f "${ENV_FILE}" ]     || fail "env file '${ENV_FILE}' not found"

envget() {
  local key="$1" line
  line="$(grep -E "^[[:space:]]*${key}[[:space:]]*=" "${ENV_FILE}" 2>/dev/null | grep -v '^[[:space:]]*#' | tail -n 1 || true)"
  [ -z "${line}" ] && return 0
  line="${line#*=}"
  line="$(printf '%s' "${line}" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')"
  line="${line%\"}"; line="${line#\"}"
  line="${line%\'}"; line="${line#\'}"
  printf '%s' "${line}"
}

case "${COMPOSE_FILE}" in
  *staging*) IS_PROD=0; PG_USER="$(envget POSTGRES_USER)"; PG_USER="${PG_USER:-nashr_staging}"; PG_DB="$(envget POSTGRES_DB)"; PG_DB="${PG_DB:-nashr_staging}" ;;
  *)         IS_PROD=1; PG_USER="$(envget POSTGRES_USER)"; PG_USER="${PG_USER:-nashr}";         PG_DB="$(envget POSTGRES_DB)"; PG_DB="${PG_DB:-nashr}" ;;
esac

compose() { docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" "$@"; }

# --- 0. checksum -----------------------------------------------------------
if [ -f "${DUMP_FILE}.sha256" ]; then
  log "verifying sha256"
  ( cd "$(dirname "${DUMP_FILE}")" && sha256sum --check --status "$(basename "${DUMP_FILE}").sha256" ) \
    || fail "checksum MISMATCH for ${DUMP_FILE}. Do not restore this file."
  log "checksum ok"
else
  log "WARNING: no ${DUMP_FILE}.sha256 next to the dump — integrity unverified"
fi

# --- 1. decrypt if needed --------------------------------------------------
WORK_FILE="${DUMP_FILE}"
TMP_PLAIN=""
case "${DUMP_FILE}" in
  *.enc)
    [ -n "${BACKUP_PASSPHRASE_FILE:-}" ] || fail "'${DUMP_FILE}' is encrypted; set BACKUP_PASSPHRASE_FILE=/path/to/passphrase"
    [ -r "${BACKUP_PASSPHRASE_FILE}" ]   || fail "BACKUP_PASSPHRASE_FILE is not readable"
    TMP_PLAIN="$(mktemp -t nashr-restore-XXXXXX.dump)"
    chmod 600 "${TMP_PLAIN}"
    log "decrypting"
    openssl enc -d -aes-256-cbc -pbkdf2 -iter 600000 \
      -in "${DUMP_FILE}" -out "${TMP_PLAIN}" \
      -pass "file:${BACKUP_PASSPHRASE_FILE}" \
      || fail "decryption failed (wrong passphrase, or the file is corrupt)"
    WORK_FILE="${TMP_PLAIN}"
    ;;
esac
# NOTE: this MUST end with an explicit success. As an EXIT trap, the function's
# status replaces the script's, and a bare `[ -n "${TMP_PLAIN}" ] && ...` returns
# 1 whenever TMP_PLAIN is empty (the unencrypted path) -- making a SUCCESSFUL
# restore report failure. The encrypted path sets TMP_PLAIN, which hid this.
cleanup() {
  if [ -n "${TMP_PLAIN}" ]; then
    shred -u "${TMP_PLAIN}" 2>/dev/null || rm -f "${TMP_PLAIN}"
  fi
  return 0
}
trap cleanup EXIT INT TERM

# --- 2. confirmation -------------------------------------------------------
if [ "${IS_PROD}" -eq 1 ]; then
  cat <<BANNER

  ============================================================
   YOU ARE ABOUT TO OVERWRITE THE PRODUCTION DATABASE
     compose : ${COMPOSE_FILE}
     database: ${PG_DB}
     source  : ${DUMP_FILE}
   Every row written since that dump will be lost.
  ============================================================

BANNER
  if [ "${FORCE}" != "--i-know-this-destroys-data" ]; then
    fail "refusing: pass --i-know-this-destroys-data as the 4th argument to proceed"
  fi
  printf 'Type the database name (%s) to confirm: ' "${PG_DB}"
  read -r typed
  [ "${typed}" = "${PG_DB}" ] || fail "confirmation did not match. Nothing was changed."
fi

# --- 3. verify the archive BEFORE destroying anything ----------------------
log "verifying archive contents"
compose up -d postgres >/dev/null
# Give Postgres a moment to accept connections.
for _ in $(seq 1 30); do
  if compose exec -T postgres pg_isready -U "${PG_USER}" -q >/dev/null 2>&1; then break; fi
  sleep 2
done
compose exec -T postgres pg_restore --list > /dev/null < "${WORK_FILE}" \
  || fail "the archive is not a readable pg_dump file — aborting before any change"
log "archive ok"

# --- 4. stop writers -------------------------------------------------------
log "stopping app and orchestrator so nothing writes during the restore"
compose stop app >/dev/null 2>&1 || true

# --- 5. safety dump of the CURRENT state -----------------------------------
SAFETY_DIR="${SAFETY_DIR:-/var/backups/nashr/pre-restore}"
mkdir -p "${SAFETY_DIR}"; chmod 700 "${SAFETY_DIR}"
SAFETY_FILE="${SAFETY_DIR}/pre-restore-${PG_DB}-$(date -u '+%Y%m%dT%H%M%SZ').dump"
log "taking a safety dump of the current database first"
umask 077
if compose exec -T postgres pg_dump --format=custom --compress=9 --no-owner --no-privileges \
     --username "${PG_USER}" --dbname "${PG_DB}" > "${SAFETY_FILE}" 2>/dev/null; then
  log "safety dump: ${SAFETY_FILE}"
else
  rm -f "${SAFETY_FILE}"
  log "WARNING: could not take a safety dump (database may not exist yet) — continuing"
fi

# --- 6. restore ------------------------------------------------------------
# --clean --if-exists drops and recreates each object. --single-transaction
# makes the whole restore atomic: a failure halfway leaves the old data intact.
log "restoring into '${PG_DB}'"
if compose exec -T postgres pg_restore \
      --username "${PG_USER}" --dbname "${PG_DB}" \
      --clean --if-exists --no-owner --no-privileges \
      --single-transaction --exit-on-error < "${WORK_FILE}"; then
  log "restore completed"
else
  fail "restore FAILED. The transaction rolled back, so the database is unchanged. Safety dump: ${SAFETY_FILE:-none}"
fi

# --- 7. apply any newer migrations ----------------------------------------
# A dump from an older release can be behind the image's schema.
log "starting app (its entrypoint runs 'prisma migrate deploy')"
compose up -d app >/dev/null

log "waiting for the app to report healthy"
for i in $(seq 1 60); do
  state="$(docker inspect --format '{{.State.Health.Status}}' "$(compose ps -q app)" 2>/dev/null || echo starting)"
  if [ "${state}" = "healthy" ]; then
    log "app healthy after ${i} checks"
    break
  fi
  sleep 5
done

cat <<'NEXT'

Restore finished. Now verify by hand — see BACKUP_AND_RECOVERY.md "Post-restore verification":
  1. Log in as a known user.
  2. Open the calendar and confirm scheduled posts are present.
  3. Confirm at least one social integration still shows as connected.
  4. Publish one test post to a throwaway channel.
NEXT
