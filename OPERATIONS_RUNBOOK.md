# OPERATIONS_RUNBOOK.md — Nashr (نشر)

Day-2 operations. Written to be usable at 03:00 by someone who did not build
the system.

All commands assume `cd /opt/nashr`. Production commands are shown with
`--env-file .env.prod -f docker-compose.prod.yaml`; substitute the staging pair
for staging.

Set this alias first — it removes most of the typing and most of the mistakes:

```bash
alias dcp='docker compose --env-file /opt/nashr/.env.prod -f /opt/nashr/docker-compose.prod.yaml'
```

---

## 1. Sixty-second triage

```bash
./ops/scripts/healthcheck.sh          # exit 0 healthy · 1 degraded · 2 down
dcp ps
dcp logs --tail=100 app
```

`healthcheck.sh` checks, in the order a customer would notice: containers →
public HTTPS and certificate → API → Temporal → Postgres and Redis → disk →
backup freshness.

| Symptom | Most likely cause | Section |
|---|---|---|
| Site unreachable | Caddy down, DNS, cert failure | §2 |
| Site loads, API 502 | backend crashed or crash-looping | §3 |
| Login works, nothing publishes | Temporal or orchestrator | §4 |
| One customer's channel fails | expired OAuth token | §5 |
| Everything slow | Postgres, disk, or memory pressure | §6 |
| Deploy failed | migration drift or bad image | §7 |

---

## 2. The site is unreachable

```bash
dcp ps caddy
dcp logs --tail=100 caddy
curl -sSI https://app.nashr.example/ | head -1
```

**Caddy is not running** → `dcp up -d caddy`. If it exits immediately, the
Caddyfile is malformed:

```bash
dcp exec caddy caddy validate --config /etc/caddy/Caddyfile
```

**Certificate failure.** Look for `obtain certificate` errors in the Caddy log.
Causes, in order of frequency:

1. DNS does not resolve to this host — `dig +short app.nashr.example`
2. Port 80 blocked inbound (HTTP-01 needs it) — `ss -tlnp | grep :80`
3. Let's Encrypt rate limit (5 failures/hour/host). Wait, then retry against
   the staging CA first (`acme_ca` in `ops/caddy/Caddyfile`).
4. Cloudflare proxying (orange cloud) intercepting validation — set the record
   to DNS-only until issuance succeeds.

**Caddy is up but returns 502** → the app container is unhealthy; go to §3.

---

## 3. API errors / the app container

```bash
dcp ps app
dcp exec app pm2 list
dcp exec app pm2 logs --lines 100
```

`pm2 list` shows four processes: `nginx`, `backend`, `frontend`,
`orchestrator`. A high `restarts` count is the signal.

**One process crash-looping**

```bash
dcp exec app pm2 logs backend --lines 200
dcp exec app pm2 restart backend
```

**The container will not start at all.** Read the entrypoint output — it fails
fast and says exactly why:

```bash
dcp logs app | head -40
```

| Message | Fix |
|---|---|
| `required environment variable(s) unset or empty: …` | Add them to `.env.prod`, `dcp up -d app` |
| `JWT_SECRET is only N characters` | `openssl rand -base64 48` |
| `JWT_SECRET contains the placeholder fragment …` | Generate a real one. **RISK-S1** |
| `NOT_SECURED is set (value irrelevant)` | Delete the line entirely — `false` is truthy |
| `DISABLE_SSRF_PROTECTION=true in production` | Delete the line |
| `no migrations directory next to …` | Wrong image, or a broken build |

**Out of memory.** `dcp exec app pm2 list` shows a process restarting near its
`max_memory_restart` ceiling, or `dmesg -T | grep -i oom` shows kills.
Short term: raise the app's memory limit in `docker-compose.prod.yaml` and
`dcp up -d app`. Longer term: §9.

---

## 4. Nothing is publishing

This is the failure customers notice fastest and complain about hardest.
Publishing runs through Temporal, so triage from the outside in.

```bash
# 1. Is the orchestrator connected to Temporal?
dcp exec app curl -fsS http://127.0.0.1:3002/health/status
# {"status":"ok"} = connected · {"status":"error"} = not

# 2. Is Temporal itself healthy?
dcp exec temporal tctl --address 127.0.0.1:7233 cluster health

# 3. Is anything actually running?
dcp exec temporal tctl --address 127.0.0.1:7233 workflow list
```

If Temporal is unhealthy, check its dependencies in this order — it will not
start without both:

```bash
dcp ps temporal-postgres temporal-elasticsearch
dcp logs --tail=50 temporal-elasticsearch
```

Elasticsearch is the usual culprit: it refuses writes when disk crosses its
flood-stage watermark (512 MB free in the production config). Free disk, then:

```bash
dcp exec temporal-elasticsearch curl -fsS \
  'http://127.0.0.1:9200/_cluster/health?pretty'
```

### Reading a failed workflow

Bring up the Temporal UI (loopback only) and tunnel to it:

```bash
dcp --profile admin up -d temporal-ui
ssh -N -L 8080:127.0.0.1:8080 deploy@<host>
# then open http://127.0.0.1:8080
```

Filter by `WorkflowType="post"` and status `Failed`. Open the failing execution
and read the **Event History** bottom-up. The two events that matter:

- `ActivityTaskFailed` → the failure text is the platform's own API error. This
  is nearly always the real cause.
- `WorkflowExecutionFailed` → retries were exhausted.

From the CLI:

```bash
dcp exec temporal tctl --address 127.0.0.1:7233 \
  workflow list --query 'ExecutionStatus="Failed"'

dcp exec temporal tctl --address 127.0.0.1:7233 \
  workflow show --workflow_id <id>

# Everything for one customer — the app indexes by organizationId
dcp exec temporal tctl --address 127.0.0.1:7233 \
  workflow list --query 'organizationId="<org-uuid>"'
```

Common activity failures and what they actually mean:

| Error text | Meaning | Action |
|---|---|---|
| `401` / `invalid_token` / `OAuthException` | token expired or revoked | §5 |
| `rate limit` / `429` | platform throttling | Temporal retries with backoff; leave it |
| `media upload failed` | file too large or wrong format | Check the platform's limits |
| `(#200) permission` (Meta) | missing scope or the Page was disconnected | Customer reconnects |
| `spam` / `duplicate` | platform rejected the content | Customer edits and reschedules |
| `ECONNREFUSED` to a private IP | SSRF guard doing its job | Correct — do **not** disable it |

### Retrying a failed post

**Preferred — from the product.** Open the post in the calendar and use retry /
reschedule. This keeps the application's own state consistent, which manual
Temporal surgery does not.

**If the workflow is stuck rather than failed:**

```bash
# Resume a workflow blocked on a transient error
dcp exec temporal tctl --address 127.0.0.1:7233 \
  workflow reset --workflow_id <id> --reset_type LastContinuedAsNew

# Abandon one that will never succeed (content rejected, account deleted)
dcp exec temporal tctl --address 127.0.0.1:7233 \
  workflow terminate --workflow_id <id> --reason "manual: platform rejected content"
```

Terminating does not update the post's state in the application database. Fix
the post in the UI afterwards, or the customer sees it stuck in `QUEUE`.

**Bulk failure after an outage.** If many posts failed for the same reason,
resolve the cause first, then reschedule from the UI. Do not reset workflows in
bulk from the CLI — you will double-post.

---

## 5. One customer's channel stopped working

Almost always an expired or revoked OAuth token.

```bash
dcp exec postgres psql -U nashr -d nashr -c \
  "SELECT id, \"providerIdentifier\", name, disabled, \"refreshNeeded\"
     FROM \"Integration\"
    WHERE \"organizationId\" = '<org-uuid>';"
```

`refreshNeeded = true` or `disabled = true` → the customer must reconnect that
channel in Settings → Channels. There is no server-side fix; the platform has
invalidated the grant.

Causes worth knowing: the customer changed their platform password; Meta's
60-day long-lived token expired without a refresh; the user revoked app access;
the platform rotated its API (**RISK-P6**); the Page or Business account was
transferred.

Check the `Errors` table for the customer-visible history:

```bash
dcp exec postgres psql -U nashr -d nashr -c \
  "SELECT \"createdAt\", platform, message FROM \"Errors\"
    WHERE \"organizationId\" = '<org-uuid>'
    ORDER BY \"createdAt\" DESC LIMIT 20;"
```

---

## 6. Everything is slow

```bash
docker stats --no-stream
df -h /
dcp exec postgres psql -U nashr -d nashr -c \
  "SELECT count(*), state FROM pg_stat_activity GROUP BY state;"
```

**Disk full** is the most common cause and it degrades everything at once.

```bash
docker system df
docker image prune -a --filter "until=168h"    # keep the last week of images
du -sh /var/lib/docker/volumes/* | sort -h | tail -10
du -sh /var/backups/nashr/*
```

Never delete `nashr-prod-postgres-data` or `nashr-prod-uploads`.

**Postgres connection exhaustion** (`max_connections=100`, app pool 15):

```bash
dcp exec postgres psql -U nashr -d nashr -c \
  "SELECT pid, state, now()-query_start AS age, left(query,80)
     FROM pg_stat_activity
    WHERE state <> 'idle' ORDER BY age DESC LIMIT 10;"

# Terminate one runaway query (know what it is before you do this)
dcp exec postgres psql -U nashr -d nashr -c "SELECT pg_terminate_backend(<pid>);"
```

**Slow queries** are logged above 2 s (`log_min_duration_statement=2000`):

```bash
dcp logs postgres | grep "duration:" | tail -20
```

**Memory pressure.** `docker stats` showing a container pegged at its limit
means the limit is wrong or the workload has outgrown the host. §9.

---

## 7. Deploy and migration problems

### Migration drift

`migrate deploy` reports that the database schema does not match the migration
history.

**Do not run `prisma db push --accept-data-loss` to "fix" it.** That is the root
`pnpm run prisma-db-push` script; it silently drops columns and data
(**RISK-01**). It is the single most destructive command available here.

```bash
# 1. Back up first, always
./ops/scripts/backup-postgres.sh

# 2. See what Prisma thinks is applied
dcp exec postgres psql -U nashr -d nashr -c \
  "SELECT migration_name, finished_at, rolled_back_at
     FROM _prisma_migrations ORDER BY started_at;"

# 3. A migration that failed part-way, which you have manually completed:
dcp run --rm --entrypoint /app/node_modules/.bin/prisma app \
  migrate resolve --applied <migration_name> \
  --schema libraries/nestjs-libraries/src/database/prisma/schema.prisma

# 3b. A migration that failed and left nothing behind:
dcp run --rm --entrypoint /app/node_modules/.bin/prisma app \
  migrate resolve --rolled-back <migration_name> \
  --schema libraries/nestjs-libraries/src/database/prisma/schema.prisma
```

If you cannot reconcile it, restore the pre-deploy backup and investigate on
staging with a copy of production data. Never experiment on production.

### A bad deploy

```bash
# Roll back to the previous tag
sed -i 's/^NASHR_IMAGE_TAG=.*/NASHR_IMAGE_TAG="1.0.0"/' .env.prod
./ops/scripts/preflight.sh .env.prod
dcp up -d app
```

Safe **only if the release contained no migrations** — `migrate deploy` rolls
forward, never backward. If it did, roll back by restoring the pre-upgrade
backup (`BACKUP_AND_RECOVERY.md` §7.1).

### The build fails

- **Out of memory / `nest build` killed** — the build needs ~5 GB of Node heap.
  `Dockerfile.prod` sets `NODE_OPTIONS=--max-old-space-size=5120`; the *host*
  still needs the RAM to back it. Build on a 16 GB machine or in CI.
- **`ERR_PNPM_OUTDATED_LOCKFILE`** — `package.json` and `pnpm-lock.yaml`
  disagree. Run `pnpm install` locally and commit the lockfile. Do not remove
  `--frozen-lockfile`; it is what stops dependencies drifting silently.
- **Missing `libraries/plugins/src/list/public-api`** — the git submodule was
  not checked out. `git submodule update --init --recursive`.

---

## 8. Temporal data loss

If `nashr-prod-temporal-postgres-data` is lost, workflow execution history goes
with it. Customer data in the application database is unaffected.

1. Bring the Temporal stack up empty — `auto-setup` re-creates the schema.
2. Restart the app so the orchestrator re-registers workflows and search
   attributes.
3. **Posts scheduled but not yet published may never fire.** Query them and
   reschedule from the UI:

```bash
dcp exec postgres psql -U nashr -d nashr -c \
  "SELECT id, \"publishDate\", state, \"organizationId\" FROM \"Post\"
    WHERE state = 'QUEUE' AND \"publishDate\" > now()
    ORDER BY \"publishDate\";"
```

Tell affected customers. Silently missing a scheduled post is worse than
telling them it will be late.

---

## 9. Scaling

For 5–10 customers a single host is right. Reach for these in order:

**1. Give the app container more room.** Raise its `deploy.resources.limits` in
`docker-compose.prod.yaml`, then `dcp up -d app`. Cheapest and usually enough.

**2. Tune Temporal worker concurrency.** `WORKER_CONCURRENCY_DIVIDER` (default
1) divides worker concurrency. Raise it to 2 or 4 if the app container is
CPU-starved by publishing bursts.

**3. Move media to R2.** Set `STORAGE_PROVIDER=cloudflare` — this removes the
uploads volume from the host's disk and IO path entirely. **Requires an image
rebuild**, because `next.config.js` evaluates it at build time.

**4. Split the orchestrator onto its own host.** Run a second app container with
`EXCLUDE_QUEUE` set so it polls only the publishing queues, and set
`EXCLUDE_QUEUE` on the first so it polls the rest. Both point at the same
Postgres, Redis and Temporal.

**5. Separate the database.** Move to managed Postgres (which also gives you
PITR, improving the RPO in `BACKUP_AND_RECOVERY.md` §3).

**Do not** run two app containers behind a load balancer without first setting
`RUN_CRON` on exactly one of them — it is truthiness-tested, so `RUN_CRON=false`
still enables it, and two instances registering the recurring workflows will
duplicate scheduled work.

---

## 10. Rotating secrets

```bash
./ops/scripts/rotate-secrets.sh generate          # print candidates, change nothing
./ops/scripts/rotate-secrets.sh jwt .env.prod     # rotate JWT_SECRET
./ops/scripts/rotate-secrets.sh redis .env.prod   # rotate REDIS_PASSWORD
./ops/scripts/rotate-secrets.sh postgres          # prints the manual procedure
```

The script writes a timestamped `0600` backup of the env file and never prints
an existing secret.

**`JWT_SECRET` — signs every user out.** Announce it first if it is during
working hours. Rotate on suspected compromise, on staff departure, or annually.

**`REDIS_PASSWORD` — a brief cache blip, no data loss.** Redis is a cache and a
transient queue; Temporal owns durable scheduling state.
`dcp up -d redis app` — both together, because the app's `REDIS_URL` is built
from that value.

**`POSTGRES_PASSWORD` — manual on purpose.** The value lives in two places that
must change together and the wrong order locks the app out of its own database.
`rotate-secrets.sh postgres` prints the exact sequence.

**OAuth client secrets** — rotate in the platform's developer console, update
`.env.prod`, `dcp up -d app`. Existing customer tokens keep working; only new
authorisations use the new secret.

---

## 11. Incident response

**Severity**

| Sev | Definition | Response |
|---|---|---|
| **1** | Product down, or customer data exposed | Immediate. Wake someone. |
| **2** | Publishing broken for all customers | Within 1 hour |
| **3** | One customer or one channel affected | Same business day |
| **4** | Degraded but working (slow, cert warning) | Next business day |

**First 15 minutes**

1. `./ops/scripts/healthcheck.sh` — capture the output before changing anything.
2. Note the start time and what changed recently (`dcp images` shows the running
   tag; check the deploy log).
3. **Tell customers early.** In a beta of 5–10 businesses, a message before they
   notice costs you nothing and buys enormous goodwill.
4. Stabilise before diagnosing. Rolling back to a known-good image tag is
   almost always faster than debugging forward.
5. Do not restore a backup as a first move — it discards data. §2–§7 first.

**Suspected data breach**

1. Do **not** wipe anything. Logs and container state are evidence.
2. `docker compose stop app` — halts processing, preserves state.
3. Snapshot the host or its disks.
4. Rotate `JWT_SECRET` (invalidates all sessions), then database and Redis
   passwords, then every OAuth client secret.
5. Notify affected customers and follow the UAE data-protection obligations
   identified in `SECURITY_CHECKLIST.md` §10.
6. Preserve `docker compose logs` for every service before restarting.

**After every Sev 1 or 2**, write down: timeline, root cause, what made it
worse, what made it better, and the one change that would have prevented it.
Add it below.

---

## 12. Routine maintenance

| Cadence | Task |
|---|---|
| Daily (automated) | Backup at 22:00 UTC; health check every 15 min |
| Weekly | Read the health check log; check disk headroom; skim `Errors` |
| **Monthly** | **`restore-drill.sh`** and log the result; host security updates; pull upstream Postiz on a `sync/` branch; refresh and re-verify image digests |
| Quarterly | Full restore into staging (§6.2 of the backup doc); review resource limits; review the risk register |
| Annually | Rotate `JWT_SECRET` and database passwords; review OAuth app registrations and scopes |

---

## 13. Incident log

| Date | Sev | Summary | Root cause | Prevention |
|---|---|---|---|---|
| _(first entry goes here)_ | | | | |
