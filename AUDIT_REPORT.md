# AUDIT_REPORT.md — Phase 1

**Product (working brand):** Nashr / نشر
**Upstream base:** [gitroomhq/postiz-app](https://github.com/gitroomhq/postiz-app) `v1.47.0` (`version.txt`)
**Upstream licence:** AGPL-3.0 (`LICENSE`, 661 lines, GNU AGPL v3 verbatim)
**Audit date:** 2026-08-08
**Code modified during audit:** none. This phase was read-only.

---

## 0. Correction to the task premise (read this first)

The brief states *"Source repository: the current Postiz repository in this workspace."*
**That is not what is in the workspace.**

`/home/user/restoflux` contains **RestoFlux** — an unrelated ~50-file Cloudflare Workers
application (vinext + Next 16 + Cloudflare D1 + Drizzle ORM) for restaurant-delivery
merchant credential onboarding (Talabat, Deliveroo, noon Food, Keeta).

Evidence:

| Check | Result |
|---|---|
| `grep -ri postiz /home/user/restoflux` | **0 matches** |
| `apps/frontend`, `apps/backend`, `apps/orchestrator` | absent |
| `schema.prisma` | absent (uses `db/schema.ts`, Drizzle) |
| PostgreSQL / Redis / Temporal | absent (uses Cloudflare D1) |
| Total files | 50 (Postiz has 927) |

RestoFlux has no scheduling engine, no social OAuth, no content calendar, no AI layer.
Building the MENA SaaS on it would mean writing the platform from scratch, which the
brief explicitly forbids.

**Action taken (approved by user):** cloned upstream `gitroomhq/postiz-app` to
`/home/user/nashr`. This audit describes **that** codebase. RestoFlux is untouched.

---

## 1. Architecture at a glance

pnpm monorepo (`pnpm@10.6.1`), Node `>=22.12.0 <23.0.0`.

| App | Framework | Role |
|---|---|---|
| `apps/frontend` | **Next.js 16.2.6**, React 19.2.4, App Router, Tailwind | Customer UI |
| `apps/backend` | **NestJS 11.1.21** (Express) | REST API, auth, controllers |
| `apps/orchestrator` | **Temporal** worker (NestJS host) | Publishing, retries, emails, token refresh |
| `apps/commands` | NestJS CLI | Maintenance commands |
| `apps/extension` | Browser extension (MV3) | Out of MVP scope |
| `apps/sdk` | Published npm SDK | Out of MVP scope |

| Library | Contents |
|---|---|
| `libraries/nestjs-libraries` | Prisma layer, 36 social providers, Temporal, upload, email, OpenAI, agent, redis, throttler |
| `libraries/react-shared-libraries` | **i18n / translation**, shared React utilities |
| `libraries/helpers` | Cross-cutting helpers |

### Frontend route map (`apps/frontend/src/app`)
`(app)/(site)/` → `launches` (calendar), `analytics`, `billing`, `media`, `settings`,
`agents`, `plugs`, `admin`, `third-party`, `err`
`(app)/auth/` → `login`, `activate`, `forgot`, `login-required`
`(app)/integrations/social`, `(app)/oauth/authorize`, `(app)/(preview)/p`

### Backend controllers (`apps/backend/src/api/routes`, 26 files)
`auth`, `users`, `settings`, `integrations`, `posts`, `media`, `analytics`,
`webhooks`, `oauth`, `oauth-app`, `stripe`, `billing`, `notifications`, `sets`,
`autopost`, `signature`, `third-party`, `copilot`, `admin`, `announcements`,
`approved-apps`, `enterprise`, `monitor`, `public`, `root`, `no.auth.integrations`

Public API: `apps/backend/src/public-api/routes/v1/public.integrations.controller.ts` (v1, single controller).

---

## 2. Database and Prisma

- **PostgreSQL** (`datasource db { provider = "postgresql" }`), `DATABASE_URL`.
- Schema: `libraries/nestjs-libraries/src/database/prisma/schema.prisma` — **970 lines, ~50 models**.
- Prisma CLI pinned to `6.5.0` via `pnpm dlx` in root scripts.

Models directly relevant to the MVP:

| Model | Line | Relevance |
|---|---|---|
| `Organization` | 11 | Workspace/tenant root |
| `User` | 79 | Accounts |
| `UserOrganization` | 136 | Membership + `Role` |
| `Customer` | 301 | **Client/brand grouping inside an org** — maps to "multiple brands" |
| `Integration` | 314 | A connected social channel (tokens, refresh, `customerId`) |
| `Post` | 393 | Content, `state`, `publishDate`, `group`, `parentPostId`, threads |
| `Comments` | 373 | Post-level comments — usable for review notes |
| `Media` | 209 | Uploads |
| `Notifications` | 448 | In-app + email notifications |
| `Webhooks` / `IntegrationsWebhooks` | 595 / 583 | Outbound webhooks |
| `Subscription`, `Credits`, `UsedCodes` | 283, 270, 125 | Billing / usage |
| `Sets` | 631 | Saved channel groupings |
| `AutoPost` | 610 | RSS-driven auto posting |
| `OAuthApp`, `OAuthAuthorization` | 845, 867 | Postiz-as-OAuth-provider |
| `mastra_*` (8 tables) | 689–843 | Mastra AI agent memory/traces |

Key enums:
```
State                    = QUEUE | PUBLISHED | ERROR | DRAFT
Role                     = SUPERADMIN | ADMIN | USER
Provider                 = LOCAL | GITHUB | GOOGLE | FARCASTER | WALLET | GENERIC
SubscriptionTier         = STANDARD | PRO | TEAM | ULTIMATE
CreationMethod           = UNKNOWN | WEB | MCP | API | AUTOPOST | CLI
APPROVED_SUBMIT_FOR_ORDER= NO | WAITING_CONFIRMATION | YES
ShortLinkPreference      = ASK | YES | NO
```

### ⚠ No migration history exists
There is **no `migrations/` directory anywhere in the repo** (verified with
`find . -type d -name migrations`). Schema is applied with:

```
prisma-db-push: "prisma db push --accept-data-loss --schema .../schema.prisma"
```

`--accept-data-loss` on a production database is a data-destruction hazard. Baselining a
real migration history is a **hard prerequisite for production** (RISK-01).

---

## 3. Authentication and user management

`apps/backend/src/services/auth/`

- `auth.service.ts` — registration, login, activation, forgot/reset password.
- `auth.middleware.ts` / `public.auth.middleware.ts` — JWT from cookie/header; `JWT_SECRET`.
- `providers/` — `LOCAL` (email+password), `github`, `google`, `farcaster`, `wallet`, `oauth` (generic OIDC), fronted by `providers.manager.ts`.
- DTOs: `login.user.dto`, `create.org.user.dto`, `forgot.password.dto`, `forgot-return.password.dto`, `resend-activation.dto`.
- Flags: `DISABLE_REGISTRATION`, `DISALLOW_PLUS` (blocks `user+tag@` signups), `NOT_SECURED`.

Email activation is wired through the email service; login is cookie-JWT based.

## 4. Organization / team / workspace

- `Organization` ↔ `User` via `UserOrganization` carrying `Role`.
- Team invitations exist: `settings.controller.ts` `@Post('/team')` → `inviteTeamMember`,
  `@Post('/team/add')`, `@Delete('/team/:id')`, `@Get('/team')`, with
  `AddTeamMemberDto` / `AdminAddTeamMemberDto`.
- `Customer` (org-scoped, unique on `[orgId, name, deletedAt]`) groups `Integration`s —
  this is the existing mechanism for **multiple brands/clients per organization**.

### RBAC is thin
`permissions.ability.ts` is only a 7-line `SetMetadata` decorator factory. The real gate is
`permissions.service.ts` + `permissions.guard.ts`, and `Sections` is
**subscription-tier gating, not role gating**:

```
CHANNEL | POSTS_PER_MONTH | VIDEOS_PER_MONTH | TEAM_MEMBERS |
COMMUNITY_FEATURES | FEATURED_BY_GITROOM | AI |
IMPORT_FROM_CHANNELS | ADMIN | WEBHOOKS
```
Actions: `create | read | update | delete`.

So `Role` (SUPERADMIN/ADMIN/USER) exists in the schema but there is **no per-role policy
matrix**. Phase 4's "role-based permissions" needs real work (see plan §4).

## 5. Social provider integrations — 36 providers

`libraries/nestjs-libraries/src/integrations/social/`

`bluesky, dev.to, discord, dribbble, facebook, farcaster, gmb, hashnode, instagram,
instagram.standalone, kick, lemmy, linkedin, linkedin.page, listmonk, mastodon,
mastodon.custom, medium, mewe, moltbook, nostr, pinterest, reddit, skool, slack,
telegram, threads, tiktok, tumblr, twitch, vk, whop, wordpress, x, youtube`

All implement `social.integrations.interface.ts`. All use official OAuth/API flows —
**no scraping, no headless-browser logins** were found. This satisfies brief items 7 and 8.
13 providers implement analytics fetching.

**MENA-relevant subset for MVP:** Instagram, Facebook, TikTok, X, LinkedIn (+ page),
YouTube, Threads, Snapchat *(absent — see gaps)*, Google Business Profile (`gmb`).

## 6. AI features (already present)

- `libraries/nestjs-libraries/src/openai/openai.service.ts` — captions, content generation.
- `libraries/nestjs-libraries/src/openai/fal.service.ts` — image/video generation via fal.
- `libraries/nestjs-libraries/src/agent/agent.graph.service.ts` — **LangGraph** `StateGraph`
  agent (`@langchain/langgraph`) with `ChatOpenAI` gpt-4.1, DALL·E wrapper, optional Tavily search.
- `libraries/nestjs-libraries/src/chat/mastra.service.ts` + **Mastra** (`@mastra/core` 1.21,
  `@mastra/memory`, `@mastra/pg`, `@mastra/mcp`) with 8 `mastra_*` Postgres tables.
- `apps/backend/src/api/routes/copilot.controller.ts` — CopilotKit runtime bridging Mastra agents to the UI.
- Frontend: `apps/frontend/src/components/agents/` (`agent.tsx`, `agent.chat.tsx`, …).

**This is a real, working agent substrate.** Phase 5 should extend it, not replace it.

## 7. API and webhooks

- Public REST API v1 (`public-api/routes/v1/`), API-key auth via `Organization.apiKey`, `API_LIMIT`.
- Outbound webhooks: `webhooks.controller.ts`, `Webhooks` model, per-integration filtering.
- **SSRF protection present**: `libraries/nestjs-libraries/src/dtos/webhooks/ssrf.safe.dispatcher.ts`
  wraps axios and blocks private IP ranges; opt-out via `DISABLE_SSRF_PROTECTION=true`.
- Postiz can itself act as an OAuth **provider** (`OAuthApp`, `OAuthAuthorization`, `oauth-app.controller.ts`).

## 8. Background workers / Temporal

`apps/orchestrator/src/`

- Workflows: `post.workflow.v1.0.1` … `v1.0.6` (versioned publishing), `autopost`,
  `digest.email`, `send.email`, `refresh.token`, `streak`, `missing.post`.
- Activities: `post`, `email`, `integrations`, `autopost`.
- Signals: `email.signal`, `send.email.signal`.
- Registration helpers in `libraries/nestjs-libraries/src/temporal/`
  (`temporal.register.ts`, `infinite.workflow.register.ts`, `temporal.search.attribute.ts`).
- Config: `TEMPORAL_ADDRESS`, `EXCLUDE_QUEUE`. Health endpoint at `health.controller.ts`.
- Redis (`REDIS_URL`) is present via `libraries/nestjs-libraries/src/redis`.

Retry/backoff for failed publishing is handled by Temporal's native retry policy —
this covers a large part of Phase 7's "failed publishing and retry behavior".

## 9. Upload and storage

`libraries/nestjs-libraries/src/upload/upload.factory.ts` selects on `STORAGE_PROVIDER`:

- `local` → `local.storage.ts`, `UPLOAD_DIRECTORY` (+ `NEXT_PUBLIC_UPLOAD_DIRECTORY`)
- `cloudflare` → `cloudflare.storage.ts` (**Cloudflare R2, S3-compatible**), vars
  `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_ACCESS_KEY`, `CLOUDFLARE_SECRET_ACCESS_KEY`,
  `CLOUDFLARE_REGION`, `CLOUDFLARE_BUCKETNAME`, `CLOUDFLARE_BUCKET_URL`
- `r2.uploader.ts`, `custom.upload.validation.ts`, `data.url.ts` support these.
- `DISABLE_IMAGE_COMPRESSION` flag.

**Phase 6's R2 requirement is already met — configuration only.**

## 10. Billing

- `libraries/nestjs-libraries/src/services/stripe.service.ts` + `stripe.country.list.ts`
- `apps/backend/src/api/routes/stripe.controller.ts` (webhook receiver), `billing.controller.ts`
- Tiers in `libraries/nestjs-libraries/src/database/prisma/subscriptions/pricing.ts`:
  `FREE / STANDARD ($29 mo, $278 yr) / TEAM / PRO / ULTIMATE`, each with
  `channel`, `posts_per_month`, `team_members`, `ai`, `image_generation_count`,
  `generate_videos`, `public_api`, `webhooks`, `autoPost` limits.
- Gated at runtime by `permissions.service.ts` → `SubscriptionException` (HTTP 402).

**Usage limits and "subscription-ready architecture" already exist.** They need
re-pricing in AED/SAR and MENA tier naming, not new code.

## 11. Email and notifications

`libraries/nestjs-libraries/src/emails/`: `email.interface.ts`, `node.mailer.provider.ts`
(SMTP), `resend.provider.ts`, `empty.provider.ts`; selected in
`libraries/nestjs-libraries/src/services/email.service.ts` via `EMAIL_PROVIDER`.
Vars: `EMAIL_HOST/PORT/USER/PASS/SECURE`, `EMAIL_FROM_ADDRESS`, `EMAIL_FROM_NAME`, `RESEND_API_KEY`.
In-app: `Notifications` model + `notifications.controller.ts` + digest email Temporal workflow.

## 12. Environment variables

`.env.example` exists at repo root. **151 distinct `process.env.*` keys** are referenced
across `apps/` and `libraries/`. Categories:

- **Core:** `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `FRONTEND_URL`, `BACKEND_URL`, `BACKEND_INTERNAL_URL`, `MAIN_URL`, `NEXT_PUBLIC_BACKEND_URL`, `TEMPORAL_ADDRESS`, `IS_GENERAL`
- **Storage:** `STORAGE_PROVIDER`, `UPLOAD_DIRECTORY`, `CLOUDFLARE_*`
- **Email:** `EMAIL_*`, `RESEND_API_KEY`
- **AI:** `OPENAI_API_KEY`, `FAL_KEY`, `TAVILY_API_KEY`, `ELEVENSLABS_API_KEY`, `KIEAI_API_KEY`, `AGENT_API_KEY`, `AGENT_MEDIA_SSO_KEY`
- **~30 social OAuth pairs:** `FACEBOOK_APP_ID/SECRET`, `LINKEDIN_CLIENT_ID/SECRET`, `TIKTOK_*`, `X_*`, `YOUTUBE_*`, `INSTAGRAM_*`, `THREADS_*`, `DISCORD_*`, `GOOGLE_GMB_*`, `KICK_*`, `DRIBBBLE_*`, …
- **Safety flags:** `DISABLE_REGISTRATION`, `DISALLOW_PLUS`, `DISABLE_SSRF_PROTECTION`, `DISABLE_IMAGE_COMPRESSION`, `DISABLE_X_ANALYTICS`, `NOT_SECURED`
- **Third-party/analytics:** `STRIPE_*`, `SENTRY_*`, `DUB_*`, `KUTT_*`, `LISTMONK_*`, `BEEHIIVE_*`, `CHATBASE_TOKEN`, `DATAFAST_*`, `FACEBOOK_PIXEL_ACCESS_TOKEN`

**No hardcoded secrets were found.** A regex sweep for assigned literal
secret/password/api_key values (excluding `process.env`) returned **zero results**.
Two weak-but-harmless fallbacks exist: `process.env.OPENAI_API_KEY || 'sk-proj-'`
in `agent.graph.service.ts:26,32` (an invalid stub, not a real key).

## 13. Branding — hardcoded "Postiz" references

**108 files** contain `postiz` (case-insensitive), excluding `.git`, `pnpm-lock.yaml`
and translation locales:

| Area | Files |
|---|---|
| `apps/frontend/src` | **47** |
| `libraries/nestjs-libraries/src` | 17 |
| `apps/backend/src` | 3 |
| `libraries/react-shared-libraries/src` | 2 |
| infra (`docker-compose*.yaml`, `var/docker/*.sh`, `sonar-project.properties`) | 5 |
| package manifests (`postiz-frontend`, `postiz-backend`, sdk, extension, orchestrator, commands) | 8 |
| docs (`SECURITY.md`, sdk `README.md`), `i18n.lock` | 3 |

Plus: `apps/frontend/public/` assets (logos, favicons, `og` images), `docker-compose.yaml`
image `ghcr.io/gitroomhq/postiz-app:latest`, container/volume names `postiz-postgres`,
`postiz-redis`, `postiz-uploads`, and the internal package scope **`@gitroom/*`** used in
every import path.

**Additionally: the brand name leaks into the translations.** e.g.
`locales/ar/translation.json` contains
`"…عند حدوث شيء ما في Postiz عبر طلب HTTP"` — **234 occurrences across the locale files**.
Any rebrand must sweep all 16 locale files, not just code.

**Recommendation:** do **not** rename the `@gitroom/*` import scope. It is internal,
never customer-visible, and renaming it would touch ~900 files and permanently
break upstream merges. Rebrand only customer-facing surfaces.

## 14. Licence and third-party dependencies

- `LICENSE` — GNU AGPL v3.0 verbatim, 661 lines. **Must be preserved.**
- Root `package.json` declares `"license": "AGPL-3.0"`.
- **Inconsistency:** 4 sub-package manifests declare `"license": "ISC"` (e.g.
  `apps/frontend/package.json`). This is upstream metadata sloppiness; the combined
  work is AGPL-3.0. Do not "fix" it in a way that misrepresents the licence.
- Governance files present: `CODE_OF_CONDUCT.md`, `CONTRIBUTING.md`, `SECURITY.md`,
  `ICLA.md`, `CCLA.md` (contributor licence agreements).
- Notable dependency licences to enumerate in Phase 2's Open-Source Licenses page:
  Next.js (MIT), NestJS (MIT), Prisma (Apache-2.0), Temporal SDK (MIT),
  LangChain/LangGraph (MIT), Mastra (Apache-2.0/Elastic — **must verify**), CopilotKit (MIT).

**AGPL §13 obligation:** because Nashr will be offered over a network, every user
interacting with it remotely must be offered the Corresponding Source. A private repo is
fine pre-launch, but before onboarding real customers you need a source-offer route
(a public mirror, or a download link in the UI footer).

## 15. Security risks observed

| # | Observation | Evidence |
|---|---|---|
| S1 | `prisma db push --accept-data-loss` is the only schema mechanism; no migrations | root `package.json` scripts |
| S2 | `docker-compose.yaml` ships a **literal placeholder `JWT_SECRET`** in plaintext | `docker-compose.yaml:11` |
| S3 | `DISABLE_SSRF_PROTECTION` can disable webhook IP filtering | `ssrf.safe.dispatcher.ts:66-75` |
| S4 | `NOT_SECURED` flag bypasses auth hardening | env sweep |
| S5 | Social OAuth tokens stored in `Integration` — encryption-at-rest not verified | `schema.prisma:314` |
| S6 | Cross-tenant isolation depends on every query filtering `organizationId`; no DB-level RLS | `schema.prisma`, service layer |
| S7 | `sk-proj-` fallback masks a missing `OPENAI_API_KEY` as a runtime error instead of a startup failure | `agent.graph.service.ts:26,32` |
| S8 | Public API rate limiting relies on a single `API_LIMIT` var | `throttler/` |

None of these are exploited defects in upstream; they are configuration and hardening
gaps that **we own** for a production deployment.

## 16. Test coverage

```
find . \( -name "*.spec.ts" -o -name "*.test.ts" -o -name "*.spec.tsx" \) | wc -l
→ 0
```

**There are zero test files.** `jest.config.ts`, `jest.preset.js` and a root
`test` script exist, plus `sonar-project.properties` and a `reports/` dir — the harness
is configured but nothing is written. Phase 7 is therefore **entirely greenfield**.

## 17. Deployment requirements

`docker-compose.yaml` already defines:

| Service | Image |
|---|---|
| `postiz` (app) | `ghcr.io/gitroomhq/postiz-app:latest` |
| `postiz-postgres` | `postgres:17-alpine` |
| `postiz-redis` | `redis:7.2` |
| `temporal` | `temporalio/auto-setup:1.28.1` |
| `temporal-postgresql` | `postgres:16` |
| `temporal-elasticsearch` | `elasticsearch:7.17.27` |
| `temporal-admin-tools` | `temporalio/admin-tools:1.28.1` |
| `temporal-ui` | `temporalio/ui:2.34.0` |
| `spotlight` | `ghcr.io/getsentry/spotlight:latest` |

Volumes: `postgres-volume`, `postiz-redis-data`, `postiz-config`, `postiz-uploads`.
Networks: `postiz-network`, `temporal-network`.
Also present: `var/docker/nginx.conf`, `docker-build.sh`, `docker-create.sh`,
`Dockerfile.dev`, `railway.toml`, `Jenkins/`.

**Missing for production:** TLS/HTTPS termination and certificate automation, automated
backups, log rotation, staging/production separation, health checks on all services,
and a self-built image (the compose file pulls the upstream Postiz image, which would
ship upstream branding).

---

## 18. Classification — the four buckets the brief asked for

### A. Already available (use as-is, zero code)
- Organizations, users, `UserOrganization` membership, team invitations
- `Customer` model = multiple brands/clients per organization
- 36 social providers, all official OAuth/API — incl. Instagram, Facebook, TikTok, X, LinkedIn, YouTube, Threads, GMB
- Content calendar (`launches`), drafts (`State.DRAFT`), scheduling (`State.QUEUE`)
- Temporal publishing with versioned workflows, native retry, token refresh
- Media upload + local/R2 storage
- Analytics for 13 providers
- Outbound webhooks with SSRF protection
- Public API v1 + API keys
- Stripe billing, 5 tiers, usage-limit enforcement (HTTP 402)
- Email (SMTP/Resend) + in-app notifications + digest workflow
- **i18n framework with Arabic already a shipped locale** (`libraries/react-shared-libraries/src/translation`), 16 locales, `ar` has 739 keys
- **Minimal RTL support** — `change.dir.tsx`, `language.component.tsx`. See the correction below: real RTL coverage is far thinner than a raw grep suggests
- AI: OpenAI captions, fal images, LangGraph agent, Mastra agent runtime + memory, CopilotKit UI

### B. Configuration only (env vars / config files, no code)
- Cloudflare R2 storage (`STORAGE_PROVIDER=cloudflare` + 6 vars)
- SMTP/Resend email
- Social OAuth app credentials per platform (~30 pairs)
- `DISABLE_REGISTRATION`, `DISALLOW_PLUS`, `API_LIMIT`
- Sentry (`SENTRY_*`) for error monitoring
- Temporal address, Redis URL, Postgres URL
- Locale target list in `i18n.json` (add `ar-AE`, `ar-SA`, `en-AE`, `en-SA`)

### C. Small modifications
- Centralised brand config + sweep of 108 Postiz-referencing files and 18 locale files
- Favicon, logos, OG images, `<title>`, metadata, error pages, email templates
- Default timezone → `Asia/Dubai`; locale-aware date/time via existing dayjs
- AED/SAR currency formatting in `pricing.ts` + billing UI
- Arabic typography (font stack, line-height, numeral form)
- Extend `i18n.json` targets; correct machine-translated Arabic that leaks "Postiz" (234 occurrences)
- Re-price and rename subscription tiers for MENA
- About / Terms / Privacy / Open-Source Licenses pages
- Self-built Docker image instead of `ghcr.io/gitroomhq/postiz-app`

### D. Requires new development
- **Real RBAC** — a role→permission matrix; `Role` exists but is unenforced (only tier gating exists)
- **Approval workflow** `Draft → Internal review → Client approval → Schedule → Publish`
  — `State` has only 4 values; needs new states + audit trail. `Comments` and
  `APPROVED_SUBMIT_FOR_ORDER` are partial precedents but built for the marketplace, not client approval
- **Nashr MENA agents** (Brand Profile, Content, Localization, Campaign Calendar, Approval, Analytics Summary) with approval-before-execute, action logging, retry/timeout limits
- **Arabic↔English cultural adaptation** (beyond literal translation)
- **RTL completeness pass** across calendar, tables, modals, menus, notifications
- **MENA campaign templates** (Ramadan, Eid, UAE National Day, Saudi National Day) + sample content
- **The entire test suite** — 0 tests exist today
- Production ops: migrations baseline, backups, log rotation, HTTPS, staging/prod split
- The 5 Phase-6 documents + `MENA_CUSTOMIZATIONS.md`

### E. Should be postponed (explicitly out of MVP)
- WhatsApp Business integration, CRM, payment automation, mobile apps
- `apps/extension` (browser extension) and `apps/sdk`
- Postiz marketplace: `SocialMediaAgency`, `Orders`, `OrderItems`, `Messages`,
  `PayoutProblems`, `Star`, `Trending`, `ItemUser`, `PopularPosts` — **disable in UI,
  do not delete** (deleting breaks upstream merges; see RISK-03)
- `plugs`, `autopost` (RSS), `third-party`, OAuth-provider mode, `enterprise.controller`
- Snapchat and regional platforms (**Snapchat has no provider — significant for MENA**)
- Fully autonomous publishing (brief forbids it by default)

---

## 19. Gaps specific to the MENA brief

| Gap | Severity | Note |
|---|---|---|
| **Snapchat provider absent** | High | Snapchat penetration in Saudi/UAE is very high. Not in the 36 providers. Postponed to post-MVP but must be disclosed to beta customers. |
| Arabic translation is machine-generated | Medium | `i18n.json` uses lingo.dev + `gpt-4.1`. 739 keys, unreviewed. Brief forbids unreviewed machine translation. Requires native review. |
| No Hijri calendar support | Medium | Ramadan/Eid scheduling needs Hijri awareness. |
| No `ar-AE` vs `ar-SA` distinction | Medium | Only generic `ar` exists today. |
| Currency is USD-only | Low | `pricing.ts` uses bare numbers; formatting is presentational. |
| No prayer-time / Friday-weekend awareness | Low | Optimal-time scheduling assumes Mon–Fri. |

---

## 20. Evidence index

Every claim above is reproducible from the clone at `/home/user/nashr` (Postiz v1.47.0):

```
find . -type d -name migrations                    → (empty)
find . -name "*.spec.ts" -o -name "*.test.ts" | wc → 0
grep -ril postiz . | grep -v /locales/ | wc -l     → 108
grep -rhoE "process\.env\.[A-Z0-9_]+" apps libraries | sort -u | wc -l → 151
ls libraries/nestjs-libraries/src/integrations/social/ | wc -l → 37 (36 providers + interface)
wc -l libraries/nestjs-libraries/src/database/prisma/schema.prisma → 970
wc -l LICENSE                                      → 661
cat version.txt                                    → v1.47.0
```


---

## 21. Corrections to this audit (added 2026-08-08, post-implementation)

Three figures in the original audit were wrong. They were found during Phase 3 and are
corrected here rather than quietly edited away, since the plan was sized against them.

| Claim | Originally stated | Verified against `git show main:` | Effect |
|---|---|---|---|
| Locale directories | 18 | **16** | Minor. Scope of the locale sweep was slightly overstated. |
| `ar` translation keys | ~1,400 | **739** | My count divided the raw quote count by 2; each key/value pair has 4 quotes. The native-review burden is roughly **half** what the audit implied. |
| RTL support | "99 `rtl` references … partial RTL support" | **109 total hits, but 75 are `shortlink`/`shortLink` substring matches. Only 34 are genuinely direction-related.** | Material. The audit **overstated existing RTL support**. Real pre-existing coverage was a handful of `rtl:rotate-180` classes and a few escape-hatch CSS rules — not a working RTL layout. |

The RTL error is the one that mattered: a case-insensitive `grep -i rtl` matches
`sho**rtl**ink`, and this repo has a lot of short-link code. Phase 3 was correspondingly
more work than planned, and RISK-P3 (RTL layout breakage) was **under**-rated rather than
over-rated.

Reproduce:
```
git show main:libraries/react-shared-libraries/src/translation/locales/ar/translation.json \
  | python3 -c "import json,sys;print(len(json.load(sys.stdin)))"          # 739
git ls-tree main --name-only .../locales/ | wc -l                          # 16
git grep -ni rtl main -- apps/frontend/src libraries/react-shared-libraries/src | wc -l   # 109
  ... | grep -ci shortlink                                                 # 75
```

### Second round of corrections (found during Phase 8)

| Claim | Originally stated | Verified | Effect |
|---|---|---|---|
| Social providers | 36 | **34 registered** | I counted files in `integrations/social/`, which includes `social.integrations.interface.ts` and `hashnode.tags.ts` (not providers), and `MastodonCustomProvider`, which upstream has **commented out** at `integration.manager.ts:76`. The substantive claim — all official OAuth/API, no scraping — is unchanged. |
| Analytics-capable providers | 13 | **11** | Same over-count method. |
| `@mastra/*` licence (RISK-L5) | "must verify" | **Apache-2.0** | Verified in the installed manifests for `@mastra/core` and `@ag-ui/mastra`. Compatible with SaaS resale. RISK-L5 downgraded to 🟢, with the caveat that `@mastra/core` ships no `LICENSE` file. |

Reproduce:
```
grep -c "new .*Provider()" <(sed -n '42,76p' .../integration.manager.ts)   # 35, of which
grep -n "MastodonCustomProvider" .../integration.manager.ts                # line 76 is commented
python3 -c "import json;print(json.load(open('node_modules/@mastra/core/package.json'))['license'])"
```

### A section 13 defect found in Phase 8 (now fixed)

All 16 locale files hardcoded `https://github.com/gitroomhq/postiz-app` inside the
customer-facing FAQ value `faq_postiz_gitroom_is_proudly_open_source`. i18next prefers a
resource value over the React default, so the product's own "view the source code" link
sent customers to **upstream Postiz regardless of `NEXT_PUBLIC_SOURCE_URL`** — both an
unmet AGPL §13 obligation and a customer-facing use of the Postiz trademark.

It survived the Phase 2 branding sweep because that sweep matched `Postiz`, not the
lowercase URL, and Phase 3 preserved the URL believing it to be required attribution.
Attribution *is* required — but it belongs on `/licenses`, which carries it; the §13
offer must point at **our** modified source.

Fixed by interpolating `{{sourceUrl}}` in all 16 locales and passing `brand.sourceUrl`
from the component. Pinned by `libraries/nashr-i18n/src/agpl-source-offer.spec.ts`, which
fails if any locale reintroduces an upstream link.
