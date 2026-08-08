#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Nashr — pre-deploy guard.
#
# Refuses to let a deploy proceed when the environment file is unsafe. Run it
# before every `docker compose up`, and wire it into CI/CD ahead of the deploy
# step. It is deliberately noisy about WHAT is wrong and silent about VALUES:
# no secret is ever printed, only variable names and verdicts.
#
#   ./ops/scripts/preflight.sh .env.prod             # production (default)
#   ./ops/scripts/preflight.sh .env.staging staging  # staging
#
# Exit codes:  0 = safe to deploy   1 = blocked   2 = usage error
#
# Closes: RISK-S1 (placeholder JWT_SECRET), RISK-S2 (dangerous opt-out flags),
#         part of RISK-01 (refuses to deploy without a migration history) and
#         RISK-D3 (refuses an unpinned `:latest` image tag).
# ---------------------------------------------------------------------------
set -euo pipefail

ENV_FILE="${1:-.env.prod}"
TARGET_ENV="${2:-production}"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
MIGRATIONS_DIR="${REPO_ROOT}/libraries/nestjs-libraries/src/database/prisma/migrations"

ERRORS=0
WARNINGS=0

red()   { printf '\033[31m%s\033[0m\n' "$*"; }
amber() { printf '\033[33m%s\033[0m\n' "$*"; }
green() { printf '\033[32m%s\033[0m\n' "$*"; }

blocker() { red   "  BLOCK  $*"; ERRORS=$((ERRORS + 1)); }
warn()    { amber "  WARN   $*"; WARNINGS=$((WARNINGS + 1)); }
pass()    { green "  ok     $*"; }

if [ ! -f "${ENV_FILE}" ]; then
  red "FATAL: env file '${ENV_FILE}' not found."
  echo "Copy .env.example to ${ENV_FILE} and fill it in. See DEPLOYMENT.md."
  exit 2
fi

case "${TARGET_ENV}" in
  production|staging) ;;
  *) red "FATAL: second argument must be 'production' or 'staging', got '${TARGET_ENV}'"; exit 2 ;;
esac

# --- env file readers -------------------------------------------------------
# The file is PARSED, never sourced. Sourcing an env file executes whatever is
# in it, which is exactly the trust we should not extend to a deploy artefact.

# envget_from FILE KEY -> value with surrounding quotes stripped, empty if absent.
envget_from() {
  local file="$1" key="$2" line
  line="$(grep -E "^[[:space:]]*${key}[[:space:]]*=" "${file}" 2>/dev/null | grep -v '^[[:space:]]*#' | tail -n 1 || true)"
  [ -z "${line}" ] && return 0
  line="${line#*=}"
  line="$(printf '%s' "${line}" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')"
  line="${line%\"}"; line="${line#\"}"
  line="${line%\'}"; line="${line#\'}"
  printf '%s' "${line}"
}

# envget KEY -> same, against the env file under test.
envget() { envget_from "${ENV_FILE}" "$1"; }

# envhas KEY -> 0 when the key is present and uncommented, whatever its value.
envhas() {
  grep -qE "^[[:space:]]*$1[[:space:]]*=" "${ENV_FILE}" 2>/dev/null
}

echo
echo "Nashr pre-deploy guard"
echo "  env file : ${ENV_FILE}"
echo "  target   : ${TARGET_ENV}"
echo

# ---------------------------------------------------------------------------
echo "[1/8] File handling"
# ---------------------------------------------------------------------------
# NB: `???` would be a glob inside `case`, so use a word sentinel instead.
perms="$(stat -c '%a' "${ENV_FILE}" 2>/dev/null || stat -f '%Lp' "${ENV_FILE}" 2>/dev/null || echo 'unknown')"
case "${perms}" in
  600|400)  pass "permissions ${perms}" ;;
  unknown)  warn "could not read permissions of ${ENV_FILE}" ;;
  *)        blocker "${ENV_FILE} is mode ${perms}; it holds every secret in the stack. Run: chmod 600 ${ENV_FILE}" ;;
esac

# A bare `.env` line in .gitignore does NOT cover `.env.prod` / `.env.staging`.
ENV_BASENAME="$(basename "${ENV_FILE}")"
if [ -f "${REPO_ROOT}/.gitignore" ]; then
  if grep -qxE "[[:space:]]*(${ENV_BASENAME}|\.env\.\*|\.env\*|\*\.env|\.env\.local)[[:space:]]*" "${REPO_ROOT}/.gitignore"; then
    pass "${ENV_BASENAME} is covered by .gitignore"
  else
    warn "${ENV_BASENAME} is NOT covered by .gitignore (a bare '.env' entry does not match '.env.prod'). Add a '.env.*' line before this file can ever be committed by accident."
  fi
fi

# ---------------------------------------------------------------------------
echo "[2/8] JWT_SECRET  (RISK-S1)"
# ---------------------------------------------------------------------------
JWT="$(envget JWT_SECRET)"
if [ -z "${JWT}" ]; then
  blocker "JWT_SECRET is unset or empty. Generate one:  openssl rand -base64 48"
else
  if [ "${#JWT}" -lt 32 ]; then
    blocker "JWT_SECRET is ${#JWT} characters. Use at least 32.  openssl rand -base64 48"
  else
    pass "JWT_SECRET length ${#JWT}"
  fi

  jwt_lower="$(printf '%s' "${JWT}" | tr '[:upper:]' '[:lower:]')"
  placeholder_hit=""
  for frag in \
    'random string that is unique to every install' \
    'random string for your jwt secret' \
    'change_me' 'changeme' 'your-jwt-secret' 'your_jwt_secret' \
    'replace-me' 'replaceme' 'placeholder' 'example' 'secret123' \
    'insecure' 'nashr-dev' 'test' 'xxxx'
  do
    case "${jwt_lower}" in *"${frag}"*) placeholder_hit="${frag}"; break ;; esac
  done
  if [ -n "${placeholder_hit}" ]; then
    blocker "JWT_SECRET contains the placeholder fragment '${placeholder_hit}'. This is the exact upstream RISK-S1 failure. Generate a real one:  openssl rand -base64 48"
  else
    pass "JWT_SECRET is not a known placeholder"
  fi

  # Rough entropy floor: a long string of one repeated character passes a length
  # check but is not a secret.
  distinct="$(printf '%s' "${JWT}" | fold -w1 | sort -u | wc -l | tr -d ' ')"
  if [ "${distinct}" -lt 12 ]; then
    blocker "JWT_SECRET uses only ${distinct} distinct characters. That is not random.  openssl rand -base64 48"
  else
    pass "JWT_SECRET character diversity ${distinct}"
  fi
fi

# ---------------------------------------------------------------------------
echo "[3/8] Dangerous opt-out flags  (RISK-S2)"
# ---------------------------------------------------------------------------
# apps/backend/src/main.ts tests `!process.env.NOT_SECURED`. In JavaScript the
# STRING "false" is truthy, so NOT_SECURED=false TURNS THE INSECURE PATH ON.
# The only correct production state is: the variable is absent.
if envhas NOT_SECURED; then
  blocker "NOT_SECURED is present in ${ENV_FILE}. Value is irrelevant: the backend treats ANY non-empty value, including the literal string 'false', as ON. Delete the line entirely."
else
  pass "NOT_SECURED absent"
fi

SSRF="$(envget DISABLE_SSRF_PROTECTION)"
if [ "${SSRF}" = "true" ]; then
  blocker "DISABLE_SSRF_PROTECTION=true. A customer-supplied webhook or self-hosted-provider URL could then reach internal services (Postgres, Redis, Temporal, cloud metadata). Delete the line."
elif envhas DISABLE_SSRF_PROTECTION; then
  warn "DISABLE_SSRF_PROTECTION is present but not 'true'. Protection stays on; prefer deleting the line."
else
  pass "DISABLE_SSRF_PROTECTION absent"
fi

for truthy_flag in DISALLOW_PLUS DISABLE_IMAGE_COMPRESSION; do
  if [ "$(envget "${truthy_flag}")" = "false" ]; then
    warn "${truthy_flag}=false is truthy in JavaScript and therefore ENABLES the flag. Delete the line if you meant to turn it off."
  fi
done

if [ "${TARGET_ENV}" = "production" ] && [ "$(envget DISABLE_REGISTRATION)" != "true" ]; then
  warn "DISABLE_REGISTRATION is not 'true'. Public signup is open. A 5-10 customer closed beta should set DISABLE_REGISTRATION=true and invite users."
fi

# ---------------------------------------------------------------------------
echo "[4/8] Required configuration"
# ---------------------------------------------------------------------------
required=(POSTGRES_PASSWORD REDIS_PASSWORD TEMPORAL_POSTGRES_PASSWORD ACME_EMAIL NASHR_IMAGE_TAG STORAGE_PROVIDER)
if [ "${TARGET_ENV}" = "production" ]; then
  required+=(NASHR_DOMAIN)
else
  required+=(NASHR_STAGING_DOMAIN STAGING_BASIC_AUTH_USER STAGING_BASIC_AUTH_HASH)
fi
for key in "${required[@]}"; do
  if [ -z "$(envget "${key}")" ]; then
    blocker "${key} is unset or empty"
  else
    pass "${key} set"
  fi
done

for pw in POSTGRES_PASSWORD REDIS_PASSWORD TEMPORAL_POSTGRES_PASSWORD; do
  v="$(envget "${pw}")"
  if [ -n "${v}" ] && [ "${#v}" -lt 20 ]; then
    blocker "${pw} is ${#v} characters. Use at least 20.  openssl rand -hex 24"
  fi
  # DATABASE_URL is assembled as a URL in the compose files, so a password with
  # reserved characters silently produces a broken connection string.
  if [ -n "${v}" ] && printf '%s' "${v}" | grep -qE '[^A-Za-z0-9_.~-]'; then
    blocker "${pw} contains characters that are not URL-safe. It is interpolated into a postgres:// / redis:// URL. Use only [A-Za-z0-9_.~-]:  openssl rand -hex 24"
  fi
done

# ---------------------------------------------------------------------------
echo "[5/8] Image pinning  (RISK-D3)"
# ---------------------------------------------------------------------------
TAG="$(envget NASHR_IMAGE_TAG)"
case "${TAG}" in
  ""|latest|main|master|dev|edge)
    blocker "NASHR_IMAGE_TAG='${TAG}' is not an immutable version tag. A restart must not be able to change the running code. Use e.g. 1.0.0."
    ;;
  *) pass "NASHR_IMAGE_TAG=${TAG}" ;;
esac
IMG="$(envget NASHR_IMAGE)"
case "${IMG}" in
  *gitroomhq/postiz-app*)
    blocker "NASHR_IMAGE points at the upstream Postiz image. Production must run OUR build (Dockerfile.prod) so it carries Nashr branding and our changes."
    ;;
esac

# ---------------------------------------------------------------------------
echo "[6/8] Database migrations  (RISK-01)"
# ---------------------------------------------------------------------------
if [ ! -d "${MIGRATIONS_DIR}" ]; then
  blocker "no migrations directory at ${MIGRATIONS_DIR}. A production deploy must apply a real migration history with 'prisma migrate deploy', never 'prisma db push --accept-data-loss'."
else
  count="$(find "${MIGRATIONS_DIR}" -mindepth 1 -maxdepth 1 -type d | wc -l | tr -d ' ')"
  if [ "${count}" -eq 0 ]; then
    blocker "${MIGRATIONS_DIR} exists but contains no migrations."
  else
    pass "${count} migration(s) present"
  fi
fi
if [ "$(envget RUN_MIGRATIONS)" = "false" ]; then
  warn "RUN_MIGRATIONS=false — the container will start WITHOUT applying migrations. Only correct if a separate job runs 'prisma migrate deploy' first."
fi

# ---------------------------------------------------------------------------
echo "[7/8] Storage and backups  (RISK-04)"
# ---------------------------------------------------------------------------
STORAGE="$(envget STORAGE_PROVIDER)"
case "${STORAGE}" in
  cloudflare)
    for key in CLOUDFLARE_ACCOUNT_ID CLOUDFLARE_ACCESS_KEY CLOUDFLARE_SECRET_ACCESS_KEY CLOUDFLARE_BUCKETNAME CLOUDFLARE_BUCKET_URL CLOUDFLARE_REGION; do
      [ -z "$(envget "${key}")" ] && blocker "STORAGE_PROVIDER=cloudflare but ${key} is empty"
    done
    pass "STORAGE_PROVIDER=cloudflare"
    ;;
  local)
    pass "STORAGE_PROVIDER=local (uploads live in the nashr-*-uploads volume; make sure ops/scripts/backup-uploads.sh is scheduled)"
    ;;
  "")
    blocker "STORAGE_PROVIDER is unset. Valid values: local | cloudflare"
    ;;
  *)
    blocker "STORAGE_PROVIDER='${STORAGE}' is not recognised. Valid values: local | cloudflare"
    ;;
esac

if [ "${TARGET_ENV}" = "production" ]; then
  if [ -z "$(envget BACKUP_R2_BUCKET)" ]; then
    warn "BACKUP_R2_BUCKET is unset — database backups will stay on this host only. A host loss then loses every customer's content and OAuth tokens (RISK-04). Configure off-host backup upload."
  else
    pass "BACKUP_R2_BUCKET set (off-host backup target)"
  fi
fi

# ---------------------------------------------------------------------------
echo "[8/8] Environment separation"
# ---------------------------------------------------------------------------
OTHER_FILE=""
[ "${TARGET_ENV}" = "production" ] && OTHER_FILE="${REPO_ROOT}/.env.staging"
[ "${TARGET_ENV}" = "staging" ]    && OTHER_FILE="${REPO_ROOT}/.env.prod"

if [ -n "${OTHER_FILE}" ] && [ -f "${OTHER_FILE}" ]; then
  # Compare hashes, never values.
  hash_of() { printf '%s' "$1" | sha256sum | cut -d' ' -f1; }
  other_jwt="$(envget_from "${OTHER_FILE}" JWT_SECRET)"
  if [ -n "${JWT}" ] && [ -n "${other_jwt}" ] && [ "$(hash_of "${JWT}")" = "$(hash_of "${other_jwt}")" ]; then
    blocker "JWT_SECRET is IDENTICAL in ${ENV_FILE} and $(basename "${OTHER_FILE}"). A session token minted in one environment would then be valid in the other. Use a different secret per environment."
  else
    pass "JWT_SECRET differs from $(basename "${OTHER_FILE}")"
  fi
fi

if [ "${TARGET_ENV}" = "staging" ]; then
  prod_domain="$(envget NASHR_DOMAIN)"
  stg_domain="$(envget NASHR_STAGING_DOMAIN)"
  if [ -n "${prod_domain}" ] && [ "${prod_domain}" = "${stg_domain}" ]; then
    blocker "NASHR_DOMAIN and NASHR_STAGING_DOMAIN are the same host."
  fi
fi

# ---------------------------------------------------------------------------
echo
if [ "${ERRORS}" -gt 0 ]; then
  red "BLOCKED: ${ERRORS} blocker(s), ${WARNINGS} warning(s). Deploy refused."
  exit 1
fi
if [ "${WARNINGS}" -gt 0 ]; then
  amber "PASSED WITH ${WARNINGS} WARNING(S). Read them before continuing."
else
  green "PASSED. No blockers, no warnings."
fi
exit 0
