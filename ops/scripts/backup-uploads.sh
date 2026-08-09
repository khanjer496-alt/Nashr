#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Nashr — uploads backup.
#
#   ./ops/scripts/backup-uploads.sh [compose-file] [env-file]
#
# Only relevant when STORAGE_PROVIDER=local: media then lives in the
# nashr-<env>-uploads Docker volume and is NOT covered by the Postgres backup.
# Losing it leaves the database full of rows pointing at files that no longer
# exist — posts render with broken images.
#
# With STORAGE_PROVIDER=cloudflare the objects are already in R2 and this
# script exits early; enable R2 bucket versioning instead (see
# BACKUP_AND_RECOVERY.md).
# ---------------------------------------------------------------------------
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${REPO_ROOT}"

COMPOSE_FILE="${1:-docker-compose.prod.yaml}"
ENV_FILE="${2:-.env.prod}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/nashr}"
RETENTION_DAYS="${UPLOADS_RETENTION_DAYS:-14}"

log()  { printf '%s [uploads] %s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "$*"; }
fail() { printf '%s [uploads] ERROR: %s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "$*" >&2; exit 1; }

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

if [ "$(envget STORAGE_PROVIDER)" != "local" ]; then
  log "STORAGE_PROVIDER is not 'local' — media lives in R2 and is not backed up here. Enable bucket versioning on the R2 bucket instead."
  exit 0
fi

case "${COMPOSE_FILE}" in
  *staging*) LABEL="staging" ;;
  *)         LABEL="prod" ;;
esac
VOLUME="nashr-${LABEL}-uploads"

docker volume inspect "${VOLUME}" >/dev/null 2>&1 || fail "docker volume '${VOLUME}' does not exist"

STAMP="$(date -u '+%Y%m%dT%H%M%SZ')"
OUT_DIR="${BACKUP_DIR}/uploads"
mkdir -p "${OUT_DIR}"; chmod 700 "${OUT_DIR}"
OUT_FILE="${OUT_DIR}/nashr-${LABEL}-uploads-${STAMP}.tar.gz"
TMP_FILE="${OUT_FILE}.partial"

log "archiving volume '${VOLUME}'"
umask 077
# Read the volume through a throwaway container so the host needs no knowledge
# of Docker's storage layout. Pinned alpine digest: no `:latest` anywhere.
if ! docker run --rm \
      -v "${VOLUME}:/data:ro" \
      alpine:3.21@sha256:48b0309ca019d89d40f670aa1bc06e426dc0931948452e8491e3d65087abc07d \
      tar -czf - -C /data . > "${TMP_FILE}"; then
  rm -f "${TMP_FILE}"
  fail "archiving failed"
fi

SIZE="$(stat -c '%s' "${TMP_FILE}" 2>/dev/null || echo 0)"
[ "${SIZE}" -lt 64 ] && { rm -f "${TMP_FILE}"; fail "archive is ${SIZE} bytes — refusing to keep it"; }

log "verifying archive"
gzip -t "${TMP_FILE}" || { rm -f "${TMP_FILE}"; fail "gzip integrity check failed"; }

mv "${TMP_FILE}" "${OUT_FILE}"
chmod 600 "${OUT_FILE}"
( cd "${OUT_DIR}" && sha256sum "$(basename "${OUT_FILE}")" > "$(basename "${OUT_FILE}").sha256" )
chmod 600 "${OUT_FILE}.sha256"
log "archive ok: ${OUT_FILE} ($(numfmt --to=iec "${SIZE}" 2>/dev/null || echo "${SIZE}B"))"

R2_BUCKET="$(envget BACKUP_R2_BUCKET)"
if [ -n "${R2_BUCKET}" ] && command -v aws >/dev/null 2>&1; then
  R2_ACCOUNT="$(envget BACKUP_R2_ACCOUNT_ID)"; [ -z "${R2_ACCOUNT}" ] && R2_ACCOUNT="$(envget CLOUDFLARE_ACCOUNT_ID)"
  if [ -n "${R2_ACCOUNT}" ]; then
    AWS_ACCESS_KEY_ID="${BACKUP_R2_ACCESS_KEY_ID:-$(envget BACKUP_R2_ACCESS_KEY_ID)}" \
    AWS_SECRET_ACCESS_KEY="${BACKUP_R2_SECRET_ACCESS_KEY:-$(envget BACKUP_R2_SECRET_ACCESS_KEY)}" \
    AWS_DEFAULT_REGION=auto \
    aws s3 cp "${OUT_FILE}" "s3://${R2_BUCKET}/uploads/${LABEL}/$(basename "${OUT_FILE}")" \
        --endpoint-url "https://${R2_ACCOUNT}.r2.cloudflarestorage.com" --only-show-errors \
      && log "uploaded to r2://${R2_BUCKET}/uploads/${LABEL}/" \
      || log "WARNING: R2 upload FAILED — local copy intact"
  fi
fi

removed="$(find "${OUT_DIR}" -maxdepth 1 -type f -mtime "+${RETENTION_DAYS}" -print -delete | wc -l | tr -d ' ')"
log "retention: removed ${removed} file(s) older than ${RETENTION_DAYS} days"
