# `libraries/nashr-agents`

MENA content agents for **Nashr (نشر)**, built on the Mastra runtime that Postiz
already ships. This library adds agents; it does not add a second agent
framework and it does not modify upstream's `postiz` agent.

```
apps/frontend/components/agents            CopilotKit UI
        │
apps/backend/api/routes/nashr-agents.controller.ts
        │   ← the only place a confirmation token is minted
libraries/nashr-agents/
  ├─ registry.ts        agent definitions + capability declarations (+ boot-time validation)
  ├─ guardrails.ts      tenancy, schema, approval gate, retry/timeout, audit, error mapping
  ├─ redaction.ts       secrets + PII stripped before prompts, before logs, before errors
  ├─ audit.ts           NashrAgentActionLog persistence
  ├─ proposals.ts       signed, single-use human confirmations
  ├─ grounding.ts       brand field allow-list + prohibited-claims injection
  ├─ ports.ts           the narrow interfaces this library depends on
  ├─ runtime.ts         per-turn budget + the single tool entry point
  ├─ mastra.binding.ts  registry → Mastra agents
  ├─ adapters/          Prisma / IntegrationService implementations of the ports
  └─ agents/            the six agents
```

---

## The six agents

| Key | What it does | Sensitive tools |
|---|---|---|
| `nashrBrandProfile` | Reads and maintains `NashrBrandProfile`: tone, industry, market, audience, products, offers, **prohibited claims** | `saveBrandProfile`, `setProhibitedClaims`, `deleteBrandProfile` |
| `nashrContent` | Bilingual (en + ar) captions, hooks, hashtags, content ideas; deterministic prohibited-claim check | `saveDraftPost` |
| `nashrLocalization` | ar↔en adaptation for a specific market; **cultural by default, literal only on request** | — |
| `nashrCampaignCalendar` | Weekly/monthly plans, Hijri-aware; **proposes, never schedules** | `scheduleCalendar`, `changeCampaign` |
| `nashrApproval` | Routes drafts through review and records decisions people made. **Never approves on a human's behalf** | `submitForReview`, `recordHumanDecision` |
| `nashrAnalyticsSummary` | Weekly summaries from channels that actually report analytics; **states coverage gaps, never invents numbers** | — |

---

## What the guardrails guarantee

Every guarantee below is enforced in one shared place and covered by a test in
`src/__tests__/`. None of them is a prompt instruction alone.

### 1. A sensitive action is shown before it runs

`GuardrailRuntime.execute()` is the only path to a tool handler. For a tool with
`sensitive: true`:

1. The first call **does not run the handler**. It persists a proposal in state
   `PROPOSED` and returns a `ProposedAction` — an opaque `proposalId`, a redacted
   summary, a field-by-field preview, and a plain statement of the effect.
2. A person approves it over HTTP
   (`POST /nashr-agents/proposals/:id/approve`, behind `AuthMiddleware`). That
   endpoint is the **only** caller of `signConfirmation()`.
3. The call is replayed with the resulting `confirmationToken`. The guardrail
   verifies the HMAC **and** that the stored proposal is `APPROVED`, then flips
   it to `CONSUMED` *before* the handler runs.

The model never sees a token. It receives a `proposalId` and nothing that can
authorise anything, so it cannot approve its own action. The confirmation is
bound to `(proposalId, organizationId, toolId, argsHash, approver, expiry)` —
changing a single argument after approval invalidates it.

### 2. Approval is required for publish / delete / message / campaign change

Not a convention — a registration-time rule. `registry.ts` rejects any tool
whose `category` is `write`, `publish`, `delete`, `message`, `schedule` or
`campaign` unless `sensitive === true`. There is no bypass flag and no
"trusted" escape hatch; a violation is a boot failure.

### 3. Every action is logged

`AuditLogger` writes a `NashrAgentActionLog` row for every outcome:
organisation, acting member, agent, tool, sensitivity, status, redacted args
digest, redacted result summary, redacted error, attempt count and duration.
A sensitive tool produces the full trail `AWAITING_APPROVAL → APPROVED →
EXECUTED`. A failing audit sink is reported through `onAuditFailure` but never
fails the user's action.

### 4. Errors are typed and safe

`errors.ts` defines a closed set of codes, each with one fixed user-facing
sentence. Anything else thrown collapses to `INTERNAL`. Stack traces, provider
messages ("OpenAI 401 … sk-proj-…"), Prisma errors and internal record ids
never reach the model or the user. The unredacted detail is kept only for the
server-side log, and even that is redacted.

### 5. Secrets and personal data are stripped before they travel

`redaction.ts` runs in three places, all before data leaves the process:
prompt assembly, audit persistence, and error text. It removes provider API
keys, AWS/Google keys, Slack/GitHub tokens, JWTs, `Authorization` headers,
inline `key=value` credentials, PEM private keys, credentialled connection
strings, email addresses, international and Gulf-local phone numbers, IBANs and
card-length digit runs — and drops the *value* of any key named like a
credential, at any depth.

Brand data is separately allow-listed: `toBrandGrounding()` returns
`Pick<BrandProfileRecord, BRAND_PROMPT_FIELDS[number]>` field by field, so ids,
foreign keys and timestamps cannot reach a prompt. Adding a column to
`NashrBrandProfile` does not expose it — the compiler requires a deliberate
edit.

### 6. Structured tool calls only

Every tool has a Zod input schema and a Zod output schema, both enforced by the
guardrail. There is no shell, no `exec`, no arbitrary HTTP, no `eval` and no raw
SQL anywhere in this library, and `registry.ts` refuses to register a tool whose
id, title or description suggests one.

### 7. Retry limits and timeouts

| Limit | Value | Where |
|---|---|---|
| Per tool call | 30 s | `withTimeout` in `GuardrailRuntime.execute` |
| Per agent turn | 120 s | `TurnBudget.deadline` |
| Retries | 2 (3 attempts), full-jitter exponential backoff capped at 4 s | `GuardrailRuntime` |
| Retries on a sensitive write | **0** | non-idempotent categories are never replayed |
| Tokens per turn | 24 000 | `TurnBudget.consumeTokens`, charged by `GroundedModel` |
| Tokens per model call | 2 000 | `GroundedModel` |
| Tool calls per turn | 12 | `TurnBudget.registerToolCall` |

Only `UPSTREAM_UNAVAILABLE` and `TIMEOUT` are retriable. Exceeding a limit is
recorded as `TIMED_OUT` or `FAILED`.

### 8. Organisation scoping

Tenancy comes from the authenticated request and is placed on Mastra's
`requestContext`; it is never read from tool arguments. `assertOrgScope()` walks
the whole input and rejects any `organizationId` / `orgId` / `workspaceId` that
differs from the caller's, at any depth. Every port method takes
`organizationId` as its first parameter, and every adapter query filters on it —
the repo has no row-level security (`AUDIT_REPORT.md` §15, S6), so this is the
only thing standing between tenants.

### 9. Prohibited claims are a hard constraint

`GroundedModel` is the only route from an agent to a model. It injects the brand
block — including the prohibited-claims list — into **every** system prompt, and
re-checks the output deterministically with `findProhibitedClaims()`, failing
with `PROHIBITED_CLAIM` on a match. An agent author cannot opt out, because
there is no other way to reach a model. This matters for UAE/KSA advertising
rules and, for clinics, health-claim rules.

---

## Adding a new agent safely

1. Create `src/agents/<name>.agent.ts` exporting
   `create<Name>Agent(deps: AgentFactoryDeps): AgentDefinition`.
2. Declare `capabilities`. Every tool must map to one the agent declares.
3. Define tools with `defineTool({ ... })`:
   - `category` — be honest. Anything that changes state is `write`, `publish`,
     `delete`, `message`, `schedule` or `campaign`, and the registry will force
     `sensitive: true`.
   - `inputSchema` / `outputSchema` — Zod, always.
   - `describeProposal` — required for sensitive tools. Write it for the person
     who has to decide, not for the model.
   - `handler` — pure business logic. It receives already-validated input and a
     context whose `organizationId` is authoritative. Read data only through a
     port, passing `ctx.organizationId`.
4. Generate text only via `groundedModelFor(deps, ctx, instructions, customerId)`.
   Never import a model SDK into an agent.
5. Add the factory to `NASHR_AGENT_FACTORIES` in `src/agents/index.ts`. That is
   the only shared file you touch.
6. Run the tests. `registry.spec.ts` asserts the sensitivity, capability and
   proposal rules across every registered agent, so a new agent is checked
   automatically.

What you get for free: tenancy enforcement, schema validation, the approval
gate, retries, timeouts, the token budget, the audit trail, redaction, safe
errors, and prohibited-claims injection.

What you must not do: call `tool.handler` directly, add a `skipApproval` flag,
read data without `organizationId`, put a model SDK in an agent file, or return
a raw provider error.

---

## Running the tests

The root `jest.config.ts` uses `getJestProjects()` from `@nx/jest`, but this
repository has no `nx.json` and `@nx/jest` is not installed — the root runner
does not work for any project, upstream included. Run this library directly:

```bash
npx jest --config libraries/nashr-agents/jest.config.ts
```

---

## Integration points

These are deliberate seams. Each is a narrow interface in `ports.ts`, so the
owning workstream can land independently.

| Seam | Status | What is needed |
|---|---|---|
| **`tsconfig.base.json` path alias** | Not done — file not owned by this workstream | Add `"@gitroom/nashr-agents/*": ["libraries/nashr-agents/src/*"]`. The backend controller currently uses relative imports; they become scoped imports with no other change. |
| **Controller registration** | Not done — `apps/backend/src/api/routes/api.module.ts` not owned by this workstream | Add `NashrAgentsController` to `authenticatedController` (so `AuthMiddleware` applies — it must, the approval endpoint depends on it) and add `NashrAgentsService` + `OpenAiModelPort` to `providers`. |
| **`ApprovalPort`** ← `libraries/nashr-approval` | Working stub in place | `PrismaApprovalPort` writes `NashrPostApproval` directly. Replace the binding in `NashrAgentsService` with `NashrApprovalService` once its stage-transition rules, role checks and notifications are the single source of truth. The port shape does not need to change. |
| **`HijriPort`** ← `libraries/nashr-i18n` | Falls back to a local adapter | `resolveHijriPort()` already adapts nashr-i18n's function-style exports; it needs the `@gitroom/nashr-i18n/*` path alias to resolve. Until then `IntlHijriAdapter` is used — verified to produce identical Umm al-Qura dates for Ramadan, Eid al-Fitr, Arafah and Eid al-Adha. |
| **`PostsPort`** | Fails closed (`NOT_CONFIGURED`) | Publishing is gated on a `NashrPostApproval` row at stage `APPROVED`, enforced in the Temporal publish activity. Wiring scheduling here before that chokepoint exists would create a second path to the queue that bypasses it. Wire `createDraft` to `PostsService.createPost(orgId, dto, CreationMethod.MCP)` and `scheduleDrafts` to the approval library's scheduling entry point. |
| **`ProposalStorePort`** | In-memory | Correct for one backend process. A multi-replica deployment needs a Redis-backed implementation — `redis` and `ioredis` are already dependencies. Without it, a proposal created on replica A cannot be approved on replica B. |

## Configuration

| Variable | Required | Purpose |
|---|---|---|
| `NASHR_AGENT_PROPOSAL_SECRET` | Yes (falls back to `JWT_SECRET`) | HMAC key for confirmation tokens. Minimum 16 characters; `resolveProposalSecret()` throws otherwise. |
| `OPENAI_API_KEY` | Yes for generation | Read at call time, never at import — a missing key is a clear `NOT_CONFIGURED` failure, not a silent `sk-proj-` stub. |
| `NASHR_AGENT_MODEL` | No | Overrides the model id. |
| `NASHR_AGENT_MODEL_FAST` | No | Model for `modelTier: 'fast'` agents. |

No secret is ever hardcoded, logged, or placed in a prompt.
