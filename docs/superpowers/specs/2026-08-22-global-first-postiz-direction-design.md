# Global-first Postiz product direction

**Date:** 2026-08-22  
**Status:** Direction approved; written specification awaiting review  
**Base:** Postiz remains the product engine and upstream merge source

## 1. Decision

The product will be a global social publishing platform built as a thin Postiz
fork. It will follow the Postiz product model instead of becoming a separate
MENA-first application or a headless infrastructure rewrite.

The public positioning is:

> Social publishing infrastructure for humans and AI agents.

The web application remains a complete product for creators, teams and
agencies. API, MCP, SDK and CLI clients are first-class ways to operate the same
organizations, channels, posts, approvals and publishing pipeline. None of
those interfaces gets a separate data model or a path around authorization and
approval controls.

Arabic, RTL, regional dialects, Hijri and Ramadan/Eid calendars, bilingual
workflows and regional content expertise remain differentiated localization
features. They do not define the global product category, default onboarding or
default pricing.

## 2. Goals

1. Return the product narrative, defaults and onboarding to a global baseline.
2. Preserve Postiz as the underlying engine and make upstream updates practical.
3. Give human and agent callers equivalent, documented publishing capabilities.
4. Retain the tested approval, tenant-isolation and localization layers.
5. Use Cloudflare R2 for production media and off-host backups.
6. Launch with the proven Docker topology instead of rewriting stateful services
   for Cloudflare-native primitives.
7. Adopt globally understandable pricing, currencies and onboarding choices.
8. Keep the current Nashr name as an internal placeholder until a replacement
   name is selected, then perform one deliberate rebrand.

## 3. Non-goals

- Rewriting Postiz from scratch.
- Replacing PostgreSQL with D1, Redis with Durable Objects, or Temporal with
  Cloudflare Workflows for the initial launch.
- Building a second publishing pipeline specifically for agents.
- Removing or weakening Arabic and MENA functionality.
- Selecting a permanent brand name in this project.
- Rebuilding every upstream screen merely to look different from Postiz.
- Supporting every social network before launch; enabled networks must instead
  have complete OAuth and publishing verification.

## 4. Product model

### 4.1 Audience

The product serves global creators, in-house social teams and agencies through
the web interface. Developers and AI-agent builders are equal platform users,
not a separate enterprise add-on.

The homepage and onboarding should show two paths into one product:

- **Use the workspace:** connect channels, invite a team, compose, approve,
  schedule and analyze from the browser.
- **Connect an agent or application:** create an API key, install/configure the
  CLI or SDK, or connect an MCP client, then operate the same workspace under
  the same permissions.

### 4.2 Global defaults

- English is the initial interface language; language and locale are explicit
  onboarding choices.
- UTC-derived timezone detection proposes a timezone but never silently changes
  an established organization setting.
- USD monthly and annual prices are the canonical public prices. Display
  currencies may be localized later without creating region-specific products.
- Week start, date format, numerals and campaign calendars come from the chosen
  locale/market profile rather than a MENA default.
- The default content experience is industry- and audience-aware, not tied to a
  particular region.

### 4.3 Localization

Localization is a capability layer over the global product:

- Arabic and RTL remain fully supported.
- Regional Arabic dialect guidance remains selectable.
- Bilingual post and approval workflows remain available.
- Hijri, Ramadan and Eid calendar helpers remain opt-in based on locale or
  campaign settings.
- Regional templates and agents are surfaced when relevant, alongside future
  localization packs for other markets.
- Machine-generated translations remain subject to human review before being
  treated as production-quality copy.

## 5. Interface parity

### 5.1 Canonical domain operations

Every interface uses the existing Postiz/Nashr domain services for:

- organizations and users;
- integrations and channels;
- media upload and selection;
- draft creation and editing;
- scheduling, approval and publishing;
- analytics and audit history;
- agent proposals and approved actions.

Controllers, MCP tools, SDK methods and CLI commands should remain thin adapters.
Business rules belong in shared services, and all publish operations must
continue through the single orchestrator approval gate.

### 5.2 Public API

- Treat the existing API-key authentication and public endpoints as a product
  surface with versioning, stable error shapes and OpenAPI documentation.
- Publish examples for the complete workflow: connect/select a channel, upload
  media, create a draft, request approval, schedule and inspect status.
- Add idempotency to mutation endpoints where a retry could duplicate a post.
- Apply the same tenant scope, role checks, rate limits and audit fields used by
  the web application.

### 5.3 MCP

- Keep the existing HTTP streaming MCP server.
- Organize tools around the canonical domain operations rather than exposing
  arbitrary internal methods.
- Clearly distinguish read tools, draft-producing tools and consequential tools.
- Consequential actions require the existing proposal/human-approval mechanism
  unless the organization explicitly enables autonomous publishing.
- Return structured, stable results suitable for agents rather than UI prose.

### 5.4 SDK

- Expand the existing TypeScript SDK to cover the supported public API rather
  than maintaining hand-written partial behavior.
- Prefer generation from the versioned OpenAPI contract where practical.
- Preserve a small ergonomic wrapper for common publishing workflows.

### 5.5 CLI

The current command application is an internal placeholder, not a product CLI.
The product CLI will be a separate distributable client that calls the public
API. Initial commands should cover:

- authentication and workspace selection;
- listing channels and integrations;
- media upload;
- creating and validating drafts;
- requesting/reading approvals;
- scheduling and inspecting post status;
- MCP configuration output for supported clients.

It must support human-readable output and deterministic JSON output, non-zero
exit codes, environment-variable authentication, idempotency keys and CI-safe
non-interactive operation. It must not import backend repositories or access the
database directly.

## 6. Agents and content intelligence

Agents are a controlled interface to the same platform, not a separate product
engine.

- Generalize the existing content and brand-profile agents so market and
  language are inputs rather than MENA assumptions.
- Keep localization and regional-calendar specialists as optional expertise.
- Keep grounding, secret redaction, proposal signing, audit logging and the
  rule that a model cannot approve its own action.
- Growth features may recommend variants, hooks, repurposing, timing and
  experiments, but they cannot fabricate analytics or bypass platform rules.
- Generated content starts as a draft unless an organization has deliberately
  enabled autonomous publishing and the central publish gate permits it.

## 7. Branding strategy

Do not perform another broad rename until the permanent name is approved.

Until then:

- Treat `Nashr`, Arabic logos and `Nashr*` database identifiers as legacy
  implementation names.
- Remove MENA-first claims from product-facing copy where copy can remain
  brand-neutral.
- Put new customer-facing brand references behind the existing centralized
  brand configuration.
- Do not rename database tables, migration history or internal package paths
  merely for aesthetics; those changes add migration and upstream-merge risk.

When the name is selected, the rebrand should update the centralized brand
configuration, public assets, metadata, email identity, legal copy, source
offer and customer-facing translations. Internal schema/package renames require
a separate cost-benefit decision and are not launch blockers.

## 8. Deployment architecture

### 8.1 Launch topology

The launch uses the existing production Docker architecture:

- **Application container:** Next.js frontend, NestJS backend, Postiz
  orchestrator and internal nginx under the existing process manager.
- **PostgreSQL:** canonical relational store and Prisma migration target.
- **Redis:** cache, rate limiting and coordination expected by Postiz.
- **Temporal:** durable scheduled-publishing workflows and workers.
- **Cloudflare R2 media bucket:** all production uploads.
- **Cloudflare R2 backup bucket:** database and operational backups, isolated
  from the media bucket with separate credentials.
- **Cloudflare edge:** DNS, proxy/CDN, TLS, WAF, rate controls and optional
  Turnstile protection.

The application host may initially run PostgreSQL, Redis and Temporal in the
same Compose stack to minimize cost. Backups must be off-host. Each dependency
can later move to a managed service without changing the product model.

### 8.2 Why not Cloudflare-only

Cloudflare Containers can run the application image, but they do not remove the
container build and their local disk is ephemeral. Hyperdrive connects to an
existing PostgreSQL database rather than providing one. A Cloudflare-only
deployment would therefore require replacements for PostgreSQL, Redis and
Temporal and would turn a launch project into a platform rewrite.

The Docker-plus-R2 topology is cheaper at low volume, already covered by the
repository's deployment tooling, and preserves compatibility with upstream
Postiz. Cloudflare Containers remain a future deployment target after runtime
usage and operational requirements are measured.

### 8.3 Storage behavior

- Production must set `STORAGE_PROVIDER=cloudflare`.
- Browser uploads, agent uploads, API uploads and CLI uploads use the same media
  service and organization-scoped authorization.
- Store object keys and metadata in PostgreSQL; store binary objects in R2.
- Use presigned or controlled upload/download paths rather than exposing bucket
  credentials.
- Configure lifecycle policies deliberately; published media must not expire
  while a social provider can still fetch it.
- Keep the backup bucket private, encrypted and inaccessible to application
  media credentials.

## 9. Pricing and onboarding

### 9.1 Pricing principles

- Publish canonical USD monthly and annual prices.
- Meter around durable value: workspaces, social channels, team seats and
  reasonable usage allowances.
- Include API, MCP and CLI access in paid plans rather than treating basic
  interoperability as an enterprise-only feature.
- Meter unusually expensive AI generation separately or with transparent
  credits; do not meter ordinary drafts, approvals or localization helpers.
- Avoid region-specific tiers. Taxes and localized display currencies are
  checkout concerns, not separate product editions.

Exact prices are a commercial decision and will be finalized after infrastructure
costs and the initial customer profile are confirmed.

### 9.2 Onboarding flow

1. Create account and workspace.
2. Select language, timezone and optional market profile.
3. Choose browser-first or API/agent-first setup guidance.
4. Connect at least one social channel.
5. Establish brand voice and approval policy.
6. Create the first draft through web, API, MCP or CLI.
7. Complete a real publish and show its status/audit trail.
8. Invite collaborators or create an automation credential.

Regional content packs and bilingual workflows are suggested only when the
chosen language, market or user action makes them relevant.

## 10. Security and failure behavior

- Tenant isolation and role checks apply at service boundaries, never only in
  UI components.
- API keys are scoped, revocable, auditable and never accepted in query strings.
- MCP and CLI actions identify their creation method in the audit trail.
- Retries use idempotency keys and preserve the current no-duplicate publishing
  semantics.
- A failed approval check prevents publishing from every interface.
- If R2 is unavailable, uploads fail explicitly; the system must not silently
  fall back to ephemeral local storage in production.
- If Temporal is unavailable, drafts remain safe and scheduled actions recover
  when workflow service returns; health checks report degraded publishing.
- Secrets remain in deployment configuration, not repository files or client
  bundles.

## 11. Upstream maintenance

- Track Postiz releases and keep a documented upstream remote.
- Prefer new behavior in focused libraries and adapters instead of invasive
  edits to upstream screens and repositories.
- Maintain a customization ledger, but rename it from an MENA-specific record
  to a general fork-maintenance record during implementation.
- For each upstream merge, run the production build, interface contract tests,
  tenant-isolation suite, approval suite, migration drift check and backup
  drill.
- Preserve AGPL obligations, including a public Corresponding Source URL for
  the deployed version.

## 12. Testing and acceptance

The pivot is complete when all of the following are true:

1. No primary product page, default onboarding step or pricing screen describes
   the platform as MENA-first.
2. Arabic/RTL and regional calendar regression tests still pass.
3. Web, API, MCP and CLI can each create a draft and schedule it through the
   same approval and publishing path.
4. Contract tests prove consistent authorization, tenant scope, idempotency and
   error behavior across programmatic interfaces.
5. Production rejects local media storage and successfully completes an R2
   upload/download/delete lifecycle.
6. The Docker production stack passes preflight, migrations, health checks,
   backup/restore and a reboot recovery exercise.
7. At least one enabled social provider passes connect, immediate publish,
   scheduled publish, media publish, failure and reconnect tests.
8. Public documentation explains the web, API, MCP, SDK and CLI paths without
   promising unsupported parity.
9. Global USD pricing and onboarding copy contain no unresolved regional or
   legal placeholders.
10. The source offer points to the exact public source corresponding to the
    deployed build.

## 13. Delivery sequence

The implementation should be decomposed into independently releasable projects:

1. **Global product baseline:** positioning, defaults, documentation and removal
   of MENA-first assumptions.
2. **Interface contract:** versioned OpenAPI surface, shared service boundaries,
   idempotency and audit semantics.
3. **SDK and product CLI:** complete supported workflows against that contract.
4. **Agent generalization:** global content intelligence with optional regional
   specialists.
5. **R2 production path:** media, backup separation, failure behavior and tests.
6. **Global onboarding and pricing:** browser flows and commercial copy.
7. **Launch validation:** Docker deployment, provider smoke tests, recovery,
   security and compliance evidence.

Each project receives its own implementation plan and verification gate. This
prevents a broad positioning change from becoming an unreviewable rewrite.
