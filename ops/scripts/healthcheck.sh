#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Nashr — host-side health check.
#
#   ./ops/scripts/healthcheck.sh [compose-file] [env-file]
#
# Answers "is the product actually working right now", not just "are the
# containers running". Safe to run from cron/monitoring: exit 0 = healthy,
# 1 = degraded, 2 = down. Prints no secrets.
#
# Checked, in order of what a customer would notice first:
#   1. every compose service is running and (where defined) healthy
#   2. the public URL serves HTTPS with a certificate that is not about to expire
#   3. the API answers
#   4. Temporal accepts connections and has no runaway backlog
#   5. Postgres and Redis accept commands
#   6. disk headroom on the backup and docker volumes
#   7. a recent database backup exists
# ---------------------------------------------------------------------------
set -uo pipefail   # NOT -e: this script reports on failures rather than dying on the first one

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${REPO_ROOT}"

COMPOSE_FILE="${1:-docker-compose.prod.yaml}"
ENV_FILE="${2:-.env.prod}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/nashr}"
BACKUP_MAX_AGE_HOURS="${BACKUP_MAX_AGE_HOURS:-30}"
DISK_WARN_PERCENT="${DISK_WARN_PERCENT:-85}"
CERT_WARN_DAYS="${CERT_WARN_DAYS:-14}"

FAILURES=0
DEGRADED=0

red()   { printf '\033[31m%s\033[0m\n' "$*"; }
amber() { printf '\033[33m%s\033[0m\n' "$*"; }
green() { printf '\033[32m%s\033[0m\n' "$*"; }

down()   { red   "  DOWN      $*"; FAILURES=$((FAILURES + 1)); }
degrade(){ amber "  DEGRADED  $*"; DEGRADED=$((DEGRADED + 1)); }
ok()     { green "  ok        $*"; }

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

compose() { docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" "$@"; }

case "${COMPOSE_FILE}" in
  *staging*) DOMAIN="$(envget NASHR_STAGING_DOMAIN)"; LABEL="staging" ;;
  *)         DOMAIN="$(envget NASHR_DOMAIN)";         LABEL="prod" ;;
esac

echo
echo "Nashr health check — ${LABEL} — $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
echo

# --- 1. containers ---------------------------------------------------------
echo "[1/7] Containers"
if ! docker info >/dev/null 2>&1; then
  down "cannot talk to the Docker daemon"
else
  while read -r name state health; do
    [ -z "${name}" ] && continue
    if [ "${state}" != "running" ]; then
      down "${name} is ${state}"
    elif [ "${health}" = "unhealthy" ]; then
      down "${name} is running but UNHEALTHY"
    elif [ "${health}" = "starting" ]; then
      degrade "${name} health is still starting"
    else
      ok "${name} (${state}${health:+, ${health}})"
    fi
  done < <(compose ps --format '{{.Name}} {{.State}} {{.Health}}' 2>/dev/null)
fi

# --- 2. public endpoint + certificate -------------------------------------
echo "[2/7] Public endpoint"
if [ -z "${DOMAIN}" ]; then
  degrade "domain not configured in ${ENV_FILE} — skipping external checks"
else
  code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 15 "https://${DOMAIN}/" 2>/dev/null || echo 000)"
  case "${code}" in
    000) down "https://${DOMAIN}/ did not respond" ;;
    5*)  down "https://${DOMAIN}/ returned HTTP ${code}" ;;
    4*)  degrade "https://${DOMAIN}/ returned HTTP ${code}" ;;
    *)   ok "https://${DOMAIN}/ -> HTTP ${code}" ;;
  esac

  if command -v openssl >/dev/null 2>&1; then
    end="$(echo | openssl s_client -servername "${DOMAIN}" -connect "${DOMAIN}:443" 2>/dev/null \
          | openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2)"
    if [ -n "${end}" ]; then
      end_epoch="$(date -d "${end}" +%s 2>/dev/null || echo 0)"
      now_epoch="$(date +%s)"
      if [ "${end_epoch}" -gt 0 ]; then
        days=$(( (end_epoch - now_epoch) / 86400 ))
        if   [ "${days}" -lt 0 ];                     then down    "TLS certificate EXPIRED ${days#-} days ago"
        elif [ "${days}" -lt "${CERT_WARN_DAYS}" ];   then degrade "TLS certificate expires in ${days} days — Caddy renews at 30 days, so this means renewal is failing"
        else ok "TLS certificate valid for ${days} more days"
        fi
      fi
    else
      degrade "could not read the TLS certificate"
    fi
  fi
fi

# --- 3. API ----------------------------------------------------------------
echo "[3/7] API"
api_out="$(compose exec -T app curl -fsS --max-time 10 http://127.0.0.1:3000/ 2>/dev/null || echo '')"
if [ -n "${api_out}" ]; then ok "backend responds on :3000"; else down "backend did not respond on :3000"; fi
if compose exec -T app curl -fsS --max-time 10 http://127.0.0.1:3002/health/status >/dev/null 2>&1; then
  ok "orchestrator health endpoint responds (Temporal reachable)"
else
  down "orchestrator /health/status failed — Temporal connection is broken, so NOTHING WILL PUBLISH"
fi

# --- 4. Temporal -----------------------------------------------------------
echo "[4/7] Temporal"
if compose exec -T temporal tctl --address 127.0.0.1:7233 cluster health >/dev/null 2>&1; then
  ok "temporal cluster health"
else
  down "temporal cluster health failed"
fi

# --- 5. datastores ---------------------------------------------------------
echo "[5/7] Datastores"
PG_USER="$(envget POSTGRES_USER)"; PG_DB="$(envget POSTGRES_DB)"
case "${LABEL}" in
  staging) PG_USER="${PG_USER:-nashr_staging}"; PG_DB="${PG_DB:-nashr_staging}" ;;
  *)       PG_USER="${PG_USER:-nashr}";         PG_DB="${PG_DB:-nashr}" ;;
esac
if compose exec -T postgres pg_isready -U "${PG_USER}" -d "${PG_DB}" -q >/dev/null 2>&1; then
  ok "postgres accepts connections"
  conns="$(compose exec -T postgres psql -U "${PG_USER}" -d "${PG_DB}" -tAc \
           'SELECT count(*) FROM pg_stat_activity' 2>/dev/null | tr -d '[:space:]')"
  [ -n "${conns}" ] && ok "postgres connections in use: ${conns}/100"
else
  down "postgres is not accepting connections"
fi
if compose exec -T redis redis-cli ping 2>/dev/null | grep -q PONG; then
  ok "redis responds to PING"
else
  down "redis did not respond to PING"
fi

# --- 6. disk ---------------------------------------------------------------
echo "[6/7] Disk"
for path in / /var/lib/docker "${BACKUP_DIR}"; do
  [ -d "${path}" ] || continue
  used="$(df -P "${path}" 2>/dev/null | awk 'NR==2 {gsub("%","",$5); print $5}')"
  [ -z "${used}" ] && continue
  if   [ "${used}" -ge 95 ];                     then down    "${path} is ${used}% full"
  elif [ "${used}" -ge "${DISK_WARN_PERCENT}" ]; then degrade "${path} is ${used}% full"
  else ok "${path} ${used}% used"
  fi
done

# --- 7. backup freshness ---------------------------------------------------
echo "[7/7] Backups"
if [ -d "${BACKUP_DIR}/daily" ]; then
  recent="$(find "${BACKUP_DIR}/daily" -maxdepth 1 -type f -name '*.dump*' ! -name '*.sha256' \
            -newermt "-${BACKUP_MAX_AGE_HOURS} hours" 2>/dev/null | wc -l | tr -d ' ')"
  if [ "${recent}" -gt 0 ]; then
    ok "${recent} database backup(s) newer than ${BACKUP_MAX_AGE_HOURS}h"
  else
    degrade "no database backup in the last ${BACKUP_MAX_AGE_HOURS}h — the backup timer may have stopped (RISK-04)"
  fi
else
  degrade "${BACKUP_DIR}/daily does not exist — backups are not configured (RISK-04)"
fi

echo
if [ "${FAILURES}" -gt 0 ]; then
  red "DOWN: ${FAILURES} failure(s), ${DEGRADED} degradation(s). See OPERATIONS_RUNBOOK.md."
  exit 2
fi
if [ "${DEGRADED}" -gt 0 ]; then
  amber "DEGRADED: ${DEGRADED} issue(s). Not customer-visible yet — fix before it becomes so."
  exit 1
fi
green "HEALTHY."
exit 0
