/**
 * Agent runtime.
 *
 * Owns the per-turn budget and is the single entry point the HTTP layer uses to
 * invoke a tool. Nothing calls `tool.handler` directly — `GuardrailRuntime`
 * does, and only after tenancy, schema, approval and limit checks have passed.
 */
import type {
  GuardedToolResult,
  NashrLocale,
  NashrMarketCode,
  NashrToolContext,
} from './types';
import { AgentRegistry } from './registry';
import type { RegisteredTool } from './registry';
import { GuardrailRuntime, NASHR_AGENT_LIMITS, TurnBudget } from './guardrails';
import type { NashrAgentLimits } from './guardrails';

export interface TurnRequest {
  organizationId: string;
  userOrgId?: string;
  userId?: string;
  locale?: NashrLocale;
  market?: NashrMarketCode;
  requestId: string;
  now?: Date;
}

export class NashrAgentRuntime {
  private readonly budgets = new Map<string, TurnBudget>();

  constructor(
    readonly registry: AgentRegistry,
    private readonly guardrails: GuardrailRuntime,
    private readonly limits: NashrAgentLimits = NASHR_AGENT_LIMITS
  ) {}

  /** One budget per requestId. Reused across the tool calls of a single turn. */
  budgetFor(requestId: string): TurnBudget {
    let budget = this.budgets.get(requestId);
    if (!budget) {
      budget = new TurnBudget(this.limits);
      this.budgets.set(requestId, budget);
    }
    return budget;
  }

  releaseTurn(requestId: string): void {
    this.budgets.delete(requestId);
  }

  toContext(request: TurnRequest): NashrToolContext {
    return {
      organizationId: request.organizationId,
      userOrgId: request.userOrgId,
      userId: request.userId,
      locale: request.locale ?? 'en',
      market: request.market ?? 'AE',
      requestId: request.requestId,
      now: request.now ?? new Date(),
    };
  }

  /**
   * Invoke a tool by id. `rawInput` may carry `confirmationToken`; the
   * guardrail strips it before the tool's own schema is applied.
   *
   * `toolId` is caller-supplied (the model picks it, and `POST
   * /nashr-agents/tools/:toolId` takes it from the URL), so an unknown id must
   * be an ordinary typed failure. Letting the registry's lookup error escape
   * would produce an unaudited rejection carrying an internal message — the one
   * thing this layer exists to prevent.
   */
  async invoke(
    toolId: string,
    rawInput: unknown,
    request: TurnRequest
  ): Promise<GuardedToolResult<unknown>> {
    const registered = this.lookup(toolId);
    if (!registered) return unknownTool();

    return this.guardrails.execute(
      registered.agentKey,
      registered.tool,
      rawInput,
      this.toContext(request),
      { budget: this.budgetFor(request.requestId) }
    );
  }

  /** Invoke a tool constrained to one agent, so a caller cannot reach across. */
  async invokeOnAgent(
    agentKey: string,
    toolId: string,
    rawInput: unknown,
    request: TurnRequest
  ): Promise<GuardedToolResult<unknown>> {
    const registered = this.lookup(toolId);
    if (!registered || registered.agentKey !== agentKey) return unknownTool();
    return this.invoke(toolId, rawInput, request);
  }

  private lookup(toolId: string): RegisteredTool | null {
    if (typeof toolId !== 'string' || !toolId) return null;
    try {
      return this.registry.tool(toolId);
    } catch {
      return null;
    }
  }
}

/** Single shape for "no such tool here", so callers cannot tell an unknown tool
 *  from one that exists on a different agent. */
function unknownTool(): GuardedToolResult<never> {
  return {
    status: 'error',
    error: { code: 'NOT_FOUND', message: 'That tool is not available on this agent.' },
  };
}
