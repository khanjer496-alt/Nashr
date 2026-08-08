# IMPLEMENTATION_PLAN.md — Nashr (نشر)

Derived from `AUDIT_REPORT.md`. Base: Postiz v1.47.0 (AGPL-3.0).
Nothing in Phases 2–8 begins until Phase 1 is approved.

---

## Guiding constraints

1. **Upstream-mergeable.** Never rename the `@gitroom/*` import scope. Never delete
   upstream files. Additive-first: new code goes in new files under `nashr/` namespaces;
   upstream files are touched only where a value must change.
2. **Centralised brand.** One `libraries/nashr-brand/` module is the single source of
   brand strings, colours, URLs, legal text. No new hardcoded brand literals.
3. **AGPL preserved.** `LICENSE`, `SECURITY.md`, `CODE_OF_CONDUCT.md`, `CONTRIBUTING.md`,
   `ICLA.md`, `CCLA.md` stay untouched. Attribution added, never removed.
4. **No secrets in git.** Everything through env vars; `.env.example` carries placeholders only.
5. **Nothing deleted without a documented reason** in `MENA_CUSTOMIZATIONS.md`.

## Repository and branching strategy

```
origin    → khanjer496-alt/nashr        (private, our fork)
upstream  → gitroomhq/postiz-app         (read-only, for future merges)
```

Branches: `main` (deployable) ← `claude/mena-saas-postiz-conversion-7el9fk` (this work).
Upstream sync: `git fetch upstream && git merge upstream/main` on a dedicated
`sync/upstream-<version>` branch, resolved, then PR'd. Cadence: monthly.

**Status:** resolved. `khanjer496-alt/Nashr` was created by the owner and is now `origin`.
`main` holds pristine Postiz v1.47.0 (full history, 2 781 commits) so that
`git merge upstream/main` stays possible. All Nashr work lands on branches off `main`.

---

## Phase 2 — Rebrand

**Goal:** zero customer-visible "Postiz", one brand config, MENA-appropriate visual style.

| # | Task | Files |
|---|---|---|
| 2.1 | Create `libraries/nashr-brand/src/brand.config.ts` — name (en/ar), tagline, domain (from `NEXT_PUBLIC_APP_URL`), support email, legal entity, colours, logo paths | new |
| 2.2 | Logo + favicon + OG image set (SVG + PNG, light/dark, RTL-safe wordmark) | `apps/frontend/public/` |
| 2.3 | Replace 47 frontend brand references with `brand.config` reads | `apps/frontend/src` |
| 2.4 | Replace 17 + 3 + 2 backend/library references | `libraries/nestjs-libraries/src`, `apps/backend/src`, `libraries/react-shared-libraries/src` |
| 2.5 | Metadata: `<title>`, `description`, OpenGraph, Twitter card, manifest | `apps/frontend/src/app/layout.tsx` |
| 2.6 | Login screen, dashboard shell, error pages (`err/`, 404, 500) | frontend |
| 2.7 | Email templates: sender name, header, footer, activation/forgot/digest | `libraries/nestjs-libraries/src/emails` |
| 2.8 | **Sweep all 18 locale files** for embedded "Postiz" (incl. `ar`) | `.../translation/locales/*/translation.json` |
| 2.9 | Infra renames: compose service/volume names, self-built image, `sonar-project.properties` | `docker-compose*.yaml`, `var/docker/` |
| 2.10 | Design tokens: MENA-oriented palette, spacing, radii — clean and fast, agency-appropriate | `apps/frontend/tailwind.config.cjs`, `globals.css` |
| 2.11 | **New pages:** `/about`, `/terms`, `/privacy`, `/licenses` (the last generated from `pnpm licenses list`) | new routes |
| 2.12 | Footer attribution: "Built on Postiz, AGPL-3.0" + source-offer link | frontend layout |
| 2.13 | Start `MENA_CUSTOMIZATIONS.md` | root |

**Not renamed (deliberate):** `@gitroom/*` imports, Prisma model names, DB table names,
internal env var names. Rationale recorded in `MENA_CUSTOMIZATIONS.md`.

**Exit:** `grep -ril postiz apps/frontend/src apps/backend/src libraries/*/src` returns only
attribution strings and the upstream licence notice.

---

## Phase 3 — Arabic and MENA foundation

| # | Task |
|---|---|
| 3.1 | Extend locale set to `en-AE`, `ar-AE`, `en-SA`, `ar-SA` with fallbacks `ar-*→ar`, `en-*→en`; update `i18n.json` |
| 3.2 | Language switcher hardening — build on existing `language.component.tsx` + `change.dir.tsx` |
| 3.3 | `dir="rtl"` at the document root driven by locale, not a toggle; logical CSS properties (`margin-inline-start` etc.) replacing `ml-/mr-` in shared UI |
| 3.4 | **RTL audit checklist** — buttons, tables, menus, **calendar**, modals, toasts, date pickers, drag-and-drop in `launches`. Manual screenshot review per component. |
| 3.5 | Arabic typography: font stack (IBM Plex Sans Arabic / Noto Kufi Arabic, self-hosted), line-height, letter-spacing reset, numeral form (Western vs Eastern Arabic) as a user preference |
| 3.6 | Default timezone `Asia/Dubai`; per-org timezone setting; dayjs locale + tz plugins |
| 3.7 | Locale-aware date/time formatting via `Intl.DateTimeFormat` |
| 3.8 | AED / SAR formatting via `Intl.NumberFormat`; `pricing.ts` gains a currency dimension |
| 3.9 | **Native Arabic review** of existing machine-translated `ar/translation.json` (1 400+ keys). Not machine-regenerated. |
| 3.10 | Translatable system/error messages — audit backend for untranslated user-facing strings |
| 3.11 | Bilingual onboarding content |
| 3.12 | Campaign templates: Ramadan, Eid al-Fitr, Eid al-Adha, UAE National Day (2 Dec), Saudi National Day (23 Sep), Saudi Founding Day (22 Feb) — seeded, bilingual |
| 3.13 | Hijri-aware date helper for Ramadan/Eid scheduling (`Intl` islamic calendar) |
| 3.14 | MENA sample content per vertical: restaurants, agencies, salons, clinics, small business |

**Exit:** full UI walkthrough in `ar-AE` with zero layout breakage; screenshots archived.

---

## Phase 4 — MVP customer experience

Most of this is configuration + gating. Two items are real development.

### 4.1 Available with no code (verify only)
Registration, login, org creation, brands via `Customer`, team invites,
OAuth social connection, calendar, drafts, scheduling, image upload,
basic analytics, usage limits, subscription architecture.

### 4.2 New development — RBAC
`Role` (SUPERADMIN/ADMIN/USER) exists but is unenforced; only subscription-tier gating exists.

- Add `nashr/permissions/role.matrix.ts`: role × resource × action.
- Extend `permissions.guard.ts` to evaluate role **in addition to** tier (never replacing it).
- Proposed roles: `OWNER`, `ADMIN`, `EDITOR`, `APPROVER`, `CLIENT`, `VIEWER`
  mapped onto the existing enum plus a new `UserOrganization.nashrRole` column
  (additive — upstream `Role` untouched).
- Every new endpoint gets an explicit policy; default deny.

### 4.3 New development — Approval workflow
`Draft → Internal review → Client approval → Schedule → Publish`

- Upstream `State` = `QUEUE | PUBLISHED | ERROR | DRAFT`. **Do not modify the enum**
  (breaks upstream merges and Temporal workflow versioning).
- Instead: new `PostApproval` model — `postId`, `stage`, `actorId`, `decision`,
  `note`, `createdAt`. A post stays `DRAFT` until it reaches `APPROVED`, then moves to `QUEUE`.
- Stages: `INTERNAL_REVIEW → CLIENT_APPROVAL → APPROVED | CHANGES_REQUESTED | REJECTED`.
- Reuse `Comments` for review notes; reuse `Notifications` + email for handoffs.
- **Publishing is blocked unless a post has an `APPROVED` record.** Enforced in the
  Temporal `post.activity`, not only in the UI.
- Autonomous publishing stays **off by default** (org-level opt-in flag).

### 4.4 AI features
- Caption generation: existing `openai.service.ts`, extended with brand-profile context.
- **Arabic↔English adaptation** — new: cultural adaptation prompt, not literal translation.
- **Platform-specific variations** — new: per-provider length/tone/hashtag constraints.

### 4.5 Onboarding
Extend `onboarding.modal.tsx`: vertical selection → brand profile → connect a channel →
first post from a MENA template. Bilingual.

---

## Phase 5 — MENA content agents

Built on the **existing Mastra runtime** (`libraries/nestjs-libraries/src/chat/mastra.service.ts`,
8 `mastra_*` tables, CopilotKit UI) — not a new framework.

### Architecture
```
apps/frontend/components/agents  (CopilotKit UI)
        │
apps/backend/copilot.controller  (existing bridge)
        │
libraries/nashr-agents/
  ├─ registry.ts        agent definitions + capability declarations
  ├─ guardrails.ts      approval gate, redaction, retry/timeout
  ├─ audit.ts           AgentActionLog persistence
  └─ agents/
     ├─ brand-profile.agent.ts
     ├─ content.agent.ts
     ├─ localization.agent.ts
     ├─ campaign-calendar.agent.ts
     ├─ approval.agent.ts
     └─ analytics-summary.agent.ts
```

### Mandatory guardrails (enforced in `guardrails.ts`, not per-agent)
| Requirement | Mechanism |
|---|---|
| Show proposed action before sensitive execution | Every tool marked `sensitive: true` returns a **proposal object**; execution requires a signed user confirmation token |
| Approval before publish / delete / message / campaign change | Those tools are `sensitive` by definition; no exceptions |
| Action logging | New `AgentActionLog` model: agent, orgId, userId, tool, args-hash, decision, outcome, duration |
| Safe error handling | Typed failures; no stack traces or provider errors surfaced to the model |
| No unnecessary secret/PII exposure | Redaction layer strips tokens, emails, phone numbers before prompt assembly; brand profile passes only declared fields |
| Structured tool calls only | Zod-typed tools. **No shell access, no arbitrary HTTP.** |
| Retry limits and timeouts | Max 2 retries, exponential backoff, 30 s per tool call, 120 s per agent turn, hard token ceiling |

### Agents
1. **Brand Profile Agent** — stores tone, industry, location, audience, products, offers,
   **prohibited claims** (critical for UAE/KSA advertising and health-claim rules). New
   `BrandProfile` model keyed to `Customer`.
2. **Content Agent** — bilingual captions, hooks, hashtags, content ideas.
3. **Localization Agent** — UAE vs Saudi adaptation; culturally natural over literal.
4. **Campaign Calendar Agent** — weekly/monthly calendars; Hijri-aware; proposes, never schedules directly.
5. **Approval Agent** — routes drafts through Phase 4.3 stages, records decisions. Cannot approve on a human's behalf.
6. **Analytics Summary Agent** — weekly summaries from the 13 analytics-capable providers only; states coverage gaps rather than inventing numbers.

---

## Phase 6 — Production deployment

| # | Task |
|---|---|
| 6.1 | `docker-compose.prod.yaml` + `docker-compose.staging.yaml`; **self-built image** (not `ghcr.io/gitroomhq/postiz-app`) |
| 6.2 | Services: app, postgres 17, redis 7.2, temporal (+ its postgres/elasticsearch), reverse proxy |
| 6.3 | Caddy or nginx + Let's Encrypt for automatic HTTPS |
| 6.4 | Persistent volumes: uploads, postgres, redis, config |
| 6.5 | Cloudflare R2 via `STORAGE_PROVIDER=cloudflare` (already supported) |
| 6.6 | **Baseline Prisma migrations** — replace `db push --accept-data-loss` with `migrate deploy` (RISK-01) |
| 6.7 | Automated `pg_dump` backups → R2, retention policy, **restore drill** |
| 6.8 | Health checks on every service; app readiness/liveness endpoints |
| 6.9 | Log rotation (`json-file` max-size/max-file) + structured logging |
| 6.10 | Sentry error monitoring via `SENTRY_*` |
| 6.11 | Secret handling: Docker secrets or env-file outside git; `JWT_SECRET` generated, never a placeholder |
| 6.12 | Docs: `.env.example`, `DEPLOYMENT.md`, `BACKUP_AND_RECOVERY.md`, `SECURITY_CHECKLIST.md`, `OPERATIONS_RUNBOOK.md` |

---

## Phase 7 — Testing

**Starting from zero tests.** Jest is configured but unused.

| Layer | Tool | Coverage |
|---|---|---|
| Unit | Jest | brand config, RBAC matrix, approval state machine, agent guardrails, redaction, currency/date formatting, Hijri helper |
| Integration | Jest + testcontainers Postgres | registration, login/logout, workspace isolation, role permissions, draft creation, approval transitions, rate limits, **cross-tenant data leakage**, **unauthorized access** |
| E2E | Playwright | English + **Arabic RTL** flows, OAuth callback, social connection, file upload, scheduled publishing |
| Ops | Scripted | migration up/down, **backup restoration drill** |
| Manual | Checklist | one **real publishing flow per enabled platform** before launch; RTL visual review |

Cross-tenant leakage gets a dedicated adversarial suite: for every org-scoped endpoint,
assert org B cannot read/write org A's data.

---

## Phase 8 — Launch readiness

Feature list; known limitations (**Snapchat absent**, machine-translated Arabic pending
review, no WhatsApp/CRM); security findings + remediation status; open-source compliance
checklist (AGPL §13 source offer, attribution, `/licenses` page, dependency inventory);
deployment instructions; customer onboarding guide (en + ar); admin guide; AED/SAR pricing
recommendations; backup verification evidence; test results; **screenshots of English and
Arabic interfaces**; beta checklist for **5–10 businesses**.

---

## Sequencing

```
Phase 2 ──┐
          ├─→ Phase 4 ──→ Phase 5 ──┐
Phase 3 ──┘                          ├─→ Phase 7 ──→ Phase 8
          Phase 6 ──────────────────┘
```
Phases 2 and 3 are largely parallel. Phase 6 can start once Phase 2 fixes image naming.
Phase 7 begins as soon as Phase 4 lands and runs continuously.

**Ordering note:** RISK-01 (migrations baseline) should be done **before** Phase 4 adds
new models, so `PostApproval`, `BrandProfile`, and `AgentActionLog` arrive as proper migrations.

---

## Open decisions needed from you

| # | Decision | Blocks |
|---|---|---|
| ~~D1~~ | ~~Repository creation blocked~~ — **RESOLVED.** `khanjer496-alt/Nashr` created by the owner; this repository is now the fork. | — |
| ~~D2~~ | ~~Confirm brand name~~ — **RESOLVED.** Brand is **Nashr / نشر** (Arabic: "publishing"). Arabic wordmark still to be designed in 2.2. | 2.2 |
| D3 | Which social platforms for MVP? (Snapchat is **not** available upstream) | 4.1, 7 |
| D4 | Legal entity name + jurisdiction for Terms/Privacy | 2.11 |
| D5 | Native Arabic reviewer for 1 400+ keys — who? | 3.9 |
| D6 | AED/SAR price points per tier | 8 |
| D7 | AGPL §13 source-offer route: public mirror, or download link in-app? | 8 |
