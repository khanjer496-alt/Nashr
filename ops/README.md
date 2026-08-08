# ops/ — Nashr operational tooling

Everything here supports `docker-compose.prod.yaml` and
`docker-compose.staging.yaml`. Nothing here is imported by application code, so
none of it conflicts when merging upstream Postiz.

```
ops/
├── caddy/
│   ├── Caddyfile              edge config: TLS, ACME, security headers
│   └── Caddyfile.staging      same + basic auth + noindex
├── docker/
│   ├── entrypoint.sh          config guard -> .env -> migrate deploy -> pm2
│   ├── healthcheck.sh         in-container HEALTHCHECK (all 4 processes)
│   ├── nginx.prod.conf        in-container nginx, unprivileged
│   └── pm2.production.json    supervises nginx + backend + orchestrator + frontend
├── logrotate/
│   └── nashr                  host log rotation (containers are capped in compose)
├── scripts/
│   ├── preflight.sh           PRE-DEPLOY GUARD — run before every deploy
│   ├── backup-postgres.sh     nightly dump, verify, encrypt, retain, upload
│   ├── backup-uploads.sh      uploads volume archive (STORAGE_PROVIDER=local)
│   ├── restore-postgres.sh    guarded restore with a safety dump
│   ├── restore-drill.sh       monthly proof that backups actually restore
│   ├── rotate-secrets.sh      JWT / Redis / Postgres rotation
│   ├── healthcheck.sh         host-side health check (cron/systemd)
│   └── nashr-backup.cron      cron alternative to the systemd timers
├── systemd/
│   ├── nashr-backup.{service,timer}
│   └── nashr-healthcheck.{service,timer}
└── temporal/dynamicconfig/
    ├── production-sql.yaml    prod tuning, without the dev-only cache refresh
    └── staging-sql.yaml       smaller limits
```

## The two commands that matter

```bash
./ops/scripts/preflight.sh .env.prod    # before every deploy — refuses unsafe config
./ops/scripts/healthcheck.sh            # after every deploy, and every 15 min
```

## Conventions every script here follows

- `set -euo pipefail` (except `healthcheck.sh`, which reports on failures rather
  than dying at the first one).
- **No secret is ever printed.** Only variable names and verdicts.
- Env files are **parsed, never sourced** — sourcing a deploy artefact executes
  whatever is in it.
- Destructive operations require an explicit flag *and* typed confirmation.
- Backups are verified before they are trusted and before anything is deleted.

## Where things are documented

| Question | Document |
|---|---|
| How do I deploy this? | [`DEPLOYMENT.md`](../DEPLOYMENT.md) |
| How big a host do I need? | [`DEPLOYMENT.md`](../DEPLOYMENT.md) §2 |
| It broke, what now? | [`OPERATIONS_RUNBOOK.md`](../OPERATIONS_RUNBOOK.md) |
| How do I restore? | [`BACKUP_AND_RECOVERY.md`](../BACKUP_AND_RECOVERY.md) |
| Is it safe to launch? | [`SECURITY_CHECKLIST.md`](../SECURITY_CHECKLIST.md) |
