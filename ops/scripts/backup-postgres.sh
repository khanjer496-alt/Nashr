#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Nashr — PostgreSQL backup.
#
# Dumps the application database from the running stack, verifies the dump is
# readable, optionally encrypts it, applies daily/weekly/monthly retention, and
# optionally uploads to Cloudflare R2 (S3-compatible).
#
#   ./ops/scripts/backup-postgres.sh                       # production
#   ./ops/scripts/backup-postgres.sh docker-compose.staging.yaml .env.staging
#
# Closes RISK-04 together with ops/scripts/restore-postgres.sh. A backup that
# has never been restored is not a backup — see BACKUP_AND_RECOVERY.md for the
# restore drill you are expected to run monthly.
#
# Secrets: this script never prints a password, a connection string, or the
# contents of the env file. Postgres is reached over the container's local
# UNIX socket, so no credential is ever placed on a command line.
# ---------------------------------------------------------------------------
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${REPO_ROOT}"

COMPOSE_FILE="${1:-docker-compose.prod.yaml}"
ENV_FILE="${2:-.env.prod}"

BACKUP_DIR="${BACKUP_DIR:-/var/backups/nashr}"
RETENTION_DAILY_DAYS="${RETENTION_DAILY_DAYS:-14}"
RETENTION_WEEKLY_DAYS="${RETENTION_WEEKLY_DAYS:-56}"    # 8 weeks
RETENTION_MONTHLY_DAYS="${RETENTION_MONTHLY_DAYS:-365}" # 12 months
LOCK_DIR="${LOCK_DIR:-/var/lock/nashr-backup.lock}"

log()  { printf '%s [backup] %s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "$*"; }
fail() { printf '%s [backup] ERROR: %s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "$*" >&2; exit 1; }

[ -f "${COMPOSE_FILE}" ] || fail "compose file '${COMPOSE_FILE}' not found"
[ -f "${ENV_FILE}" ]     || fail "env file '${ENV_FILE}' not found"

# --- read a value out of the env file without sourcing it ------------------
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

PG_USER="$(envget POSTGRES_USER)"
PG_DB="$(envget POSTGRES_DB)"
case "${COMPOSE_FILE}" in
  *staging*) PG_USER="${PG_USER:-nashr_staging}"; PG_DB="${PG_DB:-nashr_staging}"; LABEL="staging" ;;
  *)         PG_USER="${PG_USER:-nashr}";         PG_DB="${PG_DB:-nashr}";         LABEL="prod" ;;
esac

# --- single instance -------------------------------------------------------
# mkdir is atomic on every POSIX filesystem, unlike a test-then-create file.
mkdir -p "$(dirname "${LOCK_DIR}")"
if ! mkdir "${LOCK_DIR}" 2>/dev/null; then
  fail "another backup is already running (lock: ${LOCK_DIR}). Remove it manually only after confirming no pg_dump is active."
fi
cleanup() { rmdir "${LOCK_DIR}" 2>/dev/null || true; }
trap cleanup EXIT INT TERM

# --- paths -----------------------------------------------------------------
STAMP="$(date -u '+%Y%m%dT%H%M%SZ')"
DOW="$(date -u '+%u')"   # 7 = Sunday
DOM="$(date -u '+%d')"

mkdir -p "${BACKUP_DIR}/daily" "${BACKUP_DIR}/weekly" "${BACKUP_DIR}/monthly"
chmod 700 "${BACKUP_DIR}" "${BACKUP_DIR}/daily" "${BACKUP_DIR}/weekly" "${BACKUP_DIR}/monthly"

BASENAME="nashr-${LABEL}-${STAMP}.dump"
TMP_FILE="${BACKUP_DIR}/daily/.${BASENAME}.partial"
OUT_FILE="${BACKUP_DIR}/daily/${BASENAME}"

compose() { docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" "$@"; }

# --- 1. dump ---------------------------------------------------------------
# --format=custom is what makes selective restore and parallel restore
# possible later; plain SQL would not.
log "dumping database '${PG_DB}' from the ${LABEL} stack"
umask 077
if ! compose exec -T postgres \
      pg_dump --format=custom --compress=9 --no-owner --no-privileges \
              --username "${PG_USER}" --dbname "${PG_DB}" > "${TMP_FILE}"; then
  rm -f "${TMP_FILE}"
  fail "pg_dump failed. Is the ${LABEL} stack running?  docker compose -f ${COMPOSE_FILE} ps"
fi

SIZE="$(stat -c '%s' "${TMP_FILE}" 2>/dev/null || echo 0)"
if [ "${SIZE}" -lt 1024 ]; then
  rm -f "${TMP_FILE}"
  fail "dump is only ${SIZE} bytes — refusing to keep a backup that is almost certainly empty"
fi

# --- 2. verify -------------------------------------------------------------
# Reading the archive's table of contents proves the file is a well-formed
# pg_dump archive and not a truncated stream or an error message.
log "verifying archive readability"
if ! compose exec -T postgres pg_restore --list > /dev/null < "${TMP_FILE}"; then
  rm -f "${TMP_FILE}"
  fail "pg_restore --list rejected the dump; the backup is corrupt and was discarded"
fi

mv "${TMP_FILE}" "${OUT_FILE}"
chmod 600 "${OUT_FILE}"
log "dump ok: ${OUT_FILE} ($(numfmt --to=iec "${SIZE}" 2>/dev/null || echo "${SIZE}B"))"

# --- 3. optional encryption ------------------------------------------------
# The dump contains every customer's social OAuth access and refresh tokens
# (RISK-05). Encrypt it whenever it will leave this host.
PASSPHRASE_FILE="${BACKUP_PASSPHRASE_FILE:-}"
if [ -n "${PASSPHRASE_FILE}" ]; then
  [ -r "${PASSPHRASE_FILE}" ] || fail "BACKUP_PASSPHRASE_FILE='${PASSPHRASE_FILE}' is not readable"
  command -v openssl >/dev/null 2>&1 || fail "openssl not found but BACKUP_PASSPHRASE_FILE is set"
  log "encrypting backup (aes-256-cbc, pbkdf2)"
  openssl enc -aes-256-cbc -salt -pbkdf2 -iter 600000 \
    -in "${OUT_FILE}" -out "${OUT_FILE}.enc" \
    -pass "file:${PASSPHRASE_FILE}"
  shred -u "${OUT_FILE}" 2>/dev/null || rm -f "${OUT_FILE}"
  OUT_FILE="${OUT_FILE}.enc"
  chmod 600 "${OUT_FILE}"
fi

# --- 4. checksum -----------------------------------------------------------
( cd "$(dirname "${OUT_FILE}")" && sha256sum "$(basename "${OUT_FILE}")" > "$(basename "${OUT_FILE}").sha256" )
chmod 600 "${OUT_FILE}.sha256"

# --- 5. promote to weekly / monthly ---------------------------------------
# Hard links, so a promoted copy costs no extra disk until the daily is pruned.
if [ "${DOW}" = "7" ]; then
  ln -f "${OUT_FILE}" "${BACKUP_DIR}/weekly/$(basename "${OUT_FILE}")"
  ln -f "${OUT_FILE}.sha256" "${BACKUP_DIR}/weekly/$(basename "${OUT_FILE}").sha256"
  log "promoted to weekly"
fi
if [ "${DOM}" = "01" ]; then
  ln -f "${OUT_FILE}" "${BACKUP_DIR}/monthly/$(basename "${OUT_FILE}")"
  ln -f "${OUT_FILE}.sha256" "${BACKUP_DIR}/monthly/$(basename "${OUT_FILE}").sha256"
  log "promoted to monthly"
fi

# --- 6. off-host upload ----------------------------------------------------
# Cloudflare R2 is S3-compatible, so the AWS CLI works against it with an
# --endpoint-url. rclone is accepted as an alternative.
R2_BUCKET="$(envget BACKUP_R2_BUCKET)"
if [ -n "${R2_BUCKET}" ]; then
  R2_ACCOUNT="$(envget BACKUP_R2_ACCOUNT_ID)"
  [ -z "${R2_ACCOUNT}" ] && R2_ACCOUNT="$(envget CLOUDFLARE_ACCOUNT_ID)"
  R2_PREFIX="$(envget BACKUP_R2_PREFIX)"; R2_PREFIX="${R2_PREFIX:-postgres/${LABEL}}"

  if [ -z "${R2_ACCOUNT}" ]; then
    log "WARNING: BACKUP_R2_BUCKET is set but no BACKUP_R2_ACCOUNT_ID / CLOUDFLARE_ACCOUNT_ID — skipping upload"
  elif command -v aws >/dev/null 2>&1; then
    # Credentials come from the environment the caller set up (see
    # ops/systemd/nashr-backup.service). They are never echoed here.
    AWS_ACCESS_KEY_ID="${BACKUP_R2_ACCESS_KEY_ID:-$(envget BACKUP_R2_ACCESS_KEY_ID)}" \
    AWS_SECRET_ACCESS_KEY="${BACKUP_R2_SECRET_ACCESS_KEY:-$(envget BACKUP_R2_SECRET_ACCESS_KEY)}" \
    AWS_DEFAULT_REGION=auto \
    aws s3 cp "${OUT_FILE}" "s3://${R2_BUCKET}/${R2_PREFIX}/$(basename "${OUT_FILE}")" \
        --endpoint-url "https://${R2_ACCOUNT}.r2.cloudflarestorage.com" \
        --only-show-errors \
      && log "uploaded to r2://${R2_BUCKET}/${R2_PREFIX}/" \
      || log "WARNING: upload to R2 FAILED — the local copy is intact, investigate before the next retention run"
  elif command -v rclone >/dev/null 2>&1 && [ -n "${BACKUP_RCLONE_REMOTE:-}" ]; then
    rclone copy "${OUT_FILE}" "${BACKUP_RCLONE_REMOTE}/${R2_PREFIX}/" --quiet \
      && log "uploaded via rclone to ${BACKUP_RCLONE_REMOTE}/${R2_PREFIX}/" \
      || log "WARNING: rclone upload FAILED — the local copy is intact"
  else
    log "WARNING: BACKUP_R2_BUCKET is set but neither 'aws' nor 'rclone' is installed. Install one:  apt-get install -y awscli   (or see BACKUP_AND_RECOVERY.md)"
  fi
else
  log "WARNING: BACKUP_R2_BUCKET unset — this backup exists ONLY on this host. Losing the host loses the backup (RISK-04)."
fi

# --- 7. retention ----------------------------------------------------------
prune() {
  local dir="$1" days="$2" removed
  removed="$(find "${dir}" -maxdepth 1 -type f -mtime "+${days}" -print -delete | wc -l | tr -d ' ')"
  log "retention: removed ${removed} file(s) older than ${days} days from ${dir}"
}
prune "${BACKUP_DIR}/daily"   "${RETENTION_DAILY_DAYS}"
prune "${BACKUP_DIR}/weekly"  "${RETENTION_WEEKLY_DAYS}"
prune "${BACKUP_DIR}/monthly" "${RETENTION_MONTHLY_DAYS}"

DAILY_COUNT="$(find "${BACKUP_DIR}/daily" -maxdepth 1 -type f -name '*.dump*' ! -name '*.sha256' | wc -l | tr -d ' ')"
log "done. ${DAILY_COUNT} daily backup(s) retained in ${BACKUP_DIR}/daily"
