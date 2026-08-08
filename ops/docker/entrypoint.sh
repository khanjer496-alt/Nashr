#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Nashr production container entrypoint.
#
# Order of operations, and why:
#   1. Fail-closed configuration guard   (RISK-S1, RISK-S2)
#   2. Materialise /app/.env             (upstream start scripts use dotenv-cli)
#   3. prisma migrate deploy             (RISK-01 — never `db push`)
#   4. exec the supervisor (pm2-runtime)
#
# Nothing here echoes a secret value. Only variable NAMES are ever printed.
# ---------------------------------------------------------------------------
set -euo pipefail

log()  { printf '[nashr-entrypoint] %s\n' "$*"; }
fail() { printf '[nashr-entrypoint] FATAL: %s\n' "$*" >&2; exit 1; }

NASHR_ENV="${NASHR_ENV:-production}"
APP_ROOT="${APP_ROOT:-/app}"
PRISMA_SCHEMA="${PRISMA_SCHEMA:-${APP_ROOT}/libraries/nestjs-libraries/src/database/prisma/schema.prisma}"

# ---------------------------------------------------------------------------
# 1. Configuration guard
# ---------------------------------------------------------------------------
REQUIRED_VARS=(
  DATABASE_URL
  REDIS_URL
  JWT_SECRET
  MAIN_URL
  FRONTEND_URL
  NEXT_PUBLIC_BACKEND_URL
  BACKEND_INTERNAL_URL
  STORAGE_PROVIDER
  TEMPORAL_ADDRESS
)

missing=()
for var in "${REQUIRED_VARS[@]}"; do
  if [ -z "${!var:-}" ]; then
    missing+=("${var}")
  fi
done
if [ ${#missing[@]} -gt 0 ]; then
  fail "required environment variable(s) unset or empty: ${missing[*]}"
fi

# --- JWT_SECRET: no default anywhere in this stack, and no known placeholder.
# Upstream docker-compose.yaml ships a literal placeholder string (RISK-S1).
# Deploying that means every session cookie in the product is forgeable.
jwt_len=${#JWT_SECRET}
if [ "${jwt_len}" -lt 32 ]; then
  fail "JWT_SECRET is only ${jwt_len} characters. Use >= 32. Generate one with: openssl rand -base64 48"
fi

jwt_lower=$(printf '%s' "${JWT_SECRET}" | tr '[:upper:]' '[:lower:]')
PLACEHOLDER_FRAGMENTS=(
  'random string that is unique to every install'
  'random string for your jwt secret'
  'change_me'
  'changeme'
  'your-jwt-secret'
  'your_jwt_secret'
  'replace-me'
  'replaceme'
  'placeholder'
  'example'
  'secret123'
  'insecure'
  'nashr-dev'
)
for frag in "${PLACEHOLDER_FRAGMENTS[@]}"; do
  case "${jwt_lower}" in
    *"${frag}"*)
      fail "JWT_SECRET contains the placeholder fragment '${frag}'. Generate a real one: openssl rand -base64 48"
      ;;
  esac
done

# --- Dangerous opt-out flags (RISK-S2).
#
# Read the source before changing this. `NOT_SECURED` is tested for TRUTHINESS
# in apps/backend/src/main.ts, i.e. `!process.env.NOT_SECURED`. In JavaScript the
# STRING "false" is truthy, so setting NOT_SECURED=false actually TURNS THE
# INSECURE PATH ON. The only safe production state is: not present at all.
if [ "${NASHR_ENV}" = "production" ]; then
  if [ -n "${NOT_SECURED+x}" ]; then
    fail "NOT_SECURED is set (value irrelevant). The backend treats any non-empty value, including the string 'false', as ON. Remove the variable entirely from the production env file."
  fi

  # DISABLE_SSRF_PROTECTION is compared with === 'true', so only 'true' is unsafe.
  if [ "${DISABLE_SSRF_PROTECTION:-}" = "true" ]; then
    fail "DISABLE_SSRF_PROTECTION=true in production. This lets a customer-supplied webhook or self-hosted-provider URL reach services on the internal network. Refusing to start."
  fi
  if [ -n "${DISABLE_SSRF_PROTECTION:-}" ]; then
    log "WARNING: DISABLE_SSRF_PROTECTION is set to a non-'true' value. Protection stays ON, but prefer removing the variable."
  fi

  # DISALLOW_PLUS and DISABLE_IMAGE_COMPRESSION are also truthiness-tested.
  for truthy_flag in DISALLOW_PLUS DISABLE_IMAGE_COMPRESSION; do
    if [ "${!truthy_flag:-}" = "false" ]; then
      log "WARNING: ${truthy_flag}=false is truthy in JavaScript and therefore ENABLES the flag. Unset it instead if you meant to disable it."
    fi
  done

  if [ "${DISABLE_REGISTRATION:-}" != "true" ]; then
    log "WARNING: DISABLE_REGISTRATION is not 'true'. Public signup is OPEN. For a closed 5-10 customer beta set DISABLE_REGISTRATION=true and invite users."
  fi
fi

log "configuration guard passed (env=${NASHR_ENV}, checked ${#REQUIRED_VARS[@]} required vars)"

# ---------------------------------------------------------------------------
# 2. Materialise /app/.env
#
# Upstream's per-app start scripts are `dotenv -e ../../.env -- node ...`.
# dotenv-cli hard-errors when that file is absent, so it has to exist. We do
# NOT bake it into the image; it is written at boot from the container's own
# environment, mode 0600, and it contains nothing the process environment did
# not already hold.
# ---------------------------------------------------------------------------
ENV_FILE="${APP_ROOT}/.env"

if [ "${NASHR_WRITE_ENV:-true}" = "true" ]; then
  umask 077
  node -e '
    const fs = require("fs");
    const skip = new Set([
      "PATH","HOME","HOSTNAME","PWD","SHLVL","_","TERM","LANG","LC_ALL",
      "PM2_HOME","NODE_VERSION","YARN_VERSION","OLDPWD","TINI_VERSION"
    ]);
    const lines = Object.keys(process.env)
      .filter((k) => !skip.has(k))
      .filter((k) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(k))
      .sort()
      .map((k) => `${k}=${JSON.stringify(process.env[k] ?? "")}`);
    fs.writeFileSync(process.argv[1], lines.join("\n") + "\n", { mode: 0o600 });
  ' "${ENV_FILE}"
  chmod 600 "${ENV_FILE}"
  log "wrote ${ENV_FILE} (0600) from the container environment; values not logged"
else
  [ -r "${ENV_FILE}" ] || fail "NASHR_WRITE_ENV=false but ${ENV_FILE} is missing or unreadable"
  log "using pre-existing ${ENV_FILE}"
fi

# ---------------------------------------------------------------------------
# 3. Database migrations — `prisma migrate deploy` ONLY (RISK-01)
#
# `prisma db push --accept-data-loss` (upstream's `pnpm run pm2-run`) will
# silently drop columns and data. It must never run against production.
# ---------------------------------------------------------------------------
if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
  PRISMA_BIN="${APP_ROOT}/node_modules/.bin/prisma"
  if [ ! -x "${PRISMA_BIN}" ]; then
    fail "prisma CLI not found at ${PRISMA_BIN}. The image must ship it so migrations never need network access at boot."
  fi
  if [ ! -d "$(dirname "${PRISMA_SCHEMA}")/migrations" ]; then
    fail "no migrations directory next to ${PRISMA_SCHEMA}. Refusing to start: a production deploy must apply a real migration history, never 'db push'."
  fi

  log "applying migrations: prisma migrate deploy"
  "${PRISMA_BIN}" migrate deploy --schema "${PRISMA_SCHEMA}"
  log "migrations applied"
else
  log "RUN_MIGRATIONS=false — skipping prisma migrate deploy (make sure another step applied them)"
fi

# ---------------------------------------------------------------------------
# 4. Hand over to the supervisor
# ---------------------------------------------------------------------------
log "starting: $*"
exec "$@"
