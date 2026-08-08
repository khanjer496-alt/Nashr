# SECURITY_CHECKLIST.md — Nashr (نشر)

Pre-launch checklist. Every item is actionable and verifiable — no item says
"consider" or "review". Work top to bottom; the first section blocks launch.

Cross-references are to [`RISK_REGISTER.md`](RISK_REGISTER.md).
Automated coverage: `./ops/scripts/preflight.sh .env.prod` enforces the items
marked **[auto]** and refuses to deploy if they fail.

---

## 0. Launch gate — nothing goes live until all of these are ticked

- [ ] **[auto]** `JWT_SECRET` is ≥32 chars, from `openssl rand -base64 48`, and
      is not a placeholder — **RISK-S1**
- [ ] **[auto]** `NOT_SECURED` is absent from every env file — **RISK-S2**
- [ ] **[auto]** `DISABLE_SSRF_PROTECTION` is absent (or not `true`) — **RISK-S2**
- [ ] **[auto]** `NASHR_IMAGE_TAG` is a pinned version, never `latest` — **RISK-D3**
- [ ] **[auto]** A Prisma migration history exists and deploys use
      `prisma migrate deploy` — **RISK-01**
- [ ] A backup has been taken **and restored** at least once — **RISK-04**
- [ ] `NEXT_PUBLIC_SOURCE_URL` points at a public mirror of *this* source —
      **RISK-L1** (§8)
- [ ] Tenant-isolation tests pass for every org-scoped endpoint — **RISK-02**
- [ ] Beta customers have been told, in writing, that Snapchat is unsupported
      (**RISK-P1**) and that the Arabic UI is under native review (**RISK-P2**)

---

## 1. Secrets

- [ ] **[auto]** Every secret generated with `openssl rand`, never typed by hand.
      `./ops/scripts/rotate-secrets.sh generate` prints a full set.
- [ ] **[auto]** `.env.prod` and `.env.staging` are mode `600`.
- [ ] `.gitignore` covers `.env.*`. It currently only lists a bare `.env`, which
      does **not** match `.env.prod`. Add the line before creating the file.
- [ ] **[auto]** Production and staging use **different** `JWT_SECRET` values, so
      a staging token can never authenticate against production.
- [ ] **[auto]** Database passwords use only URL-safe characters
      (`[A-Za-z0-9_.~-]`) — they are interpolated into connection URLs.
- [ ] `.env.prod` is stored in a password manager. It is a **recovery asset**:
      without it, a rebuilt host signs every user out (see
      `BACKUP_AND_RECOVERY.md` §7.4).
- [ ] Backup R2 credentials live in root-owned `/etc/nashr/backup.env`, **not**
      in `.env.prod`, so an app compromise cannot delete the backups.
- [ ] No secret is echoed by any ops script. Verify:
      `grep -rn 'echo.*\$JWT_SECRET\|echo.*PASSWORD' ops/` returns nothing.
- [ ] Rotation schedule agreed: `JWT_SECRET` yearly or on suspicion,
      database passwords yearly, OAuth client secrets on staff departure.
      Procedures: `./ops/scripts/rotate-secrets.sh {jwt|redis|postgres}`.
- [ ] No secret has ever been committed. If one was, **rotate it** — removing
      it from history does not un-leak it.

---

## 2. Dangerous configuration flags

Upstream reads some flags for **truthiness** and others with `=== 'true'`. The
difference is not cosmetic: for a truthiness-tested flag, `FLAG=false` **turns
it on**, because the JavaScript string `"false"` is truthy.

| Variable | Test | Safe production state |
|---|---|---|
| `NOT_SECURED` | truthiness (`!process.env.NOT_SECURED`) | **absent** — `false` enables it |
| `DISALLOW_PLUS` | truthiness | absent, or present to enable |
| `DISABLE_IMAGE_COMPRESSION` | truthiness | absent, or present to enable |
| `RUN_CRON` | truthiness | present on exactly one instance |
| `DISABLE_SSRF_PROTECTION` | `=== 'true'` | absent |
| `DISABLE_REGISTRATION` | `=== 'true'` | `"true"` for a closed beta |

- [ ] **[auto]** `NOT_SECURED` absent. It strips cookie `credentials` from CORS
      and exposes the `auth` / `showorg` / `impersonate` headers cross-origin.
- [ ] **[auto]** `DISABLE_SSRF_PROTECTION` absent. With it on, a
      customer-supplied webhook or self-hosted provider URL (WordPress,
      Mastodon, Lemmy, Listmonk, Bluesky PDS) can reach Postgres, Redis,
      Temporal or the cloud metadata endpoint from inside your network.
- [ ] `DISABLE_REGISTRATION="true"` for the closed beta; invite users from the
      admin UI instead.
- [ ] The first account created is yours (it becomes super-admin). Register it
      immediately after the first deploy, before the DNS record is public.
- [ ] `API_LIMIT` set deliberately (default 90/hour). See §6.

---

## 3. Network and host

- [ ] Only 80, 443 and your SSH port are open inbound. Verify: `ss -tlnp`.
- [ ] Postgres, Redis, Temporal and Elasticsearch publish **no** host ports.
      `docker-compose.prod.yaml` places them on `internal: true` networks with
      no route to or from the internet. Verify:
      `docker compose -f docker-compose.prod.yaml ps --format '{{.Name}} {{.Ports}}'`
      shows published ports only for `caddy`, and loopback-only for `temporal`.
- [ ] Temporal UI is **not** published to the internet. It exposes workflow
      inputs, which include post content and integration identifiers. Reach it
      over SSH: `ssh -N -L 8080:127.0.0.1:8080 deploy@<host>`.
- [ ] SSH: key-only, `PasswordAuthentication no`, root login disabled.
- [ ] Unattended security upgrades enabled.
- [ ] **Full-disk encryption on the data volume.** OAuth token encryption at
      rest in the database is unverified (**RISK-05**); disk encryption is the
      compensating control until it is.
- [ ] `docker compose down -v` is understood to destroy every volume with no
      prompt, and nobody has it in shell history on the production host.

---

## 4. TLS and HTTP

- [ ] HTTPS serves a valid certificate; HTTP redirects to it (Caddy default).
- [ ] HSTS present: `curl -sSI https://app.nashr.example/ | grep -i strict-transport`
- [ ] Security headers present — `X-Content-Type-Options`, `X-Frame-Options`,
      `Referrer-Policy`, `Permissions-Policy` (set in `ops/caddy/Caddyfile`,
      and again in `ops/docker/nginx.prod.conf` as defence in depth).
- [ ] Certificate auto-renewal verified — `ops/scripts/healthcheck.sh` alerts
      below 14 days remaining, which can only happen if renewal is failing.
- [ ] Uploaded media is served with the sandboxing CSP
      (`ops/docker/nginx.prod.conf`, `location /uploads/`) so a crafted upload
      cannot execute script in your origin.
- [ ] Staging is behind HTTP basic auth and returns
      `X-Robots-Tag: noindex, nofollow`.

---

## 5. Tenant isolation — RISK-02

The highest-impact risk in the product. Isolation depends on every query
filtering `organizationId`; there is **no row-level security**. In an agency
product where org A competes with org B, one missing `where` clause is
existential.

- [ ] An adversarial integration suite exists covering **every** org-scoped
      endpoint: as org A, attempt to read, update and delete org B's posts,
      integrations, customers, media, analytics, webhooks and approvals.
      Each must return 403/404, never data.
- [ ] The same suite covers the **public API** (`/public/v1`) with org A's API
      key against org B's resource IDs.
- [ ] The approval gate is enforced in the **Temporal publish activity**, not
      only in the UI — that activity is the single chokepoint all creation
      paths traverse (`WEB`, `MCP`, `API`, `AUTOPOST`, `CLI`) (**RISK-P4**).
- [ ] Post-MVP: evaluate Postgres RLS as a database-level backstop.

> Owned by Phase 7 (testing). Phase 6 cannot close this; it is listed here
> because it is a launch gate and must not be forgotten.

---

## 6. Rate limiting and abuse — RISK-S6

- [ ] `API_LIMIT` set explicitly in `.env.prod`.
- [ ] Understood that `API_LIMIT` is a **single global number**, not per-org or
      per-endpoint. One noisy customer can consume the budget.
- [ ] Auth endpoints (`/auth/login`, `/auth/forgot`, `/auth/register`) have a
      stricter limit than the general API. If the application does not provide
      one, add it at the edge in `ops/caddy/Caddyfile`:
      ```
      rate_limit {
          zone auth { key {remote_host}  events 10  window 1m }
      }
      ```
- [ ] Body size capped at 2 GB in both Caddy and the internal nginx.
- [ ] Post-MVP: per-organization limits, tracked against **RISK-S6**.

---

## 7. OAuth tokens and third-party credentials

- [ ] Each social developer app is registered to a **company** account, not a
      personal one, with more than one admin.
- [ ] Redirect URIs are exact and HTTPS-only. No wildcards.
- [ ] The minimum scope set per platform (`DEPLOYMENT.md` §7). Extra scopes
      widen the blast radius of a token leak for zero benefit.
- [ ] Client secrets are in `.env.prod` only, never in the frontend bundle.
      Verify: `grep -rn "CLIENT_SECRET\|APP_SECRET" apps/frontend/src` returns
      nothing.
- [ ] **RISK-05**: confirm whether `Integration.token` / `refreshToken` are
      encrypted at rest. If they are not, either add application-level
      encryption with a key from the environment, or record the risk as accepted
      with full-disk encryption as the compensating control. Do not leave it
      unverified.
- [ ] Token-refresh failures surface to the customer promptly — a silently
      expired token looks like "the product stopped posting" (**RISK-P6**).
- [ ] Cloudflare R2 tokens are **scoped per bucket**: the media token cannot
      reach the backup bucket, and vice versa.
- [ ] Stripe uses live keys **only** in production; `STRIPE_SIGNING_KEY` is set
      so webhook signatures are actually verified.

---

## 8. Licensing — AGPL-3.0 §13 — RISK-L1

Nashr derives from Postiz, which is AGPL-3.0. **Section 13 obliges you to offer
the Corresponding Source, including your modifications, to every user who
interacts with the software over a network.** Offering Nashr as a SaaS triggers
this the moment the first customer logs in. There is no SaaS exemption in the
AGPL; that is the entire point of §13.

- [ ] A public source mirror of **this deployment's** code exists (a public
      GitHub/GitLab repo is the simplest compliant route).
- [ ] `NEXT_PUBLIC_SOURCE_URL` points at it. If it is empty, the app falls back
      to the **upstream Postiz repository**, which is *not* the corresponding
      source for your build — the obligation is then **unmet**.
- [ ] Because it is a `NEXT_PUBLIC_*` variable it is baked in at **build time**.
      Setting it only at runtime leaves the client bundle pointing at upstream.
      `docker-compose.prod.yaml` fails the build if it is unset.
- [ ] The link is reachable from the running product (footer or `/licenses`),
      not merely present in a config file.
- [ ] The mirror is kept in step with what is deployed. Publishing at
      `NASHR_IMAGE_TAG` time keeps them aligned by construction.
- [ ] `LICENSE`, `SECURITY.md`, `CODE_OF_CONDUCT.md`, `CONTRIBUTING.md`,
      `ICLA.md`, `CCLA.md` are unmodified (**RISK-L3**). Verify:
      `wc -l LICENSE` → 661.
- [ ] Upstream attribution is present in the UI (**RISK-L2**) and no Postiz
      trademark is used in customer-facing copy.
- [ ] `pnpm licenses list` reviewed; the Mastra licence is confirmed compatible
      with SaaS resale (**RISK-L5**).

---

## 9. Supply chain

- [ ] **[auto]** The app image is built by us from `Dockerfile.prod`, not pulled
      from `ghcr.io/gitroomhq/postiz-app` (**RISK-D3**).
- [ ] Every base image is pinned **by digest**, not by tag alone (**RISK-D6**).
      Verify all ten resolve:
      ```bash
      grep -rhoE '[a-z0-9./_-]+:[A-Za-z0-9._-]+@sha256:[a-f0-9]{64}' \
        Dockerfile.prod docker-compose.*.yaml ops/ | sort -u | while read -r r; do
          docker buildx imagetools inspect "${r%@*}" | grep -q "${r#*@}" \
            && echo "MATCH $r" || echo "MISMATCH $r"
        done
      ```
- [ ] `pnpm install --frozen-lockfile` in the build — a drifting lockfile fails
      the build rather than silently changing dependencies.
- [ ] The container runs as **non-root** (`USER www`, uid 10001) with
      `no-new-privileges:true` and `/tmp` mounted `noexec,nosuid`.
- [ ] Base images refreshed monthly; digests updated and re-verified.

---

## 10. Data protection and privacy

- [ ] Privacy policy and terms published, naming
      `NEXT_PUBLIC_BRAND_LEGAL_NAME` and `NEXT_PUBLIC_BRAND_JURISDICTION`.
- [ ] UAE data-protection obligations reviewed for the entity type you operate.
- [ ] Customers are told which data leaves the region — in particular that post
      content and brand profiles are sent to OpenAI when AI features are used.
- [ ] **RISK-S4**: a redaction layer strips tokens, emails and phone numbers
      before prompt assembly, and the brand profile passes only explicitly
      declared fields.
- [ ] **RISK-S3**: agent tools are proposal-only for anything destructive, with
      no shell and no arbitrary HTTP; every action recorded in `AgentActionLog`.
- [ ] Account deletion actually deletes, and the retention period is documented.
- [ ] Backups are encrypted before leaving the host (`BACKUP_PASSPHRASE_FILE`)
      and the passphrase is stored **off** the host.

---

## 11. Monitoring and response

- [ ] `nashr-healthcheck.timer` enabled; failures are visible in
      `systemctl --failed`.
- [ ] An **off-host** alert exists. A health check that reports only to the host
      it is checking is not a monitoring system.
- [ ] Sentry (or equivalent) configured; `SENTRY_AUTH_TOKEN` exists on the build
      machine only and never ships to the runtime.
- [ ] Log rotation active — container logs capped by the compose `logging:`
      block, host logs by `ops/logrotate/nashr`. Verify:
      `sudo logrotate --debug /etc/logrotate.d/nashr`
- [ ] `OPERATIONS_RUNBOOK.md` §8 incident response has been read by everyone who
      can touch production, and the on-call contact is written down.

---

## 12. Pre-launch sign-off

| Area | Owner | Date | Evidence |
|---|---|---|---|
| §0 Launch gate | | | `preflight.sh` output |
| §1 Secrets | | | |
| §2 Flags | | | `preflight.sh` output |
| §3 Network / host | | | `ss -tlnp`, `docker compose ps` |
| §4 TLS | | | `curl -I` output |
| §5 Tenant isolation | | | Phase 7 test run |
| §6 Rate limiting | | | |
| §7 OAuth tokens | | | RISK-05 verdict recorded |
| §8 AGPL §13 | | | Live source URL |
| §9 Supply chain | | | Digest verification output |
| §10 Privacy | | | Published policy URL |
| §11 Monitoring | | | Alert test |

Sign-off means the evidence column is filled in, not that the box looks
plausible.
