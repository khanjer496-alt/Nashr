/**
 * Nashr agents — shared types.
 *
 * These types are deliberately free of NestJS, Prisma and Mastra imports so the
 * guardrail core can be unit-tested without a database, a model provider or a
 * DI container. Runtime bindings live in `mastra.binding.ts` and `adapters/`.
 */
import type { ZodType } from 'zod';

/** Mirrors `enum NashrMarket` in schema.prisma. Kept as a literal union so the
 *  guardrail core does not have to import `@prisma/client`. */
export type NashrMarketCode = 'AE' | 'SA' | 'KW' | 'QA' | 'BH' | 'OM' | 'EG' | 'JO';

export const NASHR_MARKETS: readonly NashrMarketCode[] = [
  'AE',
  'SA',
  'KW',
  'QA',
  'BH',
  'OM',
  'EG',
  'JO',
] as const;

/** Mirrors `enum NashrAgentStatus` in schema.prisma. */
export type NashrAgentStatusValue =
  | 'PROPOSED'
  | 'AWAITING_APPROVAL'
  | 'APPROVED'
  | 'EXECUTED'
  | 'REJECTED'
  | 'FAILED'
  | 'TIMED_OUT';

/** Mirrors `enum NashrApprovalStage`. Used by the Approval agent only. */
export type NashrApprovalStageValue =
  | 'DRAFT'
  | 'INTERNAL_REVIEW'
  | 'CLIENT_APPROVAL'
  | 'APPROVED'
  | 'CHANGES_REQUESTED'
  | 'REJECTED';

/** Mirrors `enum NashrApprovalDecision`. */
export type NashrApprovalDecisionValue =
  | 'SUBMITTED'
  | 'APPROVED'
  | 'CHANGES_REQUESTED'
  | 'REJECTED'
  | 'WITHDRAWN';

export type NashrLocale = 'en' | 'ar';

/**
 * Capabilities are declared per agent in `registry.ts`. Every tool must map to
 * a capability its owning agent declares — that is the mechanism that keeps a
 * newly added agent from quietly acquiring reach it never advertised.
 */
export type AgentCapability =
  | 'brand.read'
  | 'brand.write'
  | 'content.generate'
  | 'content.write'
  | 'localization.adapt'
  | 'calendar.propose'
  | 'calendar.schedule'
  | 'approval.read'
  | 'approval.route'
  | 'analytics.read';

/**
 * Tool categories. The registry treats `write | publish | delete | message |
 * schedule | campaign` as *inherently sensitive*: declaring such a tool with
 * `sensitive: false` is a registration-time error, not a runtime warning.
 */
export type ToolCategory =
  | 'read'
  | 'generate'
  | 'write'
  | 'publish'
  | 'delete'
  | 'message'
  | 'schedule'
  | 'campaign';

export const INHERENTLY_SENSITIVE_CATEGORIES: readonly ToolCategory[] = [
  'write',
  'publish',
  'delete',
  'message',
  'schedule',
  'campaign',
] as const;

/**
 * The execution context for one tool call. `organizationId` is the tenant
 * boundary; nothing in this library reads data without it.
 */
export interface NashrToolContext {
  /** Tenant boundary. Required, never optional, never inferred from input. */
  organizationId: string;
  /** `UserOrganization.id` of the acting human, when there is one. */
  userOrgId?: string;
  /** `User.id` of the acting human. Used to block agent self-approval. */
  userId?: string;
  locale: NashrLocale;
  market: NashrMarketCode;
  requestId: string;
  /** Injected clock — makes TTL and calendar behaviour deterministic in tests. */
  now: Date;
}

/** A human-readable, redacted description of what a sensitive tool would do. */
export interface ProposedAction {
  proposalId: string;
  agentKey: string;
  toolId: string;
  title: string;
  /** Short sentence in the requesting user's locale. Redacted. */
  summary: string;
  /** Field-by-field preview. Values are already redacted. */
  details: Array<{ label: string; value: string }>;
  /** Plain-language statement of what changes if the human approves. */
  effect: string;
  reversible: boolean;
  expiresAt: string;
  /** Always true for a proposal — restated so the UI can assert it. */
  requiresHumanApproval: true;
}

export interface SafeError {
  code: string;
  /** Safe to show a user and safe to hand back to the model. */
  message: string;
}

export type GuardedToolResult<T> =
  | { status: 'ok'; data: T }
  | { status: 'awaiting_approval'; proposal: ProposedAction }
  | { status: 'error'; error: SafeError };

/**
 * A registered tool. `handler` is only ever reached when the guardrails have
 * already validated input, tenancy, and (for sensitive tools) human approval.
 */
export interface NashrToolDefinition<TIn = any, TOut = any> {
  id: string;
  title: string;
  description: string;
  category: ToolCategory;
  /** Must be `true` for every inherently sensitive category. */
  sensitive: boolean;
  capability: AgentCapability;
  inputSchema: ZodType<TIn>;
  outputSchema: ZodType<TOut>;
  /** Marks the tool as safe to retry on transient failure. Reads/generation
   *  default to retriable; writes do not, to avoid duplicate side effects. */
  idempotent?: boolean;
  /** Builds the human-facing proposal. Required for sensitive tools. */
  describeProposal?: (
    input: TIn,
    ctx: NashrToolContext
  ) => Omit<ProposedAction, 'proposalId' | 'agentKey' | 'toolId' | 'expiresAt' | 'requiresHumanApproval'>;
  handler: (input: TIn, ctx: NashrToolContext) => Promise<TOut>;
}

/** An agent is a data entry: metadata + capabilities + tools. No subclassing. */
export interface AgentDefinition {
  key: string;
  name: string;
  nameAr?: string;
  description: string;
  /** The complete set of capabilities this agent may exercise. */
  capabilities: AgentCapability[];
  /** Static portion of the system prompt. Brand grounding and the guardrail
   *  preamble are prepended by `buildSystemPrompt` — agents never do it. */
  instructions: string;
  tools: NashrToolDefinition[];
  /** Model tier hint; resolved to a concrete model id at binding time. */
  modelTier?: 'fast' | 'standard';
}
