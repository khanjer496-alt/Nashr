# DEPLOYMENT.md — Nashr (نشر)

Production deployment of Nashr, a MENA social media management SaaS derived from
[Postiz](https://github.com/gitroomhq/postiz-app) v1.47.0 (AGPL-3.0). Target
market UAE; first launch is a closed beta of 5–10 businesses.

Read alongside:
[`SECURITY_CHECKLIST.md`](SECURITY_CHECKLIST.md) ·
[`BACKUP_AND_RECOVERY.md`](BACKUP_AND_RECOVERY.md) ·
[`OPERATIONS_RUNBOOK.md`](OPERATIONS_RUNBOOK.md) ·
[`AUDIT_REPORT.md`](AUDIT_REPORT.md) · [`RISK_REGISTER.md`](RISK_REGISTER.md)

Throughout, `nashr.example` is a placeholder. Every real hostname comes from
`NASHR_DOMAIN` in your env file.

---

## 1. What actually runs

The production stack is **eight containers**, not one:

| Service | Image | Why it exists |
|---|---|---|
| `caddy` | `caddy:2.10-alpine` | TLS termination, automatic certificates |
| `app` | **built by us** from `Dockerfile.prod` | frontend + backend + orchestrator + internal nginx, under pm2 |
| `postgres` | `postgres:17.7-alpine` | application database |
| `redis` | `redis:7.4.7-alpine` | cache and queue |
| `temporal` | `temporalio/auto-setup:1.28.1` | durable scheduling and publishing workflows |
| `temporal-postgres` | `postgres:16.11-alpine` | Temporal's own persistence — **a second database** |
| `temporal-elasticsearch` | `elasticsearch:7.17.27` | Temporal advanced visibility |
| `temporal-ui` | `temporalio/ui:2.34.0` | operator UI, `--profile admin`, loopback only |

Inside the `app` container, pm2 supervises four processes: `nginx` (:5000),
`backend` (:3000), `frontend` (:4200), `orchestrator` (:3002). This mirrors
upstream Postiz's own topology deliberately — it keeps upstream's `start:prod:*`
scripts working, so monthly merges stay cheap (RISK-D2).

Every image is pinned **by digest**, not by tag alone. A `docker compose pull`
can never silently change what runs.

### Why Caddy and not nginx + certbot

The edge proxy is Caddy. nginx would work, but:

- ACME issuance **and renewal** are built into Caddy. The classic failure mode
  of an nginx deployment is a certbot renewal hook that quietly stops working
  and produces a 03:00 outage 60 days later. There is no cron job to lose here.
- HTTP→HTTPS redirect, OCSP stapling and modern TLS defaults are on with no
  configuration, so there is no hand-maintained cipher list to rot.
- The whole edge is `ops/caddy/Caddyfile`, about 40 readable lines.

The nginx **inside** the app container stays: it is upstream's routing layer
(`/api` → backend, `/uploads` → disk, `/` → frontend) and replacing it would
create merge conflicts for no benefit. `ops/docker/nginx.prod.conf` is a
hardened copy of `var/docker/nginx.conf` that runs unprivileged.

---

## 2. Host sizing — the honest numbers

This stack runs **two PostgreSQL instances, Redis, Temporal and
Elasticsearch**. It is heavy for 5–10 customers (RISK-D5). Sizing it optimistically
produces an OOM-killed Postgres at the worst possible moment, so here are the
real figures.

Memory limits set in `docker-compose.prod.yaml`:

| Service | Limit | Reservation |
|---|---:|---:|
| app | 2560 MB | 1024 MB |
| postgres | 1024 MB | 512 MB |
| temporal-elasticsearch | 1280 MB | 640 MB |
| temporal | 768 MB | 256 MB |
| temporal-postgres | 512 MB | 192 MB |
| redis | 256 MB | 64 MB |
| caddy | 256 MB | 64 MB |
| **Total (limits)** | **≈ 6.6 GB** | ≈ 2.8 GB |

Add ~1 GB for the OS, the Docker daemon and page cache.

**Building the image needs ~5 GB on its own.** `nest build` OOMs at Node's
default heap, so `Dockerfile.prod` and `.github/workflows/build.yml` both set
`NODE_OPTIONS=--max-old-space-size=5120`. That 5 GB is *in addition to* runtime
memory if you build on the same host while the stack is up.

| Scenario | RAM | vCPU | Disk |
|---|---|---|---|
| **Absolute minimum to run production** (build elsewhere) | **8 GB** | 4 | 80 GB SSD |
| **Recommended** (build on the host, room to breathe) | **16 GB** | 4–8 | 160 GB NVMe SSD |
| Production **+ co-located staging** | 16 GB minimum, 24 GB comfortable | 8 | 250 GB |
| Staging on its own host | 8 GB | 2–4 | 60 GB |

At 8 GB you must build images in CI or on a separate builder and `docker pull`
them. Building on a running 8 GB host will OOM.

Disk grows from three places: Postgres (small — a few GB for this customer
count), Temporal's Elasticsearch visibility indices (steady growth, prune with
Temporal retention), and uploads if `STORAGE_PROVIDER=local` (video is large —
this is the main reason to move to R2 early).

**Recommendation for the beta:** one 16 GB / 4 vCPU / 160 GB NVMe VPS in a
region close to the UAE (AWS `me-central-1` Dubai, Hetzner/DigitalOcean
Frankfurt, or Oracle Jeddah). Latency to the UAE matters more than raw price for
perceived responsiveness. Keep staging on a separate 8 GB box — the isolation is
worth more than the saving.

**Dropping Elasticsearch** saves ~1.3 GB. Temporal 1.28 supports custom search
attributes on PostgreSQL visibility, and the app registers its own
(`organizationId`, `postId`) via `TemporalRegisterMissingSearchAttributesModule`.
This is a real option but it is **not validated here** — test it in staging
before doing it in production.

---

## 3. Prerequisites

**On the host**

- Linux with systemd (Ubuntu 24.04 LTS or Debian 12 assumed below)
- Docker Engine 24+ and the Compose v2 plugin
- `openssl`, `curl`, `git`
- Optional but recommended: `awscli` (off-host backup upload), `logrotate`
- Ports 80 and 443 open inbound; outbound HTTPS open (ACME + social APIs)
- **Full-disk encryption on the data volume.** The database holds every
  customer's social OAuth access and refresh tokens, and column-level
  encryption is unverified (RISK-05).

**Off the host**

- A domain with an A/AAAA record for `NASHR_DOMAIN` pointing at the host,
  resolving *before* you start the stack (Caddy needs it for ACME)
- A container registry you can push to (GHCR, ECR, …)
- Developer applications for each social platform you intend to enable (§7)
- An SMTP account or a Resend API key
- A Cloudflare R2 bucket for backups, and a second one for media if you use
  `STORAGE_PROVIDER=cloudflare`

**Repository note.** `.gitmodules` declares a submodule at
`libraries/plugins/src/list/public-api`. Clone with `--recurse-submodules` or
the image build will fail on a missing path.

---

## 4. First deploy, step by step

### 4.1 Get the code onto the host

```bash
sudo mkdir -p /opt/nashr /var/backups/nashr /var/log/nashr /etc/nashr
sudo chmod 700 /var/backups/nashr /etc/nashr
sudo git clone --recurse-submodules <your-nashr-repo> /opt/nashr
cd /opt/nashr
```

The systemd units in `ops/systemd/` assume `/opt/nashr`. Edit them if you use a
different path.

### 4.2 Create the environment file

```bash
cp .env.example .env.prod
chmod 600 .env.prod
```

Generate the secrets — **never reuse a value between production and staging**:

```bash
./ops/scripts/rotate-secrets.sh generate
```

That prints fresh candidates for `JWT_SECRET`, `POSTGRES_PASSWORD`,
`REDIS_PASSWORD` and `TEMPORAL_POSTGRES_PASSWORD` without touching any file.
Paste them into `.env.prod`.

Generating `JWT_SECRET` by hand:

```bash
openssl rand -base64 48
```

Fill in at minimum: `NASHR_DOMAIN`, `ACME_EMAIL`, `NASHR_IMAGE`,
`NASHR_IMAGE_TAG`, the four secrets, `STORAGE_PROVIDER`, the email settings, and
`NEXT_PUBLIC_SOURCE_URL` (§9 — this is a licence obligation, not a nicety).

> `.gitignore` currently contains a bare `.env`, which does **not** match
> `.env.prod`. Add a `.env.*` line before you create any environment file.

### 4.3 Run the pre-deploy guard

```bash
./ops/scripts/preflight.sh .env.prod
```

It blocks the deploy on a placeholder or weak `JWT_SECRET`, on the presence of
`NOT_SECURED`, on `DISABLE_SSRF_PROTECTION=true`, on a `:latest` image tag, on a
world-readable env file, on non-URL-safe database passwords, and on a missing
migration history. Do not deploy until it exits 0.

### 4.4 Build and push the image

Build on a machine with **at least 8 GB RAM free** (the build needs ~5 GB of
Node heap):

```bash
export TAG=1.0.0

docker build -f Dockerfile.prod \
  --build-arg NASHR_VERSION="$TAG" \
  --build-arg STORAGE_PROVIDER=local \
  --build-arg NEXT_PUBLIC_BACKEND_URL="https://app.nashr.example/api" \
  --build-arg NEXT_PUBLIC_APP_URL="https://app.nashr.example" \
  --build-arg NEXT_PUBLIC_SOURCE_URL="https://github.com/your-org/nashr" \
  --build-arg NEXT_PUBLIC_BRAND_LEGAL_NAME="Your Company FZ-LLC" \
  --build-arg NEXT_PUBLIC_SUPPORT_EMAIL="support@nashr.example" \
  -t ghcr.io/your-org/nashr-app:"$TAG" .

docker push ghcr.io/your-org/nashr-app:"$TAG"
```

Or let compose build it in place:

```bash
docker compose --env-file .env.prod -f docker-compose.prod.yaml build app
```

**Never tag a production image `latest`.** `preflight.sh` refuses it.

#### Build-time vs runtime configuration

This trips people up, so it is worth stating plainly. Two categories of
variable are frozen when the image is built and **cannot** be changed by
editing `.env.prod` and restarting:

1. **`NEXT_PUBLIC_*`** — Next.js inlines these into the client bundle.
2. **`STORAGE_PROVIDER`** — `apps/frontend/next.config.js` evaluates it inside
   `redirects()`/`rewrites()`, which Next resolves at build time. Switching
   `local` ↔ `cloudflare` therefore requires a **rebuild**, not a restart.

Everything else (database URLs, OAuth secrets, SMTP, Stripe, feature flags) is
read at runtime and a restart is enough.

### 4.5 Bring the stack up

```bash
docker compose --env-file .env.prod -f docker-compose.prod.yaml up -d
```

`--env-file` is not optional: compose's `${...}` interpolation reads it, and the
app container additionally loads the same file wholesale through `env_file:`.

Watch the first boot — it takes 2–3 minutes, mostly Temporal and Elasticsearch:

```bash
docker compose --env-file .env.prod -f docker-compose.prod.yaml logs -f app
```

You are looking for, in order:

```
[nashr-entrypoint] configuration guard passed (env=production, checked 9 required vars)
[nashr-entrypoint] wrote /app/.env (0600) from the container environment; values not logged
[nashr-entrypoint] applying migrations: prisma migrate deploy
[nashr-entrypoint] migrations applied
Backend started successfully on port 3000
```

### 4.6 Database migrations

Migrations run automatically from the container entrypoint
(`ops/docker/entrypoint.sh`) using:

```bash
prisma migrate deploy \
  --schema libraries/nestjs-libraries/src/database/prisma/schema.prisma
```

against `libraries/nestjs-libraries/src/database/prisma/migrations/`. The
history starts from a baseline of the pristine upstream v1.47.0 schema, followed
by the Nashr migrations:

```bash
ls -1 libraries/nestjs-libraries/src/database/prisma/migrations/
# 20260808000000_baseline_postiz_v1_47_0     <- pristine upstream schema
# 20260808000100_nashr_mena_foundation       <- Nashr additions
# 20260808000200_nashr_client_scope_and_publish_controls
# migration_lock.toml
```

New migrations are added by the application phases; this list grows. What
matters operationally is that a history exists and that deploys apply it with
`migrate deploy` — `preflight.sh` counts the directories rather than expecting a
fixed set.

**`prisma db push --accept-data-loss` must never touch production.** It is the
root `pnpm run prisma-db-push` script and it silently drops columns and data
(RISK-01). The entrypoint calls `migrate deploy` and refuses to start at all if
the migrations directory is missing.

To run migrations as a separate step instead — useful in a blue/green or
zero-downtime pipeline — set `RUN_MIGRATIONS=false` and run:

```bash
docker compose --env-file .env.prod -f docker-compose.prod.yaml \
  run --rm --entrypoint /app/node_modules/.bin/prisma app \
  migrate deploy --schema libraries/nestjs-libraries/src/database/prisma/schema.prisma
```

If `migrate deploy` reports drift, **stop**. Do not "fix" it with `db push`.
See `OPERATIONS_RUNBOOK.md` → "Migration drift".

### 4.7 Verify

```bash
./ops/scripts/healthcheck.sh
```

Expect `HEALTHY.` — except the backup warning, which stays until §5 is done.

Then by hand:

```bash
curl -sSI https://app.nashr.example/ | head -1        # 200 or 307
curl -sS  https://app.nashr.example/api/ ; echo       # "App is running!"
```

Create the first account in the browser. The **first user to register becomes
the super-admin**, so do this immediately, before the DNS record is public
knowledge. Then confirm `DISABLE_REGISTRATION="true"` is set and restart the app
so nobody else can self-register.

### 4.8 Turn on backups, health checks and log rotation

```bash
sudo cp ops/systemd/nashr-*.service ops/systemd/nashr-*.timer /etc/systemd/system/
sudo cp ops/logrotate/nashr /etc/logrotate.d/nashr
sudo systemctl daemon-reload
sudo systemctl enable --now nashr-backup.timer nashr-healthcheck.timer
systemctl list-timers 'nashr-*'
```

Put the backup upload credentials in a root-owned file that the app container
never sees:

```bash
sudo tee /etc/nashr/backup.env >/dev/null <<'EOT'
BACKUP_R2_ACCESS_KEY_ID=...
BACKUP_R2_SECRET_ACCESS_KEY=...
EOT
sudo chmod 600 /etc/nashr/backup.env
```

Then prove it works, immediately — not next month:

```bash
sudo systemctl start nashr-backup.service
sudo ./ops/scripts/restore-drill.sh
```

Details in `BACKUP_AND_RECOVERY.md`.

---

## 5. TLS and domain

DNS must resolve **before** the stack starts; Caddy requests a certificate on
first boot and Let's Encrypt allows only 5 failures per hour per hostname.

```
A     app.nashr.example       ->  <host IPv4>
AAAA  app.nashr.example       ->  <host IPv6>      (if you have one)
```

Caddy handles issuance, renewal (at 30 days remaining), HTTP→HTTPS redirect and
HSTS. Nothing to schedule.

To rehearse without burning the rate limit, uncomment `acme_ca` in
`ops/caddy/Caddyfile` to point at Let's Encrypt staging, bring the stack up,
confirm the flow, then comment it out and remove the staging certificate:

```bash
docker compose --env-file .env.prod -f docker-compose.prod.yaml \
  exec caddy rm -rf /data/caddy/certificates
docker compose --env-file .env.prod -f docker-compose.prod.yaml restart caddy
```

If your host sits behind Cloudflare, set the record to **DNS-only (grey cloud)**
until the certificate is issued — Cloudflare proxying breaks HTTP-01 validation.

Certificate expiry is checked every 15 minutes by
`ops/scripts/healthcheck.sh`; it warns below 14 days remaining, which can only
happen if renewal is already failing.

---

## 6. Staging vs production

| | Production | Staging |
|---|---|---|
| Compose file | `docker-compose.prod.yaml` | `docker-compose.staging.yaml` |
| Project name | `nashr-prod` | `nashr-staging` |
| Env file | `.env.prod` | `.env.staging` |
| Volumes | `nashr-prod-*` | `nashr-staging-*` |
| Networks | `nashr-prod-*` | `nashr-staging-*` |
| Access | public | HTTP basic auth + `X-Robots-Tag: noindex` |
| Registration | env-controlled | forced `DISABLE_REGISTRATION=true` |

Isolation is **structural, not conventional**. Staging cannot write to
production data even if someone pastes the production `DATABASE_URL` into
`.env.staging`: the staging compose file sets `DATABASE_URL` and `REDIS_URL` in
its `environment:` block, which takes precedence over `env_file:`, and pins them
to the staging containers on an `internal: true` network with no route out.

```bash
cp .env.example .env.staging && chmod 600 .env.staging
# different JWT_SECRET, different passwords — preflight blocks reuse
docker run --rm caddy:2.10-alpine caddy hash-password --plaintext 'a-password'
./ops/scripts/preflight.sh .env.staging staging
docker compose --env-file .env.staging -f docker-compose.staging.yaml up -d
```

**Co-locating staging on the production host.** The staging Caddy defaults to
80/443, which collides with production. To share a host:

1. Set `NASHR_STAGING_HTTP_PORT=8080` and `NASHR_STAGING_HTTPS_PORT=8443`.
2. Replace the site address line in `ops/caddy/Caddyfile.staging` with
   `tls internal` — ACME cannot validate on non-standard ports.
3. Accept the browser warning, or distribute Caddy's local CA.

A separate host is better. If you do co-locate, bring staging down when you are
not using it: `docker compose -f docker-compose.staging.yaml stop`.

---

## 7. OAuth application setup

Redirect URI pattern for every platform:

```
https://<NASHR_DOMAIN>/integrations/social/<provider>
```

Add the staging URL as a second redirect URI in the same developer app where the
platform allows it. Leave a credential pair empty and that channel simply does
not appear to customers.

**Snapchat is not supported** by any of the 36 providers (RISK-P1). It has very
high penetration in the UAE and Saudi Arabia. Say so to every beta customer
before they sign up.

### Meta — Facebook Pages and Instagram Business

One Meta app covers both. [developers.facebook.com](https://developers.facebook.com) → Create App → **Business**.

- Products: Facebook Login, Instagram Graph API
- Redirect URIs: `.../integrations/social/facebook`, `.../integrations/social/instagram`
- Permissions: `pages_show_list`, `pages_manage_posts`, `pages_read_engagement`,
  `instagram_basic`, `instagram_content_publish`, `business_management`
- Env: `FACEBOOK_APP_ID`/`FACEBOOK_APP_SECRET`, `INSTAGRAM_APP_ID`/`INSTAGRAM_APP_SECRET`

**App Review is required** before it works for accounts other than your own
developers/testers. Budget 1–3 weeks and start it early — it is usually the
long pole for a launch. Instagram requires a **Business or Creator** account
linked to a Facebook Page; personal accounts cannot be published to.

### Threads

A separate Meta app from Instagram. Products → Threads API. Permissions
`threads_basic`, `threads_content_publish`. Env: `THREADS_APP_ID`,
`THREADS_APP_SECRET`.

### TikTok

[developers.tiktok.com](https://developers.tiktok.com) → Manage apps → Login Kit
+ Content Posting API. Scopes `user.info.basic`, `video.publish`,
`video.upload`. Env: `TIKTOK_CLIENT_ID`, `TIKTOK_CLIENT_SECRET`.

Audit review is required, and until it passes, posts land as **private drafts**
in the target account. Domain verification of `NASHR_DOMAIN` is also required.

### LinkedIn

[linkedin.com/developers](https://www.linkedin.com/developers/) → Create app,
associated with a LinkedIn Company Page you control. Products: *Sign In with
LinkedIn using OpenID Connect* and *Share on LinkedIn*; add *Community
Management API* for company pages. Env: `LINKEDIN_CLIENT_ID`,
`LINKEDIN_CLIENT_SECRET`.

### X (Twitter)

[developer.x.com](https://developer.x.com) → Project + App → OAuth 1.0a with
Read and Write. Env: `X_API_KEY`, `X_API_SECRET`.
**A paid tier is required to post.** The free tier cannot publish. Consider
`STRIP_LINKS_FROM_X_POSTS=true` — X down-ranks posts containing links.

### YouTube

Google Cloud Console → project → enable **YouTube Data API v3** → OAuth client
(Web application). Scopes `youtube.upload`, `youtube.readonly`. Env:
`YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET`.
The consent screen needs Google verification for these sensitive scopes;
unverified apps are capped at 100 users and show a warning screen.

### Google Business Profile

High value for UAE restaurants, salons and clinics. Same Google Cloud project;
enable the Business Profile APIs and **request quota access** — it is not
granted by default and can take weeks. Env: `GOOGLE_GMB_CLIENT_ID`,
`GOOGLE_GMB_CLIENT_SECRET`.

### Others

Pinterest, Telegram, Discord, Slack, Reddit, Mastodon and the rest follow the
same shape; the variable names are listed and grouped in `.env.example` §9.

### Recommended launch order

1. Instagram + Facebook (start Meta App Review on day one)
2. TikTok (start audit review on day one)
3. LinkedIn (fast approval)
4. Google Business Profile (quota request is slow)
5. X and YouTube (paid tier / verification)

---

## 8. Upgrading

Nashr releases only.

```bash
cd /opt/nashr
git fetch origin && git checkout <new-release-tag>

# 1. Prove it in staging first
export TAG=1.1.0
docker build -f Dockerfile.prod --build-arg NASHR_VERSION=$TAG -t ghcr.io/your-org/nashr-app:$TAG .
docker push ghcr.io/your-org/nashr-app:$TAG
sed -i "s/^NASHR_IMAGE_TAG=.*/NASHR_IMAGE_TAG=\"$TAG\"/" .env.staging
./ops/scripts/preflight.sh .env.staging staging
docker compose --env-file .env.staging -f docker-compose.staging.yaml up -d
# ... exercise it: log in, schedule a post, publish a post ...

# 2. Back up production BEFORE touching it
./ops/scripts/backup-postgres.sh

# 3. Promote the exact same tag
sed -i "s/^NASHR_IMAGE_TAG=.*/NASHR_IMAGE_TAG=\"$TAG\"/" .env.prod
./ops/scripts/preflight.sh .env.prod
docker compose --env-file .env.prod -f docker-compose.prod.yaml up -d app

# 4. Verify
./ops/scripts/healthcheck.sh
```

Expect ~60–90 seconds of downtime on the app container while the new one
becomes healthy. For a 5–10 customer beta that is acceptable; announce it.

**Rollback.** Set `NASHR_IMAGE_TAG` back and `up -d app` again. This is only
safe when the release contained no migrations, because `migrate deploy` rolls
forward and never backward. If it did contain migrations, roll back by
restoring the pre-upgrade backup (`BACKUP_AND_RECOVERY.md`). Check before you
upgrade:

```bash
ls libraries/nestjs-libraries/src/database/prisma/migrations/
```

---

## 9. AGPL-3.0 and pulling upstream Postiz updates

### The source-offer obligation

Postiz is AGPL-3.0. Section 13 requires that **every user interacting with the
software over a network** is offered the Corresponding Source, including your
modifications. Running Nashr as a SaaS triggers this the moment the first
customer logs in (RISK-L1).

Nashr already has the mechanism: `NEXT_PUBLIC_SOURCE_URL` in
`libraries/nashr-brand/src/brand.config.ts`. **Set it to a public mirror of
your source.** If it is empty it falls back to the upstream Postiz repository,
which is *not* the corresponding source for your build — the obligation is then
unmet. Because it is a `NEXT_PUBLIC_*` variable it must be passed as a
**build arg**; setting it only at runtime leaves the client bundle pointing at
upstream.

`docker-compose.prod.yaml` makes this a hard requirement: the build fails if
`NEXT_PUBLIC_SOURCE_URL` is unset.

Do not modify `LICENSE`, `SECURITY.md`, `CODE_OF_CONDUCT.md`, `CONTRIBUTING.md`,
`ICLA.md` or `CCLA.md`.

### Pulling upstream

Monthly, on a dedicated branch:

```bash
git remote add upstream https://github.com/gitroomhq/postiz-app.git   # once
git fetch upstream --tags
git checkout -b sync/upstream-v1.48.0
git merge v1.48.0
```

Expect conflicts in the files listed in `FORK_CUSTOMIZATIONS.md`. Guidance that
keeps merges cheap:

- Never rename the `@gitroom/*` package scope.
- Prefer adding files over editing upstream ones.
- Keep brand values in `libraries/nashr-brand`, not scattered inline.
- Hide unwanted upstream features behind flags; do not delete them (RISK-03).

None of the Phase 6 files conflict with upstream: `docker-compose.prod.yaml`,
`docker-compose.staging.yaml`, `Dockerfile.prod` and `ops/**` are all new
paths. `.env.example` is the one shared file, and it will conflict when upstream
edits it — resolve by keeping the Nashr structure and folding in genuinely new
upstream variables.

After merging: rebuild, deploy to staging, run the full checklist, then promote.

### A note on `Dockerfile`

There is deliberately no plain `Dockerfile` at the repo root. Upstream tooling
(`railway.toml`, `Jenkins/`, `docker-build.sh`) and a bare `docker build .` would
pick it up ambiguously. The production image is always built with an explicit
`-f Dockerfile.prod`.

---

## 10. Quick reference

```bash
# deploy
./ops/scripts/preflight.sh .env.prod
docker compose --env-file .env.prod -f docker-compose.prod.yaml up -d

# status
docker compose --env-file .env.prod -f docker-compose.prod.yaml ps
./ops/scripts/healthcheck.sh

# logs
docker compose --env-file .env.prod -f docker-compose.prod.yaml logs -f app
docker compose --env-file .env.prod -f docker-compose.prod.yaml exec app pm2 logs

# operator tooling (Temporal UI on 127.0.0.1:8080)
docker compose --env-file .env.prod -f docker-compose.prod.yaml --profile admin up -d
ssh -N -L 8080:127.0.0.1:8080 deploy@<host>

# backup / restore
./ops/scripts/backup-postgres.sh
./ops/scripts/restore-drill.sh
./ops/scripts/restore-postgres.sh <dump> docker-compose.staging.yaml .env.staging

# stop (data survives; volumes are named and are not removed)
docker compose --env-file .env.prod -f docker-compose.prod.yaml down
```

`docker compose down -v` **deletes every volume**, including the database. There
is no confirmation prompt. Do not type it on the production host.
