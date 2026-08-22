# RISK_REGISTER.md — Nashr (نشر)

Base: Postiz v1.47.0 (AGPL-3.0). Compiled during the Phase 1 read-only audit.

**Scoring:** Likelihood (L) and Impact (I) 1–5. Score = L × I.
**Severity:** 🔴 Critical ≥15 · 🟠 High 9–14 · 🟡 Medium 4–8 · 🟢 Low ≤3
**Status:** Open · Mitigating · Accepted · Closed

---

## Legal and licensing

### RISK-L1 🔴 AGPL §13 network source-offer not satisfied — Score 16 (L4 × I4)
Postiz is AGPL-3.0. Once Nashr is offered over a network, **every remote user must be
offered the Corresponding Source**, including our modifications. A private repo with live
customers and no source-offer route is a licence violation.
**Mitigation:** before onboarding any customer, publish a source mirror or add a
prominent in-app download link. Track as Phase 8 gate D7. **Owner:** you. **Status:** Open.

### RISK-L2 🟠 Trademark contamination in derived assets — Score 12 (L3 × I4)
"Postiz" appears in **108 files** and inside the shipped translation files (e.g. the
Arabic `ar/translation.json` webhook string). Customer-facing use of the Postiz name/logo
without permission is a trademark problem, separate from the AGPL copyright grant.
**Mitigation:** Phase 2.3–2.9 sweep including all 18 locale files; exit-gate grep.
**Status:** Open.

### RISK-L3 🟡 Attribution stripped by over-zealous rebranding — Score 8 (L2 × I4)
An aggressive find-and-replace could remove the AGPL notice, `LICENSE`, or copyright headers.
**Mitigation:** `LICENSE`, `SECURITY.md`, `CODE_OF_CONDUCT.md`, `CONTRIBUTING.md`,
`ICLA.md`, `CCLA.md` are on a protected list; CI check asserts `LICENSE` is unmodified
(661 lines, AGPL v3). Footer attribution added in 2.12. **Status:** Open.

### RISK-L4 🟡 Sub-package licence metadata inconsistency — Score 6 (L3 × I2)
4 sub-package manifests declare `"license": "ISC"` while root declares `AGPL-3.0`.
Upstream sloppiness, but it could be read as a licence misrepresentation in our fork.
**Mitigation:** document in `FORK_CUSTOMIZATIONS.md`; do not "correct" in a way that
weakens the AGPL claim. **Status:** Open.

### RISK-L5 🟡 Mastra licence unverified — Score 6 (L2 × I3)
`@mastra/core` and friends underpin the agent runtime. Licence (Apache-2.0 vs Elastic)
not confirmed during audit; an Elastic-style licence could restrict SaaS resale.
**Mitigation:** verify before Phase 5; `pnpm licenses list` feeds the `/licenses` page.
**Status:** Open.

---

## Data and availability

### RISK-01 🔴 No migration history; `db push --accept-data-loss` — Score 20 (L4 × I5)
`find . -type d -name migrations` returns **nothing**. The only schema mechanism is
`prisma db push --accept-data-loss`. Running that against production silently drops
columns and data. Phase 4 adds three new models, which makes this urgent.
**Mitigation:** baseline `prisma migrate diff` into an initial migration **before**
Phase 4; switch deploys to `migrate deploy`; remove `--accept-data-loss` from any
production path. **Status:** Open. **Blocks:** Phase 4, Phase 6.

### RISK-02 🔴 Cross-tenant data leakage — Score 15 (L3 × I5)
Isolation depends on every query filtering `organizationId`. There is **no row-level
security** and **no test** proving isolation (0 tests exist). One missing `where` clause
exposes another customer's content and tokens. In an agency product where org A is a
competitor of org B, this is existential.
**Mitigation:** adversarial integration suite (Phase 7) covering every org-scoped
endpoint; consider Postgres RLS post-MVP. **Status:** Open.

### RISK-03 🟠 Deleting marketplace features breaks upstream merges — Score 12 (L4 × I3)
The brief says remove enterprise/CRM complexity. Deleting `SocialMediaAgency`, `Orders`,
`Messages`, `PayoutProblems`, `Star`, `Trending` etc. would create permanent merge
conflicts against upstream and violate brief item 10 (preserve upstream updates) and
item 9 (no undocumented destructive changes).
**Mitigation:** **hide in UI, keep in code and schema.** Feature-flag rather than delete.
Every hidden feature documented in `FORK_CUSTOMIZATIONS.md`. **Status:** Mitigating by design.

### RISK-04 🟠 No backups configured — Score 12 (L3 × I4)
No backup tooling exists in the repo. Losing the Postgres volume loses all customer content,
schedules, and OAuth tokens.
**Mitigation:** Phase 6.7 — automated `pg_dump` to R2, retention policy, and a
**tested restore drill** (untested backups are not backups). **Status:** Open.

### RISK-05 🟡 OAuth token encryption at rest unverified — Score 8 (L2 × I4)
`Integration` stores access/refresh tokens for 36 platforms. Column-level encryption was
not confirmed during the audit. A database dump would yield live credentials for every
customer's social accounts.
**Mitigation:** verify in Phase 4; if plaintext, add application-level encryption with a
key from env + full-disk encryption on the DB volume. **Status:** Open — needs verification.

---

## Security

### RISK-S1 🔴 Placeholder `JWT_SECRET` shipped in compose — Score 15 (L3 × I5)
`docker-compose.yaml:11` contains a literal placeholder JWT secret. Any operator who
deploys without changing it has forgeable sessions for every account.
**Mitigation:** production compose reads `JWT_SECRET` from a secret store with **no
default**; startup fails hard if unset or matching the known placeholder;
`SECURITY_CHECKLIST.md` gate. **Status:** Open.

### RISK-S2 🟠 Dangerous opt-out flags — Score 9 (L3 × I3)
`DISABLE_SSRF_PROTECTION`, `NOT_SECURED`, `DISABLE_REGISTRATION` misconfiguration.
Disabling SSRF protection lets a customer's webhook URL reach internal network services.
**Mitigation:** production `.env.example` sets safe values with warning comments;
startup assertion refuses to boot production with `DISABLE_SSRF_PROTECTION=true` or
`NOT_SECURED=true`. **Status:** Open.

### RISK-S3 🟠 Agent tool abuse / prompt injection — Score 12 (L4 × I3)
Phase 5 agents act on customer data. Content fetched from social platforms or supplied by
a client can carry injected instructions ("publish this now", "delete the campaign").
**Mitigation:** all sensitive tools are proposal-only and require signed human
confirmation; **no shell, no arbitrary HTTP**; Zod-typed structured tools only;
retry ≤2, 30 s tool timeout, 120 s turn timeout; full `AgentActionLog`. **Status:** Mitigating by design.

### RISK-S4 🟠 PII / secrets leaking into model prompts — Score 9 (L3 × I3)
Brand profiles, customer lists, and post content flow to OpenAI. Tokens or personal data
in a prompt leave our trust boundary.
**Mitigation:** redaction layer strips tokens, emails, phone numbers before prompt
assembly; brand profile passes only explicitly declared fields; documented in the privacy
policy (Phase 2.11). **Status:** Open.

### RISK-S5 🟡 Weak `OPENAI_API_KEY` fallback — Score 6 (L3 × I2)
`agent.graph.service.ts:26,32` uses `process.env.OPENAI_API_KEY || 'sk-proj-'`, turning a
misconfiguration into a confusing runtime error instead of a startup failure.
**Mitigation:** fail fast at boot when AI features are enabled. **Status:** Open.

### RISK-S6 🟡 Thin rate limiting on the public API — Score 6 (L3 × I2)
A single `API_LIMIT` var governs the public API.
**Mitigation:** per-org and per-endpoint limits; Phase 7 rate-limit tests. **Status:** Open.

---

## Product and market

### RISK-P1 🟠 Snapchat is not supported — Score 12 (L4 × I3)
None of the 36 providers is Snapchat. Snapchat has very high penetration in Saudi Arabia
and the UAE, and is a primary channel for exactly the target verticals (restaurants,
salons, clinics). Beta customers may consider the product unusable without it.
**Mitigation:** disclose explicitly in Phase 8 known-limitations and to every beta
customer **before** they sign up; assess demand during beta; build post-MVP if confirmed.
**Status:** Open — **requires your decision (D3)**.

### RISK-P2 🟠 Machine-translated Arabic ships as-is — Score 12 (L4 × I3)
`i18n.json` generates Arabic via lingo.dev + `gpt-4.1`. The existing `ar/translation.json`
(~1 400 keys) is unreviewed and already leaks "Postiz" into translated sentences. The brief
explicitly forbids shipping unreviewed machine translation. Poor Arabic destroys
credibility with the exact customers we are targeting.
**Mitigation:** native-speaker review pass (Phase 3.9) before any customer sees Arabic;
prioritise high-traffic screens. **Status:** Open — **requires your decision (D5)**.

### RISK-P3 🟠 RTL layout breakage — Score 12 (L4 × I3)
RTL support is partial: 99 `rtl` references and a `change.dir.tsx` component, but the
calendar, tables, modals, and drag-and-drop in `launches` are the hardest cases and are
unverified.
**Mitigation:** logical CSS properties; per-component RTL checklist; Playwright visual
tests in `ar-AE`; screenshots archived in Phase 8. **Status:** Open.

### RISK-P4 🟡 Approval workflow can be bypassed — Score 8 (L2 × I4)
If approval is enforced only in the UI, the public API, MCP, CLI, and autopost paths
(`CreationMethod = WEB | MCP | API | AUTOPOST | CLI`) could publish unapproved content to
a client's live account.
**Mitigation:** enforce the approval gate in the **Temporal publish activity** — the single
chokepoint all paths traverse. Test each `CreationMethod`. **Status:** Mitigating by design.

### RISK-P5 🟡 Hijri/Ramadan scheduling errors — Score 6 (L3 × I2)
Ramadan and Eid dates shift annually and vary by country's moon sighting. Hardcoded
Gregorian dates in campaign templates would misfire — reputationally costly in this market.
**Mitigation:** `Intl` islamic calendar helper; templates store Hijri offsets, not fixed
Gregorian dates; annual review. **Status:** Open.

### RISK-P6 🟡 Platform policy/API changes — Score 8 (L4 × I2)
Meta, TikTok, and X change API terms and rate limits frequently; app review can be
withdrawn. Postiz's own provider code may lag.
**Mitigation:** pull upstream monthly; monitor `Errors` model; surface connection failures
to customers promptly. **Status:** Accepted (inherent).

---

## Delivery and operations

### RISK-D1 🔴 Zero test coverage — Score 16 (L4 × I4)
`find . -name "*.spec.ts" -o -name "*.test.ts" | wc -l` → **0**. Every regression in
publishing, permissions, or tenant isolation reaches customers unnoticed. Phase 7 is
entirely greenfield, not an incremental addition.
**Mitigation:** prioritise the highest-blast-radius suites first — tenant isolation,
approval enforcement, auth — before breadth. **Status:** Open.

### RISK-D2 🟠 Upstream divergence — Score 12 (L4 × I3)
Every edit to an upstream file is a future merge conflict. Postiz moves quickly.
**Mitigation:** additive-first architecture; **never rename `@gitroom/*`**; brand values
centralised in one module; monthly `sync/upstream-<version>` branches; conflict-prone
files listed in `FORK_CUSTOMIZATIONS.md`. **Status:** Mitigating by design.

### RISK-D3 🟠 Compose pulls the upstream branded image — Score 9 (L3 × I3)
`docker-compose.yaml` uses `ghcr.io/gitroomhq/postiz-app:latest`. Deploying that ships
Postiz branding regardless of our source changes, and `:latest` is unpinned.
**Mitigation:** build and publish our own pinned image in Phase 6.1. **Status:** Open.

### RISK-D4 🟠 Repository creation blocked — Score 9 (L3 × I3)
`mcp__github__create_repository` returned `403 Resource not accessible by integration`.
Work currently lives only in this ephemeral container, which is reclaimed on inactivity.
**Mitigation:** you create `khanjer496-alt/nashr` (private) and I push, or I push to the
existing `khanjer496-alt/restoflux` branch. **Status:** Open — **requires your decision (D1)**.
**This is the most immediate risk: unpushed work is lost when the container is reclaimed.**

### RISK-D5 🟡 Heavy infrastructure for 5–10 beta customers — Score 8 (L4 × I2)
The stack needs Postgres ×2, Redis, Temporal, Elasticsearch — significant RAM and
operational surface for a 5–10 customer beta.
**Mitigation:** size the host realistically (≥8 GB RAM); document minimums in
`DEPLOYMENT.md`; consider dropping Elasticsearch if Temporal advanced visibility is unused.
**Status:** Open.

### RISK-D6 🟡 Node version pinned to a narrow range — Score 4 (L2 × I2)
`>=22.12.0 <23.0.0`. Base-image drift breaks builds.
**Mitigation:** pin the Docker base image digest. **Status:** Open.

---

## Summary

| Severity | Count | IDs |
|---|---|---|
| 🔴 Critical | 5 | RISK-01, RISK-02, RISK-L1, RISK-S1, RISK-D1 |
| 🟠 High | 11 | RISK-03, RISK-04, RISK-L2, RISK-S2, RISK-S3, RISK-S4, RISK-P1, RISK-P2, RISK-P3, RISK-D2, RISK-D3, RISK-D4 |
| 🟡 Medium | 11 | RISK-05, RISK-L3, RISK-L4, RISK-L5, RISK-S5, RISK-S6, RISK-P4, RISK-P5, RISK-P6, RISK-D5, RISK-D6 |

**Must be closed before any customer touches production:**
RISK-01 (migrations), RISK-02 (tenant isolation), RISK-L1 (AGPL source offer),
RISK-S1 (JWT secret), RISK-04 (backups), RISK-D1 (test coverage for the critical paths).

**Must be disclosed to beta customers up front:**
RISK-P1 (no Snapchat), RISK-P2 (Arabic under review), RISK-P3 (RTL edge cases).
