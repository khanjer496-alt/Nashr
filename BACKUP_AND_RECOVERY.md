# BACKUP_AND_RECOVERY.md — Nashr (نشر)

Closes **RISK-04** (no backups configured) and supports **RISK-05** (OAuth
tokens at rest).

The governing principle of this document: **a backup that has never been
restored is not a backup.** The restore drill in §6 is not optional, and it is
the only part of this document that proves the rest of it works.

---

## 1. What is at stake

Losing the production Postgres volume loses:

- every customer's scheduled and published posts, drafts, and media metadata
- every connected social account's **OAuth access and refresh tokens** — the
  customer must reconnect all channels by hand, on every platform
- organizations, users, team memberships, client/brand records
- approval history and audit trail
- billing state and subscription mappings

For an agency-facing product, the OAuth tokens hurt most: reconnecting a dozen
channels across five clients is hours of work per customer and looks like an
outage to them for days.

---

## 2. What is backed up

| Asset | Mechanism | Frequency | Retention | Off-host |
|---|---|---|---|---|
| **Application Postgres** | `pg_dump --format=custom` via `ops/scripts/backup-postgres.sh` | nightly 22:00 UTC (02:00 Asia/Dubai) | 14 daily · 8 weekly · 12 monthly | R2, if `BACKUP_R2_BUCKET` is set |
| **Uploads volume** (`STORAGE_PROVIDER=local`) | `tar.gz` of `nashr-prod-uploads` via `ops/scripts/backup-uploads.sh` | nightly | 14 days | R2, same condition |
| **Media in R2** (`STORAGE_PROVIDER=cloudflare`) | R2 bucket versioning | continuous | per bucket lifecycle rule | already off-host |
| **Env file `.env.prod`** | manual, into your password manager | on every change | keep 2 previous | — |
| **Caddy certificates** (`nashr-prod-caddy-data`) | not backed up, on purpose | — | — | — |

### Deliberately *not* backed up

- **Temporal's Postgres and Elasticsearch.** These hold workflow execution
  history, not customer data. Rebuilding them loses in-flight scheduling state,
  which the app re-creates from the application database. Backing them up would
  roughly double backup size and restore time for very little benefit.
  *Consequence, stated plainly:* if the Temporal database is lost, posts already
  scheduled but not yet published may need re-queueing. See
  `OPERATIONS_RUNBOOK.md` → "Temporal data loss".
- **Redis.** Cache and transient queue only. It is `appendonly yes` so a restart
  is not disruptive, but nothing durable lives there.
- **Caddy certificates.** Caddy re-issues them from ACME in seconds. Restoring
  stale certificates causes more problems than it solves.
- **Docker images.** They live in your registry, pinned by tag and digest.

---

## 3. RPO and RTO

**RPO — how much data you can lose.** With nightly backups: **up to 24 hours**.
For a 5–10 customer beta that is a considered trade-off, not an oversight: the
cost of continuous archiving (WAL shipping) is not justified yet.

> Move to PITR before you have paying customers whose day's work matters. The
> upgrade path is `wal_level=replica` plus `archive_command`, or a managed
> Postgres with PITR built in. Then RPO drops to minutes.

**RTO — how long recovery takes.** Measured, not estimated: the drill in §6
prints the real restore time for your data volume. Expected for beta-sized data:

| Scenario | Target RTO |
|---|---|
| Bad migration / bad deploy, database intact | 15 min (roll back the image) |
| Database corruption, host healthy | 45 min |
| Total host loss, rebuild from scratch | 4 hours |
| Total host loss with **no off-host backup** | **unrecoverable** |

That last row is why `BACKUP_R2_BUCKET` matters. `preflight.sh` warns when it is
unset, and `healthcheck.sh` warns when no backup has been taken in 30 hours.

---

## 4. How backups run

### Schedule

`ops/systemd/nashr-backup.timer` fires at **22:00 UTC = 02:00 Asia/Dubai** — after
the evening posting peak, before the morning one. `Persistent=true` means a
backup missed because the host was off runs as soon as it comes back.

```bash
sudo systemctl enable --now nashr-backup.timer
systemctl list-timers nashr-backup.timer
sudo systemctl start nashr-backup.service     # run one now
sudo journalctl -u nashr-backup.service -n 50
```

`ops/scripts/nashr-backup.cron` is a cron equivalent for hosts without systemd.
It has no `Persistent=true` equivalent — a missed window is simply missed.

### What the backup script does

1. Takes an atomic single-instance lock (`mkdir`, not a test-then-create file).
2. `pg_dump --format=custom --compress=9` through `docker compose exec`, over
   the container's **local UNIX socket** — no password ever reaches a command
   line or a log.
3. Rejects a dump under 1 KB (an empty or failed dump).
4. **Verifies the archive** with `pg_restore --list` and discards it if it is
   not readable. A corrupt backup is deleted rather than kept and trusted.
5. Optionally encrypts it (§5).
6. Writes a `.sha256` next to it.
7. Hard-links Sunday's copy into `weekly/` and the 1st of the month into
   `monthly/` — no extra disk until the daily is pruned.
8. Uploads off-host to R2 if configured.
9. Prunes by age: daily 14 days, weekly 56 days, monthly 365 days.

Layout on disk:

```
/var/backups/nashr/
├── daily/    nashr-prod-20260808T220000Z.dump  (+ .sha256)
├── weekly/   hard links to Sunday dailies
├── monthly/  hard links to 1st-of-month dailies
├── uploads/  nashr-prod-uploads-20260808T222000Z.tar.gz
└── pre-restore/  safety dumps taken by restore-postgres.sh
```

All directories are `0700`, all files `0600`.

### Off-host upload

Cloudflare R2 is S3-compatible, so the AWS CLI works with an `--endpoint-url`.

```bash
# in .env.prod
BACKUP_R2_BUCKET="nashr-backups"
BACKUP_R2_ACCOUNT_ID="your-account-id"
BACKUP_R2_PREFIX="postgres/prod"
```

Put the **credentials** in `/etc/nashr/backup.env` (root-owned, `0600`), loaded
by the systemd unit — deliberately *not* in `.env.prod`:

```bash
BACKUP_R2_ACCESS_KEY_ID=...
BACKUP_R2_SECRET_ACCESS_KEY=...
```

The app container never receives these, so an application compromise cannot
reach or delete the backups. Use a **separate bucket and a separate scoped
token** from the media bucket, and consider an R2 lifecycle rule as a second,
independent retention control.

---

## 5. Encryption at rest

Database dumps contain live OAuth access and refresh tokens for every connected
account (RISK-05). Anything that leaves the host should be encrypted.

```bash
openssl rand -base64 48 | sudo tee /etc/nashr/backup.passphrase >/dev/null
sudo chmod 600 /etc/nashr/backup.passphrase
```

Uncomment `BACKUP_PASSPHRASE_FILE` in `ops/systemd/nashr-backup.service`.
Backups are then written as `.dump.enc` (AES-256-CBC, PBKDF2, 600 000
iterations) and the plaintext is shredded.

**Store the passphrase somewhere other than this host.** A passphrase that only
exists on the machine you are recovering *from* protects the backup from
attackers and from you equally well. Password manager, sealed envelope, second
admin — any of those, but off the host.

Also enable **full-disk encryption on the data volume**. The dump is one copy of
those tokens; `/var/lib/docker/volumes` is another.

---

## 6. The restore drill — run this monthly

This is the part that turns files on a disk into a backup.

### 6.1 Automated drill (safe, non-destructive)

Restores the most recent production dump into a throwaway Postgres container
with no volume and no network. It cannot touch production or staging.

```bash
sudo ./ops/scripts/restore-drill.sh
```

It verifies the checksum, decrypts if needed, restores, times the restore, and
sanity-checks the contents:

```
[drill] checksum ok
[drill] restore succeeded in 47s (this is your measured RTO for the database step)
[drill] tables restored: 52
[drill]   User: 14 row(s)
[drill]   Organization: 9 row(s)
[drill]   Integration: 31 row(s)
[drill]   Post: 1284 row(s)
[drill] applied migrations recorded in the dump: 2
[drill] DRILL PASSED.
```

Failure modes it catches, all of which have been seen in real deployments:
a dump that never actually ran; a truncated upload; a wrong or lost encryption
passphrase; a dump taken before the migration baseline; a dump of the wrong
(empty) database.

### 6.2 Full drill into staging (quarterly)

The automated drill proves the *data* is good. This proves the *product* comes
back.

```bash
LATEST=$(ls -1t /var/backups/nashr/daily/nashr-prod-*.dump | head -1)
./ops/scripts/restore-postgres.sh "$LATEST" docker-compose.staging.yaml .env.staging
```

Then verify by hand — this is the checklist the script prints:

1. Log in as a known user.
2. Open the calendar; scheduled posts are present with correct times.
3. At least one social integration still shows as connected.
4. Media thumbnails render (if `STORAGE_PROVIDER=local`, restore uploads too).
5. Publish one test post to a throwaway channel and watch it complete.

Afterwards, reset staging so nobody mistakes production data for test data:

```bash
docker compose --env-file .env.staging -f docker-compose.staging.yaml down
docker volume rm nashr-staging-postgres-data
docker compose --env-file .env.staging -f docker-compose.staging.yaml up -d
```

### 6.3 Drill log

Record every drill. An empty table below means the backups are unproven.

| Date | Dump used | Restore time | Tables | Result | Notes |
|---|---|---|---|---|---|
| _(fill in at first deploy)_ | | | | | |

---

## 7. Restoring for real

### 7.1 Production database restore

**Destructive. Read all of this before typing anything.**

```bash
cd /opt/nashr
LATEST=$(ls -1t /var/backups/nashr/daily/nashr-prod-*.dump | head -1)

./ops/scripts/restore-postgres.sh "$LATEST" \
    docker-compose.prod.yaml .env.prod \
    --i-know-this-destroys-data
```

The script requires the `--i-know-this-destroys-data` flag **and** that you type
the database name at the prompt. Then it:

1. verifies the `.sha256`,
2. decrypts if needed,
3. verifies the archive with `pg_restore --list` **before** changing anything,
4. stops the app so nothing writes during the restore,
5. **takes a safety dump of the current database** into
   `/var/backups/nashr/pre-restore/` — a bad restore is itself recoverable,
6. restores with `--single-transaction --exit-on-error`, so a failure halfway
   rolls back and leaves the old data intact,
7. restarts the app, whose entrypoint runs `prisma migrate deploy` to bring an
   older dump up to the current schema,
8. waits for the health check to pass.

Everything written since the dump is gone. Tell customers what window was lost.

### 7.2 Uploads restore (`STORAGE_PROVIDER=local`)

```bash
cd /opt/nashr
docker compose --env-file .env.prod -f docker-compose.prod.yaml stop app

ARCHIVE=/var/backups/nashr/uploads/nashr-prod-uploads-20260808T222000Z.tar.gz
sha256sum --check "${ARCHIVE}.sha256"

docker run --rm -i \
  -v nashr-prod-uploads:/data \
  alpine:3.21 sh -c 'rm -rf /data/* && tar -xzf - -C /data' < "$ARCHIVE"

docker compose --env-file .env.prod -f docker-compose.prod.yaml start app
```

If media is missing but database rows exist, posts render with broken images.
The rows are not wrong — the files are gone. Either restore the archive or
re-upload the media.

### 7.3 Media recovery with `STORAGE_PROVIDER=cloudflare`

Nothing to restore: R2 is already off-host. Two things to have in place first.

- **Enable bucket versioning** on the media bucket. Without it, a deletion is
  permanent.
- The app's R2 token must be **scoped to the media bucket only**, with Object
  Read & Write. A token that can also reach the backup bucket turns one
  compromise into total loss.

Recovering an accidentally deleted object:

```bash
aws s3api list-object-versions --bucket nashr-media --prefix "<key>" \
  --endpoint-url https://<account-id>.r2.cloudflarestorage.com

aws s3api copy-object --bucket nashr-media \
  --copy-source "nashr-media/<key>?versionId=<version>" --key "<key>" \
  --endpoint-url https://<account-id>.r2.cloudflarestorage.com
```

### 7.4 Full host loss — rebuild from nothing

Target 4 hours. Practise it once before you have customers; the first time is
always slower than the plan.

```bash
# 1. New host: Docker, git, openssl, awscli. Full-disk encryption on the data volume.

# 2. Code
sudo git clone --recurse-submodules <your-nashr-repo> /opt/nashr && cd /opt/nashr

# 3. Env file, from your password manager (this is why §2 lists it as an asset)
cp .env.example .env.prod && chmod 600 .env.prod   # then fill it in
./ops/scripts/preflight.sh .env.prod

# 4. Pull the latest backup down from R2
sudo mkdir -p /var/backups/nashr/daily && sudo chmod 700 /var/backups/nashr/daily
aws s3 cp s3://nashr-backups/postgres/prod/ /var/backups/nashr/daily/ \
    --recursive --endpoint-url https://<account-id>.r2.cloudflarestorage.com

# 5. Point DNS at the new host and wait for it to resolve (Caddy needs this)

# 6. Start the stack; migrations run from the entrypoint
docker compose --env-file .env.prod -f docker-compose.prod.yaml up -d

# 7. Restore
LATEST=$(ls -1t /var/backups/nashr/daily/nashr-prod-*.dump | head -1)
./ops/scripts/restore-postgres.sh "$LATEST" docker-compose.prod.yaml .env.prod \
    --i-know-this-destroys-data

# 8. Uploads, if STORAGE_PROVIDER=local (see 7.2)

# 9. Verify
./ops/scripts/healthcheck.sh
```

**Keep `JWT_SECRET` identical to the lost host's.** Changing it during a
recovery signs every user out on top of the outage they are already experiencing.
This is precisely why the env file is a backed-up asset.

---

## 8. Monitoring the backups

`ops/scripts/healthcheck.sh` runs every 15 minutes and reports **degraded** when
no database backup is newer than 30 hours. That is the signal that the timer has
stopped — the most common silent backup failure there is.

```bash
systemctl list-timers nashr-backup.timer          # is it scheduled?
sudo journalctl -u nashr-backup.service -n 50     # did the last run succeed?
ls -lh /var/backups/nashr/daily/ | tail -5        # do the files exist and grow?
df -h /var/backups                                # is there room for tonight's?
```

Add an off-host alert as soon as you have customers — a health check that only
reports to the host it is checking is not a monitoring system.

### Monthly review

- [ ] `restore-drill.sh` ran and passed; row in §6.3 filled in
- [ ] Off-host copies exist in R2 for every night of the last 14
- [ ] Backup size is growing plausibly (a sudden drop means a partial dump)
- [ ] Disk headroom for another 30 days of retention
- [ ] The encryption passphrase is still recoverable from off-host storage
- [ ] `.env.prod` in the password manager still matches the deployed file
