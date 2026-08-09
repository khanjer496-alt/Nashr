#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Nashr — secret rotation helper.
#
#   ./ops/scripts/rotate-secrets.sh <what> [env-file]
#
#   jwt        rotate JWT_SECRET      (logs every user out — see the runbook)
#   redis      rotate REDIS_PASSWORD  (brief cache blip, no data loss)
#   postgres   PRINTS the procedure; it is NOT automated on purpose
#   generate   just print fresh candidate values, change nothing
#
# This script never prints an existing secret. It writes new values into the
# env file in place, keeping a timestamped 0600 backup of the previous file.
# ---------------------------------------------------------------------------
set -euo pipefail

WHAT="${1:-}"
ENV_FILE="${2:-.env.prod}"

log()  { printf '[rotate] %s\n' "$*"; }
fail() { printf '[rotate] ERROR: %s\n' "$*" >&2; exit 1; }

command -v openssl >/dev/null 2>&1 || fail "openssl is required"

case "${WHAT}" in
  generate)
    echo "JWT_SECRET=$(openssl rand -base64 48 | tr -d '\n')"
    echo "POSTGRES_PASSWORD=$(openssl rand -hex 24)"
    echo "REDIS_PASSWORD=$(openssl rand -hex 24)"
    echo "TEMPORAL_POSTGRES_PASSWORD=$(openssl rand -hex 24)"
    echo
    echo "These are candidates only. Nothing was written."
    exit 0
    ;;
  jwt|redis) ;;
  postgres)
    cat <<'PROC'
Rotating POSTGRES_PASSWORD is deliberately manual: the value lives in two
places that must change together, and getting the order wrong locks the app
out of its own database.

  1. Take a backup first:
       ./ops/scripts/backup-postgres.sh

  2. Change the password inside Postgres (the app keeps running on its
     existing connections):
       NEW=$(openssl rand -hex 24)
       docker compose --env-file .env.prod -f docker-compose.prod.yaml \
         exec -T postgres psql -U nashr -d nashr \
         -c "ALTER USER nashr WITH PASSWORD '$NEW';"

  3. Put the SAME value in .env.prod as POSTGRES_PASSWORD.
     (docker-compose.prod.yaml builds DATABASE_URL from it, so there is only
     one place to edit.)

  4. Recreate the app so it picks up the new DATABASE_URL:
       docker compose --env-file .env.prod -f docker-compose.prod.yaml up -d app

  5. Confirm:
       ./ops/scripts/healthcheck.sh
PROC
    exit 0
    ;;
  *)
    echo "usage: rotate-secrets.sh {jwt|redis|postgres|generate} [env-file]" >&2
    exit 2
    ;;
esac

[ -f "${ENV_FILE}" ] || fail "env file '${ENV_FILE}' not found"

BACKUP="${ENV_FILE}.bak-$(date -u '+%Y%m%dT%H%M%SZ')"
umask 077
cp -p "${ENV_FILE}" "${BACKUP}"
chmod 600 "${BACKUP}"
log "previous env file saved to ${BACKUP} (mode 600 — delete it once the rotation is confirmed)"

# Replaces (or appends) KEY=VALUE in the env file.
#
# The value is passed through the ENVIRONMENT rather than `awk -v`, because -v
# interprets backslash escapes and a generated secret must land byte-for-byte.
set_var() {
  local key="$1" value="$2" tmp
  tmp="$(mktemp "${ENV_FILE}.tmp.XXXXXX")"
  chmod 600 "${tmp}"
  if ! NASHR_ROTATE_KEY="${key}" NASHR_ROTATE_VAL="${value}" awk '
    BEGIN { key = ENVIRON["NASHR_ROTATE_KEY"]; val = ENVIRON["NASHR_ROTATE_VAL"]; done = 0 }
    {
      if (!done && $0 ~ "^[ \t]*" key "[ \t]*=" && $0 !~ "^[ \t]*#") {
        print key "=" val
        done = 1
      } else {
        print $0
      }
    }
    END { if (!done) print key "=" val }
  ' "${ENV_FILE}" > "${tmp}"; then
    rm -f "${tmp}"
    fail "could not rewrite ${ENV_FILE}"
  fi
  mv "${tmp}" "${ENV_FILE}"
  chmod 600 "${ENV_FILE}"
}

case "${WHAT}" in
  jwt)
    NEW="$(openssl rand -base64 48 | tr -d '\n')"
    set_var JWT_SECRET "${NEW}"
    unset NEW
    chmod 600 "${ENV_FILE}"
    log "JWT_SECRET rotated in ${ENV_FILE} (value not printed)"
    cat <<'NEXT'

Next steps — do these deliberately, they are customer-visible:

  1. EVERY logged-in user is signed out the moment the app restarts. Tell
     customers first if it is during working hours.
  2. Restart the app:
       docker compose --env-file .env.prod -f docker-compose.prod.yaml up -d app
  3. Verify:
       ./ops/scripts/healthcheck.sh
  4. Log in yourself to confirm authentication works.
  5. Delete the .bak- file once confirmed.
NEXT
    ;;
  redis)
    NEW="$(openssl rand -hex 24)"
    set_var REDIS_PASSWORD "${NEW}"
    unset NEW
    chmod 600 "${ENV_FILE}"
    log "REDIS_PASSWORD rotated in ${ENV_FILE} (value not printed)"
    cat <<'NEXT'

Next steps:

  1. Recreate redis and the app together — the app's REDIS_URL is built from
     this value, so they must change in the same operation:
       docker compose --env-file .env.prod -f docker-compose.prod.yaml up -d redis app
  2. Verify:
       ./ops/scripts/healthcheck.sh

Cached data is discarded, not lost: Redis is a cache and a queue here, and
Temporal owns the durable scheduling state.
NEXT
    ;;
esac
