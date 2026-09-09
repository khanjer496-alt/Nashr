# LAUNCH_READINESS.md — Nashr (نشر)

> **PostDelegate update — 9 September 2026:** [current launch execution and blockers](docs/launch/README.md)
> and [platform application pack](docs/launch/platform-access.md) supersede old product-name,
> regional-only and platform-access assumptions below. Historical verification remains evidence only for the build and date it names.

> **Global-first pivot — 2026-08-22.** The approved direction is documented in
> [`docs/superpowers/specs/2026-08-22-global-first-postiz-direction-design.md`](docs/superpowers/specs/2026-08-22-global-first-postiz-direction-design.md).
> Earlier regional verification remains useful engineering evidence, but it is
> not approval to launch under the new global scope. Production now requires
> the approved Docker origin plus Cloudflare edge and R2 topology, global
> onboarding/pricing, and end-to-end validation of the public deployment.

**Phase 8 master document.** Compiled 2026-08-08 against
`claude/mena-saas-postiz-conversion-7el9fk`.
Base: [Postiz](https://github.com/gitroomhq/postiz-app) v1.47.0, AGPL-3.0.

> **Verification update — 2026-08-09 (`codex/finish-project`).** This document
> preserves the original Phase 8 launch assessment, but several repository-side
> gaps described below are now closed. The complete frontend, backend and
> orchestrator production build succeeds on Node 22. The automated baseline is
> **503 passing tests** (286 unit + 217 integration), backed by PostgreSQL 16 and
> Redis 7. All three migrations apply from an empty database, re-apply
> idempotently, and produce zero Prisma drift. The portable disaster-recovery
> drill now proves plain and encrypted backup/restore, matching data
> fingerprints, rejection of a wrong passphrase, corrupt archives and tampered
> checksums, and a zero exit status after restore. CI runs this entire baseline.
> The 16 customer-facing locale source links were also removed and are pinned by
> regression tests; IBM Plex Sans Arabic is shipped through `next/font`; legal
> pages explicitly retain LTR direction until translated. Historical statements
> below saying these items are still open are superseded by this update.
>
> The launch verdict remains **not ready for external customers** because the
> remaining blockers require external evidence or owner decisions: a live
> domain/TLS deployment, a Nashr Corresponding Source mirror and final source
> URL, real social OAuth apps and publish tests, R2 credentials plus a restore
> from the live backup path, native-Arabic review, and legal/commercial details.

---

# VERDICT: 🔴 NOT READY TO LAUNCH

**Nashr is not ready for its first customer, and the gap is not small.**

The software is substantially built. Almost everything a launch-readiness
document is supposed to certify has **never been observed to happen**:

| | |
|---|---|
| ❌ | **Nashr has never been deployed.** No Docker image has been built, no stack has ever started, `caddy validate` has never run. There is no Docker daemon in the environment this was built in. |
| ❌ | **No post has ever been published to a real social platform** from this build — not one, on any of the 34 providers. |
| ❌ | **No social platform developer application has been registered or approved.** Meta and TikTok reviews take 1–3 weeks and have not been started. |
| ❌ | **The AGPL-3.0 source mirror has not been published.** Offering the software over a network without it is a licence violation, not a to-do. |
| ❌ | **A second source-offer defect was found during this phase** and is still open: all 16 locale files carry a hardcoded link to upstream Postiz in customer-facing FAQ copy. |
| ❌ | **Backup restore has never been run against production data.** The scripts are written and the drill is automated; neither has met a real database. |
| ❌ | **Roughly 700 Arabic strings have never been read by a native speaker.** |
| ⚠️ | **The Arabic UI had never been rendered as of the Phase 3 RTL audit** — that document is explicit that every row in it is static source inspection. A screenshot/verification workstream is running concurrently; its evidence is the thing that closes this. <!-- LEAD: confirm against RTL_VERIFICATION.md --> |
| ❌ | **No legal entity, jurisdiction, price or support commitment has been decided.** |
| ⚠️ | **Snapchat does not exist in the product** and is the primary channel for the target verticals in the target markets. |

A launch-readiness document that concluded "ready" with those open would be
worthless. This one exists to prevent a premature launch, so it says the
unwelcome thing plainly.

**None of this means the work is behind.** Phases 1–7 delivered a genuinely
substantial, defensible product. It means the remaining work is the kind that
cannot be done in a container without a network, a domain, a credit card and a
native Arabic speaker — and that work has not started.

---

## 1. What "ready" means here

Ready is not "the code compiles". For a product that will publish on a
customer's behalf to their live social accounts, ready means:

1. It runs, somewhere real, and someone has watched it run.
2. A post it publishes actually appears on the platform.
3. A post nobody approved **cannot** appear on the platform.
4. One customer cannot see another customer's data.
5. If the disk dies, the data comes back — proven, not scripted.
6. Using it does not break the law (AGPL §13, advertising rules, VAT).
7. The Arabic does not embarrass the customer in front of their customers.
8. Everything it cannot do has been said out loud, in writing, first.

Items 3 and 4 are the ones a beta customer is silently trusting you with. Item
6 is the one that does not care whether you were busy.

---

## 2. Scorecard

| Area | State | Evidence |
|---|---|---|
| **Architecture and code** | 🟢 Built | Backend, frontend and orchestrator all build clean (`FORK_CUSTOMIZATIONS.md`) |
| **Rebrand** | 🟡 One defect left | `libraries/nashr-brand` is the single source; 234 "Postiz" occurrences in locale **values** reduced to **16** — one per base locale, all the same FAQ string (§4.2) |
| **Approval workflow** | 🟢 Built, untested live | Gate in `postSocialInternal` — the chokepoint every `CreationMethod` traverses |
| **RBAC** | 🟢 Built | 6 roles, default-deny, additive to tier gating |
| **AI agents + guardrails** | 🟢 Built | Model receives only an opaque `proposalId`; HMAC minted solely by the authenticated approve endpoint |
| **Migrations** | 🟢 Solved | 3 migrations replacing upstream's `db push --accept-data-loss` |
| **Production tooling** | 🟢 Written | Compose, Caddy, preflight, backups, systemd, logrotate |
| **Arabic / RTL code** | 🟡 Built; visual verification in progress | 5 real bugs fixed; Phase 3 audit was static-only <!-- LEAD: confirm against RTL_VERIFICATION.md --> |
| **Arabic content quality** | 🔴 Not done | ~700 keys unreviewed |
| **Deployment** | 🔴 Never done | No image built, no stack started |
| **Real publishing** | 🔴 Never done | Zero posts, zero platforms |
| **Backup restore in production** | 🔴 Never done | Drill log empty |
| **AGPL §13 compliance** | 🔴 Not met | No mirror; plus the locale-file defect (§4.2) |
| **Snapchat** | 🔴 Absent | 0 matches in source |
| **Backend i18n** | 🔴 Absent | 184 English literals inventoried |
| **Pricing / legal entity** | 🔴 Undecided | Owner decisions |
| **Test coverage** | 🟡 <!-- LEAD: insert verified test totals from TEST_PLAN.md --> | Suites exist in 4 Nashr libraries; upstream had zero tests |

---

## 3. What was actually built — Phases 1–7

Summarised so the verdict above is read in proportion. Full record:
[`FORK_CUSTOMIZATIONS.md`](FORK_CUSTOMIZATIONS.md).

- **Phase 1 — Audit.** 484-line read-only audit of Postiz v1.47.0, a 251-line
  plan, a 28-entry risk register. The audit later **corrected itself** (§21) on
  three figures it had got wrong, including materially overstating existing RTL
  support. That habit is the reason this document can be trusted.
- **Phase 2 — Rebrand.** One brand module as the single source of truth; new
  `/about`, `/terms`, `/privacy`, `/licenses` pages; a real bug fixed where
  `nevo@postiz.com` was hardcoded as the agency notification recipient (our
  customers' notifications would have gone to the upstream author's inbox);
  and the discovery that `/licenses` was unreachable when signed out, which
  would have made the AGPL source offer non-compliant by construction.
- **Phase 3 — Arabic and MENA.** 4 regional locales, 8 markets, Hijri helpers,
  Arabic typography, 6 bilingual campaigns, 5 vertical profiles, and **five
  genuine RTL bugs** fixed — including `<html>` carrying neither `dir` nor
  `lang`, and `dayjs.locale('ar-AE')` silently no-opping so an Arabic calendar
  would have shown English month names.
- **Phase 4 — RBAC and approval.** The approval gate placed in the Temporal
  publish activity rather than the UI, because workflows `v1.0.1`–`v1.0.4` never
  call `getPost` and a gate elsewhere would have missed them — and because UI
  enforcement is bypassable through the public API.
- **Phase 5 — Six MENA agents.** Guardrails enforced once, centrally, with a
  registration-time rule that turns a mistake into a boot failure rather than an
  incident.
- **Phase 6 — Production deployment.** Eight-container stack, digest-pinned,
  with several upstream traps found and worked around — notably that
  `NOT_SECURED=false` **enables** the insecure path, and that
  `NEXT_PUBLIC_SOURCE_URL` is build-time so setting it at runtime silently
  leaves the licence obligation unmet.
- **Phase 7 — Testing.** Starting from **zero** tests upstream.
  <!-- LEAD: insert verified test totals from TEST_PLAN.md -->

---

## 4. The blocking list

Ranked by what stops a launch soonest. Every item traces to a document that
owns it.

### 4.1 🔴 Nothing has ever been deployed

No image built, no container started, no `caddy validate`, no ACME certificate,
no migration applied to a live database. `FORK_CUSTOMIZATIONS.md` states this
plainly: *"Not verified — no Docker daemon in this environment."*

Everything downstream — TLS, health checks, backups, publishing, RTL rendering —
is unverified because the thing they run on has never run.

**Owner:** `DEPLOYMENT.md` §4. **First action, blocks nearly everything else.**

### 4.2 🔴 AGPL §13 is not satisfied — two separate defects

**(a) No public source mirror exists.** `NEXT_PUBLIC_SOURCE_URL` defaults to
upstream Postiz — which is *not* the Corresponding Source for our build. And
because it is a `NEXT_PUBLIC_*` variable it is **baked in at build time**:
setting it in `.env.prod` and restarting changes nothing.

**(b) New finding, this phase.** All 16 base locale files carry a hardcoded
`https://github.com/gitroomhq/postiz-app` link inside the customer-facing FAQ
value `faq_postiz_gitroom_is_proudly_open_source`. The React default correctly
uses `brand.sourceUrl`, but i18next prefers the resource value when the key
exists — and it does. So the product's own "view the source code" link sends
customers to upstream, independently of any configuration.

That is both an unmet §13 obligation and a customer-facing use of the Postiz
name (RISK-L1, RISK-L2).

**Owner:** [`OPEN_SOURCE_COMPLIANCE.md`](OPEN_SOURCE_COMPLIANCE.md) §3.
**This must be fixed before the first customer logs in**, and publishing the
mirror is a commercial decision the owner has not yet made (§3.4 of that
document sets out what it means).

### 4.3 🔴 No real publish, on any platform, ever

Zero posts have been published from this build to any of the 34 providers. No
developer application has been registered. Meta and TikTok reviews take 1–3
weeks and have not been started, which makes this **the longest lead time
between here and a customer**.

Until a real publish succeeds, the central claim of the product — that it
publishes your posts — is untested.

**Owner:** [`BETA_CHECKLIST.md`](BETA_CHECKLIST.md) §3, which requires a real
publish, an image post, an Arabic post, a scheduled post, a handled failure and
a reconnect **per platform**, recorded in a table.

### 4.4 🔴 Backups are scripted but unproven

The backup script verifies its own archive with `pg_restore --list`, hard-links
weeklies and monthlies, encrypts, uploads off-host and prunes. The restore drill
is automated and non-destructive. **Neither has ever met a real database.** The
drill log in `BACKUP_AND_RECOVERY.md` §6.3 is empty.

The governing sentence in that document is right: *a backup that has never been
restored is not a backup.*

**Owner:** `BACKUP_AND_RECOVERY.md` §6. **Run it on day one of the deploy, not
next month.**

### 4.5 🔴 Arabic has not been reviewed by a human

761 keys in `ar/translation.json`; ~700 machine-generated by lingo.dev +
`gpt-4.1` and unread by any native speaker. Phase 3 hand-corrected 14 brand
strings and hand-wrote 22 error strings.

The brief forbids shipping unreviewed machine translation, and the commercial
logic is the same: poor Arabic destroys credibility with exactly the customers
Nashr targets.

Also open: «نشر» is the ordinary Arabic noun for *publishing*, so bare
mid-sentence use is ambiguous. The current guillemet convention **has not been
ratified by the brand owner**.

**Owner:** `RTL_CHECKLIST.md` → "What still needs a human"; `BETA_CHECKLIST.md`
§2.5. **Owner decision D5: who reviews.**

### 4.6 🟠 Visual verification of the Arabic UI

`RTL_CHECKLIST.md` is explicit that everything in it is **static source
inspection** — the RTL CSS provably compiles into the bundle, but as of Phase 3
whether it *looks* right was unknown. A screenshot and verification workstream
is running concurrently and owns the evidence; this document does not restate
its results.

Regardless of that workstream's outcome, two things remain unaudited by anyone:
**Uppy's own `[dir=rtl]` stylesheet** in the media uploader, and **Polotno**
(~16k lines of vendored design editor with its own `.bp5-rtl` rules).

<!-- LEAD: insert verified RTL screenshot references from RTL_VERIFICATION.md -->

### 4.7 🟠 Snapchat is absent

`grep -ril snapchat apps/*/src libraries/*/src` → **0**.

Very high penetration in KSA and the UAE; the primary channel for restaurants,
salons and clinics — the exact verticals targeted. A customer for whom Snapchat
matters will find Nashr incomplete.

This is **not** a launch blocker, because the mitigation is disclosure, not
code. It **is** a blocker on launching without disclosure. Every beta customer
must be told, in writing, before signing up (RISK-P1).

### 4.8 🟠 Tenant isolation is untested against a real database

Isolation depends on every query filtering `organizationId`. No row-level
security exists. RISK-02 is the highest-impact risk in the product: in an agency
tool where org A competes with org B, one missing `where` clause is existential.

<!-- LEAD: insert verified tenant-isolation test results from TEST_PLAN.md -->

### 4.9 🟠 Single-replica constraint

`ProposalStorePort` is in-memory. A proposal created on replica A cannot be
approved on replica B, so agent approvals break intermittently under more than
one backend process. **Do not scale out until this is Redis-backed.** For 5–10
customers on one box this is acceptable; it must be written down so nobody
"helpfully" adds a replica.

### 4.10 🟠 Nothing commercial has been decided

No legal entity, jurisdiction, VAT position, price, payment terms, support
hours or response-time commitment. `/terms` and `/privacy` render a placeholder
notice until `NEXT_PUBLIC_BRAND_LEGAL_NAME` and
`NEXT_PUBLIC_BRAND_JURISDICTION` are set. **These are owner decisions and none
of them has been made** — see `PRICING_RECOMMENDATIONS.md` §8.

---

## 5. Risk register at Phase 8

28 risks were recorded (`grep -cE "^### RISK-" RISK_REGISTER.md` → 28; note the
summary table in that file says 27 and undercounts High by one — worth
correcting there).

Movement during Phases 2–7:

| Risk | Was | Now | Why |
|---|---|---|---|
| RISK-01 migrations | 🔴 20 | 🟢 **Closed** | 3 migrations exist and verified applying cleanly to PostgreSQL 16 with zero drift |
| RISK-L5 Mastra licence | 🟡 6 | 🟢 **Effectively closed** | All `@mastra/*` declare **Apache-2.0**. Caveat in `OPEN_SOURCE_COMPLIANCE.md` §5.4 |
| RISK-D3 upstream image | 🟠 9 | 🟢 **Closed** | Self-built, digest-pinned |
| RISK-D4 no repository | 🟠 9 | 🟢 **Closed** | `khanjer496-alt/Nashr` exists |
| RISK-S1 placeholder JWT | 🔴 15 | 🟡 **Mitigated** | Preflight blocks it; unverified on a real deploy |
| RISK-P4 approval bypass | 🟡 8 | 🟡 **Mitigated by design** | Gate in the Temporal activity; per-`CreationMethod` proof outstanding |
| RISK-S3 agent abuse | 🟠 12 | 🟡 **Mitigated by design** | Central guardrails; model cannot approve its own action |
| RISK-P3 RTL breakage | 🟠 12 | 🟠 **Open** | Code fixed; Phase 3 audit static-only, visual verification owned by a concurrent workstream |
| RISK-L1 AGPL §13 | 🔴 16 | 🔴 **Open — and worse than recorded** | Mirror unpublished, plus the new locale-file defect |
| RISK-02 tenant isolation | 🔴 15 | 🟠 **Open** | Tests exist; unproven against production |
| RISK-04 backups | 🟠 12 | 🟠 **Open** | Scripted, never run for real |
| RISK-D1 zero tests | 🔴 16 | 🟡 **Substantially reduced** | <!-- LEAD: insert verified test totals from TEST_PLAN.md --> |
| RISK-P1 Snapchat | 🟠 12 | 🟠 **Open by design** | Disclosure, not code |
| RISK-P2 Arabic | 🟠 12 | 🟠 **Open** | Review not started |
| RISK-05 token encryption | 🟡 8 | 🟡 **Still unverified** | Full-disk encryption is the mandated compensating control |

**Still must be closed before any customer touches production:**
RISK-L1 (source offer), RISK-02 (tenant isolation, proven), RISK-04 (a real
restore), RISK-S1 (verified on a live deploy), RISK-P2 (Arabic review of
high-traffic screens).

---

## 6. A realistic path to launch

Sequenced by dependency and by lead time, not by preference. Durations are
**effort shape**, not commitments — nobody has run this before.

**Stage 0 — start the clock on things you do not control (day 1)**
Register the Meta app and start App Review. Register the TikTok app and start
audit review. Request Google Business Profile quota. These take 1–3 weeks
*elapsed* and everything else can proceed in parallel. Starting them late is the
most likely reason a launch slips.

**Stage 1 — deploy something, anywhere (blocks 4.1, and therefore most things)**
Provision a host per `DEPLOYMENT.md` §2. Build the image **with
`NEXT_PUBLIC_SOURCE_URL` as a build arg**. `preflight.sh` to 0. Bring the stack
up. Claim super-admin. Close registration. Prove HTTPS.

**Stage 2 — prove the data survives (4.4)**
Run a backup. Run `restore-drill.sh`. **Write the result into the drill log.**
Do this on day one of having a live database, not after there is data worth
losing.

**Stage 3 — fix the licence (4.2)**
Publish the source mirror. Remove the hardcoded upstream link from all 16 locale
files. Verify on the live site with `curl`. This is small work with a large
consequence and there is no reason to defer it.

**Stage 4 — publish something real (4.3)**
Working through `BETA_CHECKLIST.md` §3, per platform, as each approval lands.
Expect surprises: TikTok private drafts, X's paid tier, Instagram rejecting
personal accounts.

**Stage 5 — look at it in Arabic (4.6), and have someone read it (4.5)**
An `ar-AE` session, a human, and the checklist. In parallel, commission the
native review of the high-traffic screens.

**Stage 6 — prove isolation and approval (4.8)**
Adversarial tests against the real deployment, including the public API, and
approval enforcement for every `CreationMethod`.

**Stage 7 — decide the commercial questions (4.10)**
Entity, jurisdiction, VAT, price, support terms.

**Stage 8 — the gate**
`BETA_CHECKLIST.md` §2 and §11, signed. Then customer #1 — one customer, alone,
until they have published a real post.

---

## 7. Owner decisions still outstanding

Not engineering questions. Nothing below can be resolved from the repository.

| # | Decision | Blocks |
|---|---|---|
| **D3** | Which platforms for the MVP? Snapchat is not available. | Which approvals to start; `BETA_CHECKLIST.md` §3 |
| **D4** | Legal entity name and jurisdiction | `/terms`, `/privacy`, VAT, invoicing |
| **D5** | Who performs the native Arabic review | RISK-P2, the beta gate |
| **D6** | AED/SAR price points, and beta pricing **with an end date** | `PRICING_RECOMMENDATIONS.md` |
| **D7** | Source-offer route, and acceptance that the mirror makes the code public | RISK-L1 — **the licence blocker** |
| **D8** | Ratify the Arabic brand rendering «نشر» | Every Arabic surface |
| **D9** | Support contact, hours and response-time commitment | `CUSTOMER_ONBOARDING_GUIDE.md` §11 |
| **D10** | Hosting provider and region | `DEPLOYMENT.md` §2; the cost basis for pricing |

---

## 8. The Phase 8 document set

| Document | Purpose |
|---|---|
| **`LAUNCH_READINESS.md`** | This. The verdict and the blocking list. |
| [`FEATURES.md`](FEATURES.md) | What Nashr does, and §5 — what it does not |
| [`OPEN_SOURCE_COMPLIANCE.md`](OPEN_SOURCE_COMPLIANCE.md) | AGPL-3.0 obligations, §13, dependency inventory, pre-launch checklist |
| [`CUSTOMER_ONBOARDING_GUIDE.md`](CUSTOMER_ONBOARDING_GUIDE.md) | For a business owner. Non-technical, bilingual-aware |
| [`ADMIN_GUIDE.md`](ADMIN_GUIDE.md) | For whoever operates the platform |
| [`PRICING_RECOMMENDATIONS.md`](PRICING_RECOMMENDATIONS.md) | AED/SAR recommendations with cost reasoning. Recommends; does not decide |
| [`BETA_CHECKLIST.md`](BETA_CHECKLIST.md) | The 5–10 business gate |
| `TEST_PLAN.md`, `RTL_VERIFICATION.md` | Owned by other workstreams; referenced, not summarised here |

Earlier phases: [`AUDIT_REPORT.md`](AUDIT_REPORT.md) ·
[`IMPLEMENTATION_PLAN.md`](IMPLEMENTATION_PLAN.md) ·
[`RISK_REGISTER.md`](RISK_REGISTER.md) ·
[`FORK_CUSTOMIZATIONS.md`](FORK_CUSTOMIZATIONS.md) ·
[`DEPLOYMENT.md`](DEPLOYMENT.md) ·
[`BACKUP_AND_RECOVERY.md`](BACKUP_AND_RECOVERY.md) ·
[`SECURITY_CHECKLIST.md`](SECURITY_CHECKLIST.md) ·
[`OPERATIONS_RUNBOOK.md`](OPERATIONS_RUNBOOK.md)

---

## 9. What would make this document say "READY"

Not a wish list — the actual, finite set.

- [ ] The stack has been deployed and has run for at least a week.
- [ ] `preflight.sh` exits 0; `healthcheck.sh` exits 0; HTTPS is valid.
- [ ] A public source mirror exists, `NEXT_PUBLIC_SOURCE_URL` points at it, and
      `curl https://<domain>/licenses` proves it on the live site.
- [ ] The locale-file source link is fixed in all 16 files.
- [ ] `BETA_CHECKLIST.md` §3 is complete for every enabled platform: a real
      post, an image post, an Arabic post, a scheduled post, a handled failure,
      a reconnect.
- [ ] A backup has been restored, and the drill log has a real row in it.
- [ ] Tenant-isolation tests pass against the real deployment, including the
      public API.
- [ ] Approval enforcement is proven for every `CreationMethod`.
- [ ] Native Arabic review complete for the high-traffic screens; the brand
      rendering ratified.
- [ ] A human has walked the product in `ar-AE` and archived screenshots.
- [ ] Entity, jurisdiction, VAT position and price are decided; `/terms` and
      `/privacy` no longer show a placeholder.
- [ ] Every beta customer has acknowledged the disclosures in
      `BETA_CHECKLIST.md` §4 in writing.
- [ ] `BETA_CHECKLIST.md` §11 is signed with evidence.

Until then the honest sentence is the one at the top of this document, and the
right thing to do with it is to work through §6 — not to soften it.
