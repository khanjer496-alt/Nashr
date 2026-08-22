# FEATURES.md — Nashr (نشر)

**Phase 8 deliverable.** What Nashr does today, and — with equal prominence —
what it does not. Compiled 2026-08-08 against
`claude/mena-saas-postiz-conversion-7el9fk`.

Base: [Postiz](https://github.com/gitroomhq/postiz-app) v1.47.0 (AGPL-3.0).
See [`FORK_CUSTOMIZATIONS.md`](FORK_CUSTOMIZATIONS.md) for the full change log
and [`OPEN_SOURCE_COMPLIANCE.md`](OPEN_SOURCE_COMPLIANCE.md) for licensing.

> **Status of every claim below.** Features marked ✅ exist in the source and
> compile. **Nothing in this document has been observed running in production,
> because Nashr has never been deployed** and no post has ever been published to
> a real social platform from this build. Read
> [`LAUNCH_READINESS.md`](LAUNCH_READINESS.md) before showing this to a
> customer.

---

## 1. Channels — which platforms Nashr can publish to

**34 social providers are registered and available.**

```bash
sed -n '41,77p' libraries/nestjs-libraries/src/integrations/integration.manager.ts \
  | grep -c '^  new .*Provider()'          # -> 34
```

Every one uses the platform's **official OAuth / public API**. There is no
scraping, no headless browser, and no password storage for any social account —
verified across all provider files during the Phase 1 audit
(`AUDIT_REPORT.md` §5).

### 1.1 The MENA-relevant subset (what a UAE business actually wants)

| Platform | Provider | Analytics | Notes for the beta |
|---|---|---|---|
| Instagram (Business/Creator) | `instagram`, `instagram.standalone` | ✅ | Requires a Business or Creator account linked to a Facebook Page. Personal accounts cannot be published to. Meta App Review required. |
| Facebook Pages | `facebook` | ✅ | Same Meta app as Instagram. App Review required. |
| TikTok | `tiktok` | ✅ | Audit review required; until it passes, posts land as **private drafts** in the customer's account. |
| X (Twitter) | `x` | ✅ | **A paid X API tier is required to post.** The free tier cannot publish. |
| LinkedIn (personal + company page) | `linkedin`, `linkedin.page` | Page only | Fastest approval of the major platforms. |
| YouTube | `youtube` | ✅ | Google verification needed for the upload scope; unverified apps are capped at 100 users. |
| Threads | `threads` | ✅ | A separate Meta app from Instagram. |
| Google Business Profile | `gmb` | ✅ | High value for restaurants, salons and clinics. Quota access is **not granted by default** and can take weeks. |
| Pinterest | `pinterest` | ✅ | Relevant for salons and food. |
| Telegram | `telegram` | — | Common in the region for broadcast channels. |
| **Snapchat** | **none** | — | **NOT SUPPORTED. See §5.1.** |

### 1.2 The full registered list

`x`, `linkedin`, `linkedin.page`, `reddit`, `instagram`,
`instagram.standalone`, `facebook`, `threads`, `youtube`, `gmb`, `tiktok`,
`pinterest`, `dribbble`, `discord`, `slack`, `kick`, `twitch`, `mastodon`,
`bluesky`, `lemmy`, `farcaster`, `telegram`, `nostr`, `vk`, `medium`, `dev.to`,
`hashnode`, `wordpress`, `listmonk`, `moltbook`, `whop`, `skool`, `mewe`,
`tumblr`.

**11 of them report analytics back into the product:**

```bash
grep -ln "^\s*\(async \)\?analytics\s*(" \
  libraries/nestjs-libraries/src/integrations/social/*.provider.ts | wc -l   # -> 11
# dribbble facebook gmb instagram instagram.standalone linkedin.page
# pinterest threads tiktok x youtube
```

The other 23 can publish but return no metrics. The Analytics Summary agent is
built to **state that coverage gap rather than invent numbers** — but a customer
on Telegram and LinkedIn-personal will see an empty analytics view and needs to
be told why up front.

> **Correction to earlier documents.** `AUDIT_REPORT.md` §5 says "36 providers"
> and §18 says analytics for 13. Both figures were counted from directory
> listings. Counting actual registrations and actual method implementations
> gives **34** and **11**. The directory holds 37 entries: 35 `*.provider.ts`
> files, plus `social.integrations.interface.ts` and `hashnode.tags.ts` (not a
> provider); of the 35, `MastodonCustomProvider` is **commented out upstream**
> at `integration.manager.ts:76`. The substantive audit claim — all official
> OAuth/API, no scraping — is unchanged. Recorded here in the same spirit as
> `AUDIT_REPORT.md` §21.

---

## 2. Core product (inherited from Postiz, verified present)

| Capability | Where | State |
|---|---|---|
| Registration, login, email activation, password reset | `apps/backend/src/services/auth/` | ✅ |
| Organizations / workspaces, team invitations | `Organization`, `UserOrganization`, `settings.controller.ts` | ✅ |
| Multiple client brands inside one workspace | `Customer` model — the agency use case | ✅ |
| Content calendar: week / month / day / list views | `apps/frontend/.../launches` | ✅ |
| Drafts, scheduling, queueing, publish | `Post.state` = `DRAFT / QUEUE / PUBLISHED / ERROR` | ✅ |
| Durable publishing with automatic retry and backoff | Temporal workflows `post.workflow.v1.0.1`–`v1.0.6` | ✅ |
| Automatic OAuth token refresh | `refresh.token` workflow | ✅ |
| Media upload, local disk or Cloudflare R2 | `upload.factory.ts`, `STORAGE_PROVIDER` | ✅ (R2 is config-only) |
| Analytics dashboard | `analytics` route, 11 providers | ✅ partial |
| In-app + email notifications, digest emails | `Notifications`, Temporal `digest.email` | ✅ |
| Public REST API v1 + API keys | `public-api/routes/v1/` | ✅ |
| Outbound webhooks with SSRF protection | `ssrf.safe.dispatcher.ts` | ✅ |
| Stripe billing with usage limits (HTTP 402 on breach) | `stripe.service.ts`, `permissions.service.ts` | ✅ but see §5.6 |
| 20 UI locales | `translation/locales/` (`ls | wc -l` → 20) | ✅ quality varies — §5.2 |

---

## 3. What Nashr adds on top of Postiz

### 3.1 Approval workflow — the feature agencies actually buy

`Draft → Internal review → Client approval → Schedule → Publish`

```
NashrApprovalStage:    DRAFT → INTERNAL_REVIEW → CLIENT_APPROVAL → APPROVED
                                              ↘ CHANGES_REQUESTED  ↘ REJECTED
NashrApprovalDecision: SUBMITTED | APPROVED | CHANGES_REQUESTED | REJECTED | WITHDRAWN
```
(`schema.prisma:1003–1018`)

The part that matters: **enforcement is not in the UI.** The gate lives in the
Temporal publish activity, in `postSocialInternal`
(`apps/orchestrator/src/activities/post.activity.ts:28,84,257`) — the single
chokepoint every creation path traverses, including `WEB`, `API`, `MCP`,
`AUTOPOST` and `CLI`. A post without an `APPROVED` record does not publish,
whichever door it came in through. UI-only enforcement would have been
bypassable via the public API (RISK-P4).

Defaults, set in the schema and not merely documented:

```
NashrBrandProfile.autonomousPublishing   Boolean @default(false)   # schema.prisma:1060
NashrBrandProfile.clientApprovalRequired Boolean @default(true)    # schema.prisma:1062
```

**Autonomous publishing is off by default.** A typo in the kill switch fails
closed.

### 3.2 Role-based permissions

Six roles — `OWNER`, `ADMIN`, `EDITOR`, `APPROVER`, `CLIENT`, `VIEWER`
(`schema.prisma:993`) — evaluated by `libraries/nashr-permissions` as a
default-deny matrix over resources and actions. Role checks run **in addition
to** upstream's subscription-tier checks, never replacing them, so endpoints
without role metadata behave exactly as before (`FORK_CUSTOMIZATIONS.md`).

`CLIENT` members are scoped to a single brand through
`UserOrganization.nashrCustomerId` — without that link the CLIENT_APPROVAL
stage would have been a required step nobody could complete.

### 3.3 Arabic, RTL and MENA localisation

- **20 locale directories**, including four Nashr regional overlays —
  `ar-AE`, `ar-SA`, `en-AE`, `en-SA` — carrying 9–10 market-specific keys each
  (currency wording, national day, weekend days, working week) and falling back
  `ar-AE → ar → en`.
- `<html lang dir>` emitted **server-side** from the resolved locale, so an
  Arabic session no longer first-paints left-to-right and snaps.
- Arabic typography: self-hosted IBM Plex Sans Arabic / Noto Kufi Arabic stack,
  `letter-spacing: normal !important` (positive tracking severs Arabic letter
  joins), `line-height: 1.7`, `text-transform: none`.
- Eight MENA markets modelled (`AE, SA, KW, QA, BH, OM, EG, JO`) with per-market
  currency, timezone, first day of week.
- Hijri-aware date helpers, pinned in tests against real observed Ramadan/Eid
  dates.
- **Five RTL bugs found and fixed** in Phase 3 — full component-by-component
  record in [`libraries/nashr-i18n/RTL_CHECKLIST.md`](libraries/nashr-i18n/RTL_CHECKLIST.md).

### 3.4 MENA content library

`libraries/nashr-content`:

- **6 bilingual campaign templates** — Ramadan, Eid al-Fitr, Eid al-Adha,
  UAE National Day, Saudi National Day, Saudi Founding Day. Anchored to
  **Hijri offsets, not fixed Gregorian dates**, so they do not misfire as the
  lunar calendar shifts.
- **5 vertical profiles** with sample content ideas — `restaurants`,
  `agencies`, `salons`, `clinics`, `small_business`.

Saudi National Day edition numbers are Hijri-counted; `editionNumber()` returns
`null` outside a verified lookup table rather than printing a wrong number.

### 3.5 Six MENA AI agents

`libraries/nashr-agents`, built on the Mastra runtime Postiz already ships.

| Agent | Purpose |
|---|---|
| `nashrBrandProfile` | Tone, industry, market, audience, products, offers, **prohibited claims** |
| `nashrContent` | Bilingual captions, hooks, hashtags, content ideas |
| `nashrLocalization` | ar↔en adaptation for a specific market — cultural by default, literal only on request |
| `nashrCampaignCalendar` | Weekly/monthly plans, Hijri-aware — **proposes, never schedules** |
| `nashrApproval` | Routes drafts through review, records decisions people made — **never approves on a human's behalf** |
| `nashrAnalyticsSummary` | Weekly summaries from channels that actually report analytics; states coverage gaps |

Guardrails are central and cannot be opted out of:

- **The model only ever receives an opaque `proposalId`.** The confirmation HMAC
  is minted solely by the authenticated approve endpoint, so **a model cannot
  approve its own action**. Confirmations are single-use and bound to exact
  arguments — changing one argument after approval invalidates it.
- Registration-time validation rejects any `write|publish|delete|message|schedule|campaign`
  tool not marked sensitive. A mistake is a boot failure, not an incident.
- No shell, no `exec`, no arbitrary HTTP, no raw SQL. Zod-typed tools only.
- Redaction runs before prompt assembly, before logging and before user-facing
  errors — API keys, JWTs, PEM keys, connection strings, emails, Gulf phone
  numbers, IBANs, card-length digit runs.
- Prohibited claims are injected into every system prompt and re-checked
  deterministically on output. Relevant to UAE/KSA advertising rules and, for
  clinics, health-claim rules.
- Budgets: 30 s per tool, 120 s per turn, ≤2 retries, **0 retries on sensitive
  writes**, 12 tool calls and 24 000 tokens per turn.
- Every action written to `NashrAgentActionLog`.

Full detail: [`libraries/nashr-agents/README.md`](libraries/nashr-agents/README.md).

### 3.6 Production operations

Self-built Docker image (never the upstream branded one), Caddy with automatic
HTTPS, eight-container compose stack, digest-pinned images, a preflight guard
that refuses to deploy on a placeholder secret, **a real Prisma migration
history** replacing upstream's `db push --accept-data-loss`, nightly encrypted
backups with an automated restore drill, systemd timers, log rotation.

See [`DEPLOYMENT.md`](DEPLOYMENT.md), [`BACKUP_AND_RECOVERY.md`](BACKUP_AND_RECOVERY.md),
[`OPERATIONS_RUNBOOK.md`](OPERATIONS_RUNBOOK.md).

---

## 4. Deliberately hidden, not deleted

The brief excludes marketplace and enterprise complexity from the MVP. These
are **feature-flagged off in the UI while the code and schema stay intact**,
because deleting them would create permanent merge conflicts against upstream
(RISK-03):

`SocialMediaAgency`, `Orders`, `OrderItems`, `Messages`, `MessagesGroup`,
`PayoutProblems`, `Star`, `Trending`, `TrendingLog`, `ItemUser`, `PopularPosts`,
`plugs`, `autopost` (RSS), `third-party`, OAuth-provider mode,
`enterprise.controller`, `apps/extension`, `apps/sdk`.

Also off by default: `NEXT_PUBLIC_SHOW_TESTIMONIALS` — upstream's testimonials
and "Join 10,000+ Entrepreneurs" copy. Those quotes were given to Postiz;
showing them under Nashr would misrepresent them.

---

## 5. Known limitations

**This section is the honest half of the document. Every beta customer must be
shown §5.1 and §5.2 in writing before they sign up.**

### 5.1 🔴 Snapchat is not supported — the single biggest product gap

There is **no Snapchat provider**, upstream or in Nashr:

```bash
grep -ril snapchat apps/*/src libraries/*/src | wc -l    # -> 0
```

Snapchat has very high penetration in Saudi Arabia and the UAE and is a primary
channel for **exactly** the verticals Nashr targets — restaurants, salons,
clinics. A customer whose Snapchat presence matters will find Nashr incomplete,
and may reasonably consider it unusable.

**This must be disclosed to every beta customer before they sign up, in
writing, not buried in a feature table.** Building it is a genuine new provider
integration (Snapchat Marketing API, app review, media constraints) and is
post-MVP. Beta exists partly to measure how much this actually costs us
(RISK-P1).

### 5.2 🔴 Arabic is machine-translated and unreviewed

`ar/translation.json` holds **761 keys**:

```bash
python3 -c "import json;print(len(json.load(open(
  'libraries/react-shared-libraries/src/translation/locales/ar/translation.json'))))"   # -> 761
```

Of these, ~700 were generated by lingo.dev + `gpt-4.1` upstream and **have not
been read by a native speaker**. Phase 3 hand-corrected only the 14 strings
containing the brand name and added 22 hand-written `backend_error_*` strings.

The MENA content library (`nashr-content`) Arabic *is* hand-written — but
Ramadan, Eid and national-day copy is exactly the material where a subtle
register mistake is most costly, so it still needs a native Gulf marketer to
read it.

Poor Arabic destroys credibility with precisely the customers Nashr targets.
**Native review is a launch gate, not a nice-to-have** (RISK-P2).

Related open brand question: «نشر» is also the ordinary Arabic noun for
*publishing*, so a bare mid-sentence occurrence is genuinely ambiguous. The
current convention is Arabic guillemets. **The brand owner has not ratified
this.**

### 5.3 🟠 RTL visual verification

Phase 3 rebuilt RTL and fixed five real bugs, and the RTL CSS is provably in the
compiled bundle. But `RTL_CHECKLIST.md` is explicit: **every row in it is static
source inspection**, not a claim about observed visual behaviour. Visual
verification is owned by a separate workstream and its results are not restated
here.

Unaudited by anyone: the **Uppy** media uploader (ships its own `[dir=rtl]`
stylesheet) and **Polotno** (~16k lines of vendored design editor with its own
`.bp5-rtl` rules).

<!-- LEAD: insert verified RTL screenshot references from RTL_VERIFICATION.md -->

### 5.4 🟠 The backend speaks only English

There is **no i18n layer in the backend at all** — no request-scoped locale, no
interceptor, nothing reads the `i18next` cookie or the
`x-i18next-current-language` header. **184 user-reachable English literals** are
inventoried in
[`libraries/nashr-i18n/UNTRANSLATED_BACKEND_STRINGS.md`](libraries/nashr-i18n/UNTRANSLATED_BACKEND_STRINGS.md)
(149 exception messages, 32 validator messages, 3 JSON bodies).

Practical effect: **an Arabic-speaking customer gets an Arabic interface that
switches to English the moment anything goes wrong** — a failed publish, an
expired channel, a rejected upload. Translating the top ~15 distinct messages
covers a disproportionate share of what a user actually sees.

### 5.5 🟠 The proposal store is in-memory — single replica only

`ProposalStorePort` in `libraries/nashr-agents` is in-memory. It is correct for
one backend process. **A multi-replica deployment needs a Redis-backed
implementation**, or a proposal created on replica A cannot be approved on
replica B and the agent approval flow breaks intermittently.

`redis` and `ioredis` are already dependencies, so this is a bounded piece of
work — but until it is done, **do not run more than one backend replica.**

### 5.6 🟠 Pricing is still Postiz's, in USD

`libraries/nestjs-libraries/src/database/prisma/subscriptions/pricing.ts` still
carries upstream's `FREE / STANDARD $29 / TEAM $39 / PRO $49 / ULTIMATE $99`
tiers. Currency formatting helpers for AED/SAR exist in `nashr-i18n`, but the
tier values, names and currency have not been changed. See
[`PRICING_RECOMMENDATIONS.md`](PRICING_RECOMMENDATIONS.md). **No price has been
agreed by the owner.**

### 5.7 🟡 Calendars start on the wrong day outside the UAE

`launches/filters.tsx` uses `startOf('isoWeek')` — Monday. Correct for the UAE
(Sat–Sun weekend). **Wrong for KSA, Kuwait, Qatar, Bahrain, Oman, Egypt and
Jordan**, where the working week is Sun–Thu. `MARKETS[*].firstDayOfWeek` carries
the right value per market, but wiring the calendar to it changes scheduling
semantics and was deliberately left for a follow-up.

Consequence for the beta: **start with UAE customers.** Saudi expansion should
wait for this fix.

### 5.8 🟡 No row-level security — isolation is application-enforced

Tenant separation depends on every query filtering `organizationId`. There is no
Postgres RLS. In an agency product where one customer competes with another,
one missing `where` clause is existential (RISK-02). The agents library enforces
scope from the authenticated request and rejects any `organizationId` appearing
in tool arguments — but the rest of the application relies on upstream
discipline.

<!-- LEAD: insert verified tenant-isolation test results from TEST_PLAN.md -->

### 5.9 🟡 OAuth token encryption at rest is unverified

`Integration` stores access and refresh tokens for every connected account.
Whether they are encrypted at rest was never confirmed (RISK-05). Full-disk
encryption on the data volume is the compensating control and is **required**,
not optional (`SECURITY_CHECKLIST.md` §3). A database dump would otherwise
yield live credentials for every customer's social accounts.

### 5.10 🟡 Smaller gaps worth knowing

- **No Hijri calendar view.** Hijri *helpers* exist; the calendar UI is
  Gregorian.
- **No prayer-time awareness** in optimal-time scheduling.
- **Analytics gaps.** 23 of 34 channels report nothing (§1.2).
- **`API_LIMIT` is a single global number**, not per-org. One noisy customer can
  consume the budget (RISK-S6).
- **Rollback across a migration is restore-only.** `migrate deploy` rolls
  forward and never backward.
- **Temporal state is not backed up by design.** Posts scheduled but not yet
  published may need re-queueing after a Temporal data loss.
- **Doc/code drift:** `.env.example:264` says the agent model default is
  `gpt-5.2`; the code says `gpt-4.1`
  (`libraries/nashr-agents/src/nashr-agents.service.ts:58`). Harmless but fix
  it before an operator trusts the comment.
- **Two upstream bugs found, not fixed** (tracked in `FORK_CUSTOMIZATIONS.md`):
  `mastodon.custom.provider.ts:52` passes 5 args to a 4-arg function; the root
  `jest.config.ts` is broken upstream for every project.

---

## 6. Explicitly out of scope for the MVP

Per the brief, and **not to be built until customer feedback confirms demand**:

WhatsApp Business integration · CRM · payment automation · mobile apps ·
enterprise infrastructure · the browser extension · the published SDK ·
the Postiz marketplace · fully autonomous publishing.

`BETA_CHECKLIST.md` §7 records how demand for each will be measured.
