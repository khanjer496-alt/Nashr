# MENA_CUSTOMIZATIONS.md

Living record of every modification Nashr (نشر) makes to upstream
[Postiz](https://github.com/gitroomhq/postiz-app). Required by the project brief (item 4).

**Upstream base:** `gitroomhq/postiz-app` @ `v1.47.0`
**Upstream licence:** AGPL-3.0 — preserved in full, see [Licence compliance](#licence-compliance)
**Fork:** `khanjer496-alt/Nashr`

Update this file in the same commit as the change it describes. Every entry states
**what** changed, **why**, and — for anything removed or hidden — the **reason**, per
brief item 9.

---

## Repository layout

| Remote | Target | Purpose |
|---|---|---|
| `origin` | `khanjer496-alt/Nashr` | Our fork |
| `upstream` | `gitroomhq/postiz-app` | Read-only, for pulling future updates |

`main` tracks pristine upstream. Nashr changes land on feature branches and merge into
`main` via PR, so `git merge upstream/main` remains viable (brief item 10).

Full upstream history (2 781 commits) is retained deliberately — a shallow clone cannot
merge upstream later.

### Upstream sync procedure
```bash
git fetch upstream
git checkout -b sync/upstream-<version> main
git merge upstream/main
# resolve, run tests, PR into main
```
Target cadence: monthly.

---

## Deliberate non-changes

These look like obvious rebranding targets. They are intentionally left alone. Changing
them would break upstream merges for no customer-visible benefit.

| Left unchanged | Reason |
|---|---|
| `@gitroom/*` internal import scope | Used in ~900 files, never customer-visible. Renaming guarantees a conflict in every future upstream merge. |
| Prisma model and table names | Renaming forces data migrations and conflicts with every upstream schema change. |
| Internal env var names | Shared with upstream Docker images and docs. |
| `LICENSE`, `SECURITY.md`, `CODE_OF_CONDUCT.md`, `CONTRIBUTING.md`, `ICLA.md`, `CCLA.md` | Legal and attribution files. Protected — see below. |

---

## Licence compliance

Postiz is **AGPL-3.0**. Obligations we carry:

1. `LICENSE` (GNU AGPL v3, 661 lines) is preserved verbatim and must never be modified.
2. Copyright notices and attribution are preserved.
3. **AGPL §13:** because Nashr is offered over a network, every remote user must be
   offered the Corresponding Source, including our modifications.
   **Status: not yet satisfied — blocks customer launch.** Tracked as RISK-L1.
4. Nashr's own source is therefore AGPL-3.0.
5. The Postiz **name and logo** are not used in the customer-facing product (trademark is
   separate from the copyright licence). Technical attribution is retained where required.

### Protected files — never modify
```
LICENSE  SECURITY.md  CODE_OF_CONDUCT.md  CONTRIBUTING.md  ICLA.md  CCLA.md
```

---

## Change log

### 2026-08-08 — Phase 1: Audit (no code changes)

**Added**
| File | Purpose |
|---|---|
| `AUDIT_REPORT.md` | Full read-only audit of Postiz v1.47.0 |
| `IMPLEMENTATION_PLAN.md` | Phased plan, Phases 2–8 |
| `RISK_REGISTER.md` | 27 scored risks |
| `MENA_CUSTOMIZATIONS.md` | This file |

**Modified:** none. **Removed:** none.

**Note on origin:** the conversion brief stated the working repository contained Postiz.
It did not — `khanjer496-alt/restoflux` is an unrelated Cloudflare Workers application
(`grep -ri postiz` → 0 matches). The audit was performed against a fresh clone of upstream
instead. See `AUDIT_REPORT.md` §0.

**Brand:** initially drafted as "Manara"; changed to **Nashr / نشر** by the owner before
any code was written. No stale references remain.

### 2026-08-08 — Migration baseline + Nashr schema (RISK-01)

**Added**
| Path | Purpose |
|---|---|
| `.../prisma/migrations/20260808000000_baseline_postiz_v1_47_0/migration.sql` | 1 319-line baseline of pristine upstream schema |
| `.../prisma/migrations/20260808000100_nashr_mena_foundation/migration.sql` | 127-line Nashr additions |

**Reason:** upstream had **no migration history at all**; the only schema mechanism was
`prisma db push --accept-data-loss`, which destroys production data (RISK-01). Both
migrations were generated offline with `prisma migrate diff`. Production deploys must
use `prisma migrate deploy`.

**Modified:** `libraries/nestjs-libraries/src/database/prisma/schema.prisma`

Added namespaced `Nashr*` enums and models — `NashrRole`, `NashrApprovalStage`,
`NashrApprovalDecision`, `NashrAgentStatus`, `NashrMarket`, `NashrBrandProfile`,
`NashrPostApproval`, `NashrAgentActionLog`.

Four upstream models gained back-relation fields (one to three lines each):
`Organization`, `UserOrganization` (+ `nashrRole`), `Customer`, `Post`.

**Why upstream models were touched at all:** Prisma requires both sides of a relation to
be declared. The alternative — storing bare IDs with no foreign keys — would drop
referential integrity on tenant-scoped data, which is unacceptable given cross-tenant
leakage is a critical risk (RISK-02). The edits are deliberately minimal and additive to
keep the merge surface small.

**Why `State` and `Role` were NOT modified:** upstream `State` is consumed by six
versioned Temporal workflows (`post.workflow.v1.0.1`–`v1.0.6`); changing it would break
in-flight workflows and conflict with every future upstream schema change. Approval is
therefore tracked in a separate append-only `NashrPostApproval` table, and `NashrRole`
sits alongside upstream `Role` rather than replacing it.

Verified: `prisma validate` → "The schema is valid 🚀".

### 2026-08-08 — CI: raise Node heap for the backend build

**Modified:** `.github/workflows/build.yml` — added job-level
`NODE_OPTIONS: --max-old-space-size=5120`.

**Reason:** `nest build` for `apps/backend` fails with
`FATAL ERROR: Ineffective mark-compacts near heap limit — JavaScript heap out of memory`
at Node's default ~2 GB cap on GitHub-hosted runners.

**This is an upstream condition, not a Nashr regression.** Verified: build run #1 on
`main` at `7d08f5b6` — pristine upstream Postiz v1.47.0, authored by the Postiz
maintainer — failed identically before any Nashr commit existed.

Private-repo runners have 7 GB RAM and root `build` uses `--workspace-concurrency=1`
(one app at a time), so a 5 GB heap leaves headroom for the OS.

**Checked and deliberately left alone:** `.github/workflows/stale.yml` runs on a
30-minute cron, but is already guarded by
`if: github.repository == 'gitroomhq/postiz-app'`, so its job never executes in this
fork. No change needed — avoiding pointless merge surface.

### 2026-08-08 — Phase 4: RBAC + approval workflow

**Added**
| Path | Purpose |
|---|---|
| `libraries/nashr-permissions/**` | Role matrix, 6 roles x 10 resources x 13 actions, default-deny |
| `libraries/nashr-approval/**` | Approval state machine + service + publish gate |
| `apps/backend/src/api/routes/nashr-approval.controller.ts` | `/nashr/approvals` endpoints |
| `.../migrations/20260808000200_nashr_client_scope_and_publish_controls/` | CLIENT scope link + publishing controls |
| `.../migrations/migration_lock.toml` | Required by `prisma migrate deploy` |

**Modified**
- `apps/backend/src/services/auth/permissions/**` — role checks run **in addition to**
  the existing subscription-tier checks, never replacing them. Endpoints without role
  metadata behave exactly as before.
- `apps/orchestrator/src/activities/post.activity.ts` — approval gate in
  `postSocialInternal`.
- `apps/backend/src/api/api.module.ts` — registered the controller inside
  `authenticatedController` so `AuthMiddleware.forRoutes` covers it, and the service in
  `providers`.
- `tsconfig.base.json` — path aliases for the new libraries.
- `schema.prisma` — `UserOrganization.nashrCustomerId` -> `Customer`, plus
  `NashrBrandProfile.autonomousPublishing` (default **false**) and
  `clientApprovalRequired` (default **true**).

**Why the gate sits in `postSocialInternal`:** workflows `v1.0.1`–`v1.0.4` never call
`getPost`, so a gate there would miss them. All six versions funnel through
`postSocial`/`postSocialPending` into `postSocialInternal`, making it the one place every
`CreationMethod` (WEB, API, MCP, AUTOPOST, CLI) must pass. UI-only enforcement would be
bypassable through the public API.

**Why `nashrCustomerId` was necessary:** nothing linked an org member to a brand, so
CLIENT scoping failed closed and the CLIENT_APPROVAL stage was unusable — it would have
shipped a required workflow stage that no one could complete.

**Autonomous publishing is off by default**, per the brief. A typo in the kill switch
fails closed, and that behaviour is covered by a test.

Verified: 92 tests pass (37 permissions + 55 approval), re-run after the schema change.

### 2026-08-08 — Phase 6: Production deployment

**Added (root):** `Dockerfile.prod`, `docker-compose.prod.yaml`,
`docker-compose.staging.yaml`, `DEPLOYMENT.md`, `BACKUP_AND_RECOVERY.md`,
`SECURITY_CHECKLIST.md`, `OPERATIONS_RUNBOOK.md`.
**Added (`ops/`, 22 files):** Caddy config (automatic HTTPS), container entrypoint +
healthcheck, preflight guard, Postgres/uploads backup + restore + automated monthly
restore drill, secret rotation, logrotate, systemd timers, Temporal production
dynamicconfig.

**Rewritten:** `.env.example` (133 → 502 lines). Placeholders only; upstream's
real-looking fake Resend key removed.

**Modified:** `.gitignore` — a bare `.env` does **not** match `.env.prod` or
`.env.staging`, so real secrets could have been committed. Now ignores every variant and
re-includes the examples. Verified with `git check-ignore`.

**Not removed:** upstream `docker-compose.yaml` and `docker-compose.dev.yaml` are
untouched. Production is a separate file so upstream tooling keeps working.

**No root `Dockerfile`:** deliberate, so `railway.toml`, `Jenkins/` and a bare
`docker build .` stay unambiguous. Production builds are always `-f Dockerfile.prod`.

#### Upstream behaviours found and worked around
| Finding | Consequence |
|---|---|
| `main.ts` tests `!process.env.NOT_SECURED`; `"false"` is truthy in JS | Setting `NOT_SECURED=false` **enables** the insecure path. Guards reject the variable's *presence*, not its value. Same trap for `DISALLOW_PLUS`, `DISABLE_IMAGE_COMPRESSION`, `RUN_CRON`. |
| `STORAGE_PROVIDER` is read in `next.config.js` `redirects()`/`rewrites()` | It is **build-time**, not runtime. Switching local ↔ cloudflare needs a rebuild. |
| `NEXT_PUBLIC_SOURCE_URL` is build-time | Set only at runtime, the client bundle still points at upstream Postiz and the AGPL §13 obligation is unmet. Now a required build arg — the build fails without it. |
| `pnpm run pm2-run` calls `prisma-db-push --accept-data-loss` | The entrypoint bypasses it and drives pm2 directly, using `prisma migrate deploy` only. |
| `dynamicconfig/development-sql.yaml` enables a setting its own comment warns against in production | Production mounts a separate config. |

**Host sizing:** runtime limits total ≈6.6 GB; the build alone needs ~5 GB. Minimum to
run 8 GB / 4 vCPU / 80 GB SSD; recommended 16 GB / 4–8 vCPU / 160 GB NVMe.

**Verified:** `bash -n` passes on all 9 scripts; `docker compose config` renders prod,
staging and upstream; removing `JWT_SECRET` fails with
`required variable JWT_SECRET is missing a value`; preflight exits 1 on a bad env
(14 blockers) and 0 on a good one; all 10 pinned image digests re-resolved against the
live registry and matched.

**Not verified — no Docker daemon in this environment.** The image was never built, the
stack was never started, and `caddy validate` never ran. Those require a first real
deploy.

### 2026-08-08 — Phases 2, 3 and 5

#### Phase 2 — Rebrand
**Added:** `libraries/nashr-brand/` (single source of brand truth), `/about`, `/terms`,
`/privacy`, `/licenses` pages, Nashr logo/favicon/OG assets.
**Modified:** 68 → 23 files matching `postiz`; palette (Gulf teal `#0E7C74`, copper
`#B4552D`, both ≥4.9:1 on white); root `metadata` export.

**No `package.json` in the new libraries — deliberate.** No library in this repo has one;
`pnpm-lock.yaml` records no library importers, so adding one breaks
`pnpm install --frozen-lockfile` in CI. Resolution is via tsconfig paths only.

**Real bug fixed:** `nevo@postiz.com` was hard-coded as the agency notification
recipient — our notifications would have gone to the upstream author's inbox. Now
`AGENCY_NOTIFICATION_EMAIL`.

**AGPL §13 fix:** `(site)/layout.tsx` renders `null` until `/user/self` resolves and
`proxy.ts` redirected anonymous visitors to `/auth`, so `/licenses` was unreachable when
signed out. A source offer only reachable by authenticated users does not satisfy §13.
The four legal paths are now in the proxy allowlist with a minimal public shell.

**Hidden, not deleted:** upstream testimonials and "Join 10,000+ Entrepreneurs" are behind
`NEXT_PUBLIC_SHOW_TESTIMONIALS` (default off) — those quotes were given to Postiz, and
showing them under Nashr would misrepresent them.

#### Phase 3 — Arabic and MENA foundation
**Added:** `libraries/nashr-i18n/` (markets, timezone, currency, numerals, datetime,
hijri, typography, direction) and `libraries/nashr-content/` (6 bilingual campaigns,
5 vertical profiles). `RTL_CHECKLIST.md`, `UNTRANSLATED_BACKEND_STRINGS.md`.
**Modified:** all 16 locale files — 234 "Postiz" occurrences → 0.

**Five RTL bugs fixed:** `<html>` had neither `dir` nor `lang` (direction came only from a
client effect, so Arabic first-painted LTR then snapped); the toast rendered off-screen
(logical `start-[50%]` combined with physical `-translate-x-[50%]`); two context menus
anchored by measured `left` opened off-viewport; `dayjs.locale('ar-AE')` silently no-ops
and keeps the previous locale, so an `ar-AE` calendar would have shown English month
names; `change.dir.tsx` had an empty dependency array and never reacted to a language
switch.

**Saudi National Day edition numbers are Hijri-counted** — 2025 was the 95th, not
`2025−1932 = 93`. `editionNumber()` returns `null` outside a verified lookup table rather
than printing a wrong national-day number.

**Open brand decision:** "نشر" is also the ordinary noun for *publishing*, so bare
mid-sentence use is ambiguous. Currently rendered as «نشر» with Arabic guillemets.
**This needs the brand owner's ratification.**

#### Phase 5 — MENA content agents
**Added:** `libraries/nashr-agents/` (34 files) — six agents, 26 tools, 8 sensitive —
built on the existing Mastra runtime, plus `nashr-agents.controller.ts` on its own route
(upstream `copilot.controller.ts` untouched).

Guardrails are enforced once, centrally, and cannot be opted out of:
- **The model only ever receives an opaque `proposalId`.** The confirmation HMAC is minted
  solely by the authenticated HTTP approve endpoint, so **a model cannot approve its own
  action**. Proposals are single-use and bound to exact arguments.
- Registration-time validation rejects a `write|publish|delete|message|schedule|campaign`
  tool that is not marked sensitive — a mistake is a boot failure, not an incident.
- Redaction runs before prompt assembly, before logging, and before user-facing errors.
- 30 s/tool, 120 s/turn, ≤2 retries, **0 retries on sensitive writes**.
- Prohibited claims are injected into every system prompt and re-checked on output.

`PostsPort` deliberately fails closed: wiring scheduling here would create a second path
to the queue that bypasses the Temporal approval chokepoint.

**Known limitation:** `ProposalStorePort` is in-memory. **A multi-replica deployment needs
a Redis implementation**, or a proposal created on replica A cannot be approved on
replica B.

#### Integration wiring (lead engineer)
`tsconfig.base.json` path aliases for all five new libraries; `api.module.ts` registers
`NashrApprovalController` and `NashrAgentsController` inside `authenticatedController`
(so `AuthMiddleware.forRoutes` covers them) with their services as providers.

#### Verified
```
nashr-permissions   37 passed      nashr-approval   55 passed
nashr-agents       148 passed      nashr-i18n        5 passed
                                   TOTAL           245 passed
backend nest build       exit 0
orchestrator nest build  exit 0
frontend tsc --noEmit    exit 0
```
The `nashr-i18n` Hijri tests were **added by the lead engineer**: Phase 3 claimed an
852-conversion stress test but left nothing reproducible in the repo. The new spec pins
Ramadan 1445, Eid al-Fitr 1446 and Eid al-Adha 1447 against real observed dates and
round-trips 400 consecutive days.

#### Upstream bugs found, not fixed (tracked)
- `mastodon.custom.provider.ts:52` passes 5 args to `generateUrlDynamic`, which takes 4
  (`mastodon.provider.ts:87`). The extra `refresh` is silently dropped. Does not break the
  build.
- The root `jest.config.ts` calls `getJestProjects()` from `@nx/jest`, which is not
  installed and has no `nx.json`. **The root test runner is broken upstream for every
  project**, which is consistent with the audit finding of zero tests. Each Nashr library
  ships a self-contained config instead.
- `apps/orchestrator/.swcrc` duplicates the tsconfig alias list and carries a stale
  absolute `baseUrl` from an upstream developer's machine.

---

## Planned changes (not yet made)

Recorded here so the intent is auditable before the work lands. Nothing below is
implemented yet.

### Phase 2 — Rebrand
- **Add** `libraries/nashr-brand/` — centralised brand config, so brand strings are never
  scattered as literals.
- **Modify** 108 files containing `postiz`, plus all 18 locale files (the brand name leaks
  into translated strings, e.g. Arabic `ar/translation.json`).
- **Add** `/about`, `/terms`, `/privacy`, `/licenses` routes.
- **Add** footer attribution: "Built on Postiz, AGPL-3.0" + source-offer link.

### Phase 3 — Arabic and MENA foundation
- **Add** locales `en-AE`, `ar-AE`, `en-SA`, `ar-SA`.
- **Modify** default timezone to `Asia/Dubai`.
- **Modify** existing Arabic translation — it is machine-generated and unreviewed; the
  brief forbids shipping that as-is (RISK-P2).

### Phase 4 — MVP
- **Add** `PostApproval` model for `Draft → Internal review → Client approval → Schedule → Publish`.
  **Rationale for adding rather than extending the `State` enum:** `State` is consumed by
  versioned Temporal workflows (`post.workflow.v1.0.1`–`v1.0.6`); changing it would break
  in-flight workflows and conflict with every upstream schema change.
- **Add** role→permission matrix. Upstream `Role` exists but is unenforced; only
  subscription-tier gating exists today.

### Phase 5 — Agents
- **Add** `libraries/nashr-agents/` on the existing Mastra runtime — extending, not
  replacing, upstream's agent substrate.
- **Add** `AgentActionLog` model for the audit trail the brief requires.

### Features to be hidden, NOT deleted
The brief excludes marketplace/enterprise complexity from the MVP. These will be
**feature-flagged off in the UI while the code and schema stay intact.**

**Reason for hiding rather than deleting (brief item 9):** deleting them would create
permanent merge conflicts against upstream and violate brief item 10 (preserve the ability
to pull future updates). No functionality is lost — only hidden from customers.

`SocialMediaAgency`, `SocialMediaAgencyNiche`, `Orders`, `OrderItems`, `Messages`,
`MessagesGroup`, `PayoutProblems`, `Star`, `Trending`, `TrendingLog`, `ItemUser`,
`PopularPosts`, `plugs`, `autopost` (RSS), `third-party`, OAuth-provider mode,
`enterprise.controller`, `apps/extension`, `apps/sdk`.

---

## Security posture changes

| Change | Reason |
|---|---|
| Replace `prisma db push --accept-data-loss` with `migrate deploy` | Upstream has **no migration history**; `--accept-data-loss` on production destroys data (RISK-01) |
| `JWT_SECRET` must have no default; fail hard at boot | Upstream ships a literal placeholder in `docker-compose.yaml:11` (RISK-S1) |
| Refuse to boot production with `DISABLE_SSRF_PROTECTION=true` or `NOT_SECURED=true` | Prevents webhook SSRF into internal services (RISK-S2) |
| Build our own pinned image | Upstream compose pulls `ghcr.io/gitroomhq/postiz-app:latest` — unpinned and Postiz-branded (RISK-D3) |

No secrets are committed. All configuration is via environment variables (brief items 5, 6).
