/**
 * Guardrails — implemented once, applied to every tool of every agent.
 *
 * `GuardrailRuntime.execute()` is the ONLY path from an agent to a tool
 * handler. There is no bypass flag and no "trusted tool" escape hatch; a tool
 * that is not routed through here is not reachable, because `mastra.binding.ts`
 * builds every Mastra tool from a registry entry and every registry entry's
 * `execute` is this function.
 *
 * What it enforces, in order:
 *   1. tenancy      — the call is bound to ctx.organizationId; input may not
 *                     name a different organisation
 *   2. schema       — Zod parse of input, Zod parse of output; no free-form
 *                     strings interpreted as commands, no shell, no fetch
 *   3. approval     — sensitive tools return a proposal and stop; execution
 *                     requires a signed, single-use, human-minted confirmation
 *   4. limits       — 30s per tool call, ≤2 retries with exponential backoff,
 *                     bounded by the agent turn deadline
 *   5. audit        — a NashrAgentActionLog row for every outcome
 *   6. errors       — typed, redacted; handlers' raw errors never escape
 */
import type {
  GuardedToolResult,
  NashrToolContext,
  NashrToolDefinition,
  ProposedAction,
} from './types';
import { INHERENTLY_SENSITIVE_CATEGORIES } from './types';
import type { ProposalStorePort, StoredProposal } from './ports';
import { AuditLogger } from './audit';
import {
  NashrAgentError,
  approvalInvalid,
  crossTenant,
  invalidInput,
  normalizeError,
  timeout as timeoutError,
} from './errors';
import {
  DEFAULT_PROPOSAL_TTL_MS,
  hashArgs,
  newProposalId,
  resolveProposalSecret,
  verifyConfirmation,
} from './proposals';
import { redactText } from './redaction';

// ---------------------------------------------------------------------------
// Limits
// ---------------------------------------------------------------------------

export interface NashrAgentLimits {
  /** Wall clock for a single tool call, including retries' individual attempts. */
  toolTimeoutMs: number;
  /** Wall clock for one agent turn (all tool calls + model calls). */
  turnTimeoutMs: number;
  /** Retries AFTER the first attempt. 2 → at most 3 attempts. */
  maxRetries: number;
  retryBaseDelayMs: number;
  retryMaxDelayMs: number;
  /** Hard ceiling on tokens an agent turn may consume. */
  maxTurnTokens: number;
  /** Hard ceiling per individual model call. */
  maxOutputTokensPerCall: number;
  /** How long an unapproved proposal stays valid. */
  proposalTtlMs: number;
  /** Maximum tool calls in one turn — stops runaway loops. */
  maxToolCallsPerTurn: number;
}

export const NASHR_AGENT_LIMITS: NashrAgentLimits = {
  toolTimeoutMs: 30_000,
  turnTimeoutMs: 120_000,
  maxRetries: 2,
  retryBaseDelayMs: 250,
  retryMaxDelayMs: 4_000,
  maxTurnTokens: 24_000,
  maxOutputTokensPerCall: 2_000,
  proposalTtlMs: DEFAULT_PROPOSAL_TTL_MS,
  maxToolCallsPerTurn: 12,
};

// ---------------------------------------------------------------------------
// Turn budget
// ---------------------------------------------------------------------------

/**
 * Per-turn deadline, token ceiling and call counter. One instance per agent
 * turn; passed to the runtime and to `GroundedModel`.
 */
export class TurnBudget {
  private tokensUsed = 0;
  private toolCalls = 0;
  readonly startedAt: number;
  readonly deadline: number;

  constructor(
    private readonly limits: NashrAgentLimits = NASHR_AGENT_LIMITS,
    startedAt: number = Date.now()
  ) {
    this.startedAt = startedAt;
    this.deadline = startedAt + limits.turnTimeoutMs;
  }

  get remainingMs(): number {
    return this.deadline - Date.now();
  }

  get tokens(): number {
    return this.tokensUsed;
  }

  get calls(): number {
    return this.toolCalls;
  }

  assertTimeRemaining(): void {
    if (this.remainingMs <= 0) {
      throw timeoutError('agent turn deadline exceeded');
    }
  }

  registerToolCall(): void {
    this.toolCalls += 1;
    if (this.toolCalls > this.limits.maxToolCallsPerTurn) {
      throw new NashrAgentError(
        'RETRY_EXHAUSTED',
        `tool call ceiling of ${this.limits.maxToolCallsPerTurn} exceeded in one turn`
      );
    }
  }

  consumeTokens(count: number): void {
    this.tokensUsed += Math.max(0, count | 0);
    if (this.tokensUsed > this.limits.maxTurnTokens) {
      throw new NashrAgentError(
        'TOKEN_BUDGET_EXCEEDED',
        `turn used ${this.tokensUsed} of ${this.limits.maxTurnTokens} tokens`
      );
    }
  }

  /** Time available for the next tool call: min(tool limit, turn remaining). */
  sliceMs(): number {
    return Math.max(0, Math.min(this.limits.toolTimeoutMs, this.remainingMs));
  }
}

// ---------------------------------------------------------------------------
// Timeout + retry primitives
// ---------------------------------------------------------------------------

export async function withTimeout<T>(
  work: (signal: AbortSignal) => Promise<T>,
  ms: number,
  detail: string
): Promise<T> {
  if (ms <= 0) throw timeoutError(`${detail}: no time budget remaining`);
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      // Reject BEFORE aborting. A worker that rejects synchronously from its
      // abort listener would otherwise win the race and replace the typed
      // TIMEOUT error with its own — which is exactly the untyped leak this
      // layer exists to prevent.
      reject(timeoutError(`${detail}: exceeded ${ms}ms`));
      controller.abort();
    }, ms);
    // Do not hold the event loop open for a timer that may never fire.
    (timer as any)?.unref?.();
  });

  try {
    return await Promise.race([work(controller.signal), timeoutPromise]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    const t = setTimeout(resolve, ms);
    (t as any)?.unref?.();
  });

/** Full jitter exponential backoff, capped. */
export function backoffDelay(
  attempt: number,
  limits: NashrAgentLimits,
  random: () => number = Math.random
): number {
  const exponential = limits.retryBaseDelayMs * Math.pow(2, attempt);
  const capped = Math.min(exponential, limits.retryMaxDelayMs);
  return Math.floor(capped * (0.5 + 0.5 * random()));
}

// ---------------------------------------------------------------------------
// Tenancy
// ---------------------------------------------------------------------------

const ORG_KEYS = new Set(['organizationid', 'orgid', 'organisationid', 'workspaceid']);

/**
 * Refuse any input that names an organisation other than the caller's.
 * The model can suggest an id; it cannot widen its own scope. Walks nested
 * objects and arrays so a buried `{ filter: { organizationId } }` is caught.
 */
export function assertOrgScope(input: unknown, organizationId: string, depth = 0): void {
  if (!organizationId) {
    throw crossTenant('tool context carried no organizationId');
  }
  if (depth > 6 || input === null || typeof input !== 'object') return;
  if (Array.isArray(input)) {
    for (const item of input) assertOrgScope(item, organizationId, depth + 1);
    return;
  }
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (ORG_KEYS.has(key.replace(/[-_.\s]/g, '').toLowerCase())) {
      if (typeof value === 'string' && value && value !== organizationId) {
        throw crossTenant(`input named a foreign organization for key "${key}"`);
      }
    }
    assertOrgScope(value, organizationId, depth + 1);
  }
}

// ---------------------------------------------------------------------------
// Runtime
// ---------------------------------------------------------------------------

/** Guardrail-level fields. Stripped before the tool's own schema is applied. */
export const GUARDRAIL_INPUT_KEYS = ['confirmationToken', 'proposalId'] as const;

export interface GuardrailRuntimeOptions {
  audit: AuditLogger;
  proposals: ProposalStorePort;
  limits?: NashrAgentLimits;
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
  /** Overridable so tests do not need an env var. */
  secret?: () => string;
}

export interface ExecuteOptions {
  budget?: TurnBudget;
}

export class GuardrailRuntime {
  readonly limits: NashrAgentLimits;
  private readonly audit: AuditLogger;
  private readonly proposals: ProposalStorePort;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly random: () => number;
  private readonly secret: () => string;

  constructor(options: GuardrailRuntimeOptions) {
    this.audit = options.audit;
    this.proposals = options.proposals;
    this.limits = options.limits ?? NASHR_AGENT_LIMITS;
    this.sleep = options.sleep ?? defaultSleep;
    this.random = options.random ?? Math.random;
    this.secret = options.secret ?? (() => resolveProposalSecret());
  }

  async execute<TIn, TOut>(
    agentKey: string,
    tool: NashrToolDefinition<TIn, TOut>,
    rawInput: unknown,
    ctx: NashrToolContext,
    options: ExecuteOptions = {}
  ): Promise<GuardedToolResult<TOut>> {
    const startedAt = Date.now();
    const budget = options.budget ?? new TurnBudget(this.limits, startedAt);
    let attempts = 0;
    let parsed: TIn | undefined;

    try {
      budget.assertTimeRemaining();
      budget.registerToolCall();

      // ── 1. split guardrail fields from tool arguments ────────────────────
      const { toolInput, confirmationToken } = splitGuardrailInput(rawInput);

      // ── 2. schema validation (structured calls only) ─────────────────────
      const result = tool.inputSchema.safeParse(toolInput);
      if (!result.success) {
        throw invalidInput(
          `input failed schema for ${tool.id}: ${summariseZodIssues(result.error)}`
        );
      }
      parsed = result.data as TIn;

      // ── 3. tenancy ───────────────────────────────────────────────────────
      assertOrgScope(parsed, ctx.organizationId);

      // ── 4. approval gate ─────────────────────────────────────────────────
      if (tool.sensitive) {
        if (!confirmationToken) {
          const proposal = await this.createProposal(agentKey, tool, parsed, ctx);
          await this.audit.record({
            organizationId: ctx.organizationId,
            userOrgId: ctx.userOrgId,
            agentKey,
            toolName: tool.id,
            sensitive: true,
            status: 'AWAITING_APPROVAL',
            args: parsed,
            result: { proposalId: proposal.proposalId },
            attempts: 0,
            durationMs: Date.now() - startedAt,
          });
          return { status: 'awaiting_approval', proposal };
        }
        await this.consumeApproval(confirmationToken, agentKey, tool, parsed, ctx);
        await this.audit.record({
          organizationId: ctx.organizationId,
          userOrgId: ctx.userOrgId,
          agentKey,
          toolName: tool.id,
          sensitive: true,
          status: 'APPROVED',
          args: parsed,
          attempts: 0,
          durationMs: Date.now() - startedAt,
        });
      }

      // ── 5. execute with timeout + bounded retries ────────────────────────
      const retriesAllowed = this.retriesFor(tool);
      let lastError: NashrAgentError | undefined;

      for (let attempt = 0; attempt <= retriesAllowed; attempt++) {
        attempts = attempt + 1;
        budget.assertTimeRemaining();
        try {
          const output = await withTimeout(
            () => tool.handler(parsed as TIn, ctx),
            budget.sliceMs(),
            `tool ${tool.id}`
          );

          const validated = tool.outputSchema.safeParse(output);
          if (!validated.success) {
            throw new NashrAgentError(
              'INTERNAL',
              `output failed schema for ${tool.id}: ${summariseZodIssues(validated.error)}`
            );
          }

          await this.audit.record({
            organizationId: ctx.organizationId,
            userOrgId: ctx.userOrgId,
            agentKey,
            toolName: tool.id,
            sensitive: tool.sensitive,
            status: 'EXECUTED',
            args: parsed,
            result: validated.data,
            attempts,
            durationMs: Date.now() - startedAt,
          });

          return { status: 'ok', data: validated.data as TOut };
        } catch (err) {
          lastError = normalizeError(err);
          const canRetry = attempt < retriesAllowed && lastError.retriable;
          if (!canRetry) break;
          await this.sleep(backoffDelay(attempt, this.limits, this.random));
        }
      }

      throw lastError ?? new NashrAgentError('INTERNAL', 'tool produced no result');
    } catch (err) {
      const error = normalizeError(err);
      await this.audit.record({
        organizationId: ctx.organizationId,
        userOrgId: ctx.userOrgId,
        agentKey,
        toolName: tool.id,
        sensitive: tool.sensitive,
        status: error.status,
        args: parsed,
        error,
        attempts,
        durationMs: Date.now() - startedAt,
      });
      return { status: 'error', error: error.toSafe() };
    }
  }

  /** Reads and writes differ: a failed write must not be replayed blindly. */
  private retriesFor(tool: NashrToolDefinition): number {
    const idempotent =
      tool.idempotent ?? !INHERENTLY_SENSITIVE_CATEGORIES.includes(tool.category);
    return idempotent ? this.limits.maxRetries : 0;
  }

  private async createProposal<TIn>(
    agentKey: string,
    tool: NashrToolDefinition<TIn, any>,
    input: TIn,
    ctx: NashrToolContext
  ): Promise<ProposedAction> {
    const described = tool.describeProposal
      ? tool.describeProposal(input, ctx)
      : {
          title: tool.title,
          summary: `${tool.title} — review the details before approving.`,
          details: [],
          effect: tool.description,
          reversible: false,
        };

    const proposalId = newProposalId();
    const expiresAtMs = ctx.now.getTime() + this.limits.proposalTtlMs;

    const stored: StoredProposal = {
      proposalId,
      organizationId: ctx.organizationId,
      createdByUserId: ctx.userId,
      agentKey,
      toolId: tool.id,
      argsHash: hashArgs(input),
      state: 'PROPOSED',
      createdAt: ctx.now.toISOString(),
      expiresAt: new Date(expiresAtMs).toISOString(),
    };
    await this.proposals.save(stored);

    return {
      proposalId,
      agentKey,
      toolId: tool.id,
      title: described.title,
      // Redacted: the preview is shown to a human AND handed back to the model.
      summary: redactText(described.summary),
      details: described.details.map((d) => ({
        label: d.label,
        value: redactText(String(d.value)),
      })),
      effect: redactText(described.effect),
      reversible: described.reversible,
      expiresAt: new Date(expiresAtMs).toISOString(),
      requiresHumanApproval: true,
    };
  }

  /**
   * Verify signature, bind to the stored proposal, and consume it. Any failure
   * here means the handler is never reached.
   */
  private async consumeApproval<TIn>(
    confirmationToken: string,
    agentKey: string,
    tool: NashrToolDefinition<TIn, any>,
    input: TIn,
    ctx: NashrToolContext
  ): Promise<void> {
    const claims = verifyConfirmation(confirmationToken, ctx.now, this.secret());

    if (claims.organizationId !== ctx.organizationId) {
      throw crossTenant('confirmation issued for a different organization');
    }
    if (claims.toolId !== tool.id) {
      throw approvalInvalid('confirmation issued for a different tool');
    }
    if (claims.argsHash !== hashArgs(input)) {
      throw approvalInvalid('arguments changed after the action was approved');
    }

    const stored = await this.proposals.get(ctx.organizationId, claims.proposalId);
    if (!stored) throw approvalInvalid('proposal not found');
    if (stored.agentKey !== agentKey) {
      throw approvalInvalid('proposal belongs to a different agent');
    }
    if (stored.state !== 'APPROVED') {
      throw approvalInvalid(`proposal is in state ${stored.state}, not APPROVED`);
    }
    if (new Date(stored.expiresAt).getTime() <= ctx.now.getTime()) {
      await this.proposals.update(ctx.organizationId, claims.proposalId, {
        state: 'EXPIRED',
      });
      throw approvalInvalid('proposal expired');
    }
    if (!stored.approvedByUserId) {
      throw approvalInvalid('proposal carries no human approver');
    }

    // Consume BEFORE the handler runs: a crash mid-handler must not leave a
    // replayable approval behind.
    const consumed = await this.proposals.update(ctx.organizationId, claims.proposalId, {
      state: 'CONSUMED',
    });
    if (!consumed || consumed.state !== 'CONSUMED') {
      throw approvalInvalid('proposal could not be consumed');
    }
  }
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

export function splitGuardrailInput(rawInput: unknown): {
  toolInput: unknown;
  confirmationToken?: string;
} {
  if (rawInput === null || typeof rawInput !== 'object' || Array.isArray(rawInput)) {
    return { toolInput: rawInput };
  }
  const clone: Record<string, unknown> = { ...(rawInput as Record<string, unknown>) };
  const confirmationToken =
    typeof clone.confirmationToken === 'string' ? clone.confirmationToken : undefined;
  for (const key of GUARDRAIL_INPUT_KEYS) delete clone[key];
  return { toolInput: clone, confirmationToken };
}

function summariseZodIssues(error: { issues?: Array<{ path?: any[]; message?: string }> }): string {
  const issues = error?.issues ?? [];
  return issues
    .slice(0, 5)
    .map((i) => `${(i.path ?? []).join('.') || '(root)'}: ${i.message ?? 'invalid'}`)
    .join('; ');
}
