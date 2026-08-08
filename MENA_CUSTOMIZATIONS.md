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
