#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Nashr — Phase 7 migration verification (closes the test half of RISK-01).
#
# Proves three things against a REAL PostgreSQL server:
#
#   1. `prisma migrate deploy` applies cleanly to a COMPLETELY EMPTY database.
#      (Upstream had no migration history at all; production deploys must never
#      fall back to `db push --accept-data-loss`.)
#   2. Re-running `migrate deploy` is idempotent — no migration is re-applied.
#   3. There is NO DRIFT between schema.prisma and the migration history:
#      `prisma migrate diff --from-url <migrated db> --to-schema-datamodel`
#      must produce an EMPTY migration.
#
# Usage:
#   tests/scripts/verify-migrations.sh [db-name]
#
# Environment:
#   PGHOST (default /tmp)   PGPORT (default 5433)   PGUSER (default postgres)
#
# The database is created and dropped by this script. It never touches the
# `nashr` development database.
# ---------------------------------------------------------------------------
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${REPO_ROOT}"

DB_NAME="${1:-nashr_migrate_check}"
PGHOST="${PGHOST:-/tmp}"
PGPORT="${PGPORT:-5433}"
PGUSER="${PGUSER:-postgres}"
export PGHOST PGPORT PGUSER

SCHEMA="libraries/nestjs-libraries/src/database/prisma/schema.prisma"
PRISMA="${REPO_ROOT}/node_modules/.bin/prisma"

log()  { printf '\n=== %s\n' "$*"; }
fail() { printf '!!! FAILED: %s\n' "$*" >&2; exit 1; }

[ -x "${PRISMA}" ] || fail "prisma CLI not found at ${PRISMA}"
[ -f "${SCHEMA}" ] || fail "schema not found at ${SCHEMA}"

URL="postgresql://${PGUSER}@localhost:${PGPORT}/${DB_NAME}?host=${PGHOST}"

cleanup() { dropdb --if-exists "${DB_NAME}" >/dev/null 2>&1 || true; }
trap cleanup EXIT

log "1. Creating an EMPTY database: ${DB_NAME}"
dropdb --if-exists "${DB_NAME}"
createdb "${DB_NAME}"

TABLES="$(psql -d "${DB_NAME}" -tAc \
  "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'")"
[ "${TABLES}" = "0" ] || fail "database is not empty (${TABLES} tables)"
echo "    confirmed empty: 0 tables"

log "2. prisma migrate deploy (from empty)"
DATABASE_URL="${URL}" "${PRISMA}" migrate deploy --schema "${SCHEMA}" \
  || fail "migrate deploy failed on an empty database"

APPLIED="$(psql -d "${DB_NAME}" -tAc \
  "SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL")"
TABLES="$(psql -d "${DB_NAME}" -tAc \
  "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'")"
echo "    applied migrations: ${APPLIED}"
echo "    tables now present: ${TABLES}"
[ "${APPLIED}" -ge 3 ]  || fail "expected at least 3 applied migrations, got ${APPLIED}"
[ "${TABLES}"  -ge 50 ] || fail "expected at least 50 tables, got ${TABLES}"

log "3. Nashr tables exist"
for t in NashrPostApproval NashrBrandProfile NashrAgentActionLog; do
  present="$(psql -d "${DB_NAME}" -tAc \
    "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name='${t}'")"
  [ "${present}" = "1" ] || fail "table ${t} missing after migrate deploy"
  echo "    ${t} ok"
done

log "4. migrate deploy is idempotent (second run applies nothing)"
OUT="$(DATABASE_URL="${URL}" "${PRISMA}" migrate deploy --schema "${SCHEMA}" 2>&1)"
echo "${OUT}" | sed 's/^/    /'
echo "${OUT}" | grep -qi "No pending migrations" \
  || fail "second migrate deploy did not report 'No pending migrations'"
APPLIED2="$(psql -d "${DB_NAME}" -tAc \
  "SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL")"
[ "${APPLIED2}" = "${APPLIED}" ] || fail "migration count changed on re-run (${APPLIED} -> ${APPLIED2})"

log "5. NO DRIFT: migrate diff (migrated database -> schema.prisma) must be empty"
DIFF_FILE="$(mktemp -t nashr-drift-XXXXXX.sql)"
DATABASE_URL="${URL}" "${PRISMA}" migrate diff \
  --from-url "${URL}" \
  --to-schema-datamodel "${SCHEMA}" \
  --script > "${DIFF_FILE}" || fail "migrate diff failed"

# An empty diff is the single comment line Prisma emits when there is nothing
# to do. Anything else is real drift.
# `|| true`: grep exits 1 when nothing matches, and an empty diff is exactly
# the case where nothing matches. Under `set -o pipefail` that would abort here.
MEANINGFUL="$( { grep -vE '^[[:space:]]*(--.*)?$' "${DIFF_FILE}" || true; } | wc -l | tr -d ' ')"
echo "    diff script, non-comment lines: ${MEANINGFUL}"
if [ "${MEANINGFUL}" != "0" ]; then
  echo "--- DRIFT DETECTED -------------------------------------------------"
  cat "${DIFF_FILE}"
  echo "--------------------------------------------------------------------"
  rm -f "${DIFF_FILE}"
  fail "schema.prisma has drifted from the migration history"
fi
cat "${DIFF_FILE}" | sed 's/^/    /'
rm -f "${DIFF_FILE}"

log "6. Reverse direction: schema.prisma -> migrated database must also be empty"
DIFF_FILE2="$(mktemp -t nashr-drift2-XXXXXX.sql)"
"${PRISMA}" migrate diff \
  --from-schema-datamodel "${SCHEMA}" \
  --to-url "${URL}" \
  --script > "${DIFF_FILE2}" || fail "reverse migrate diff failed"
MEANINGFUL2="$( { grep -vE '^[[:space:]]*(--.*)?$' "${DIFF_FILE2}" || true; } | wc -l | tr -d ' ')"
echo "    reverse diff, non-comment lines: ${MEANINGFUL2}"
if [ "${MEANINGFUL2}" != "0" ]; then
  echo "--- REVERSE DRIFT --------------------------------------------------"
  cat "${DIFF_FILE2}"
  echo "--------------------------------------------------------------------"
  rm -f "${DIFF_FILE2}"
  fail "the migrated database contains objects schema.prisma does not declare"
fi
rm -f "${DIFF_FILE2}"

log "PASS — migrations apply from empty, are idempotent, and show no drift."
