/**
 * Ports — the narrow interfaces this library depends on.
 *
 * Every port method takes `organizationId` as its FIRST argument. That is not
 * decoration: it is the contract that makes tenant scoping reviewable. An
 * adapter that ignores it is a cross-tenant leak, and the port shape makes that
 * omission visible in review.
 *
 * Ports also keep this library decoupled from work owned by other engineers:
 * `ApprovalPort` (libraries/nashr-approval) and `HijriPort`
 * (libraries/nashr-i18n) are consumed through these interfaces, so neither has
 * to exist for this code to compile or for its tests to run.
 */
import type {
  NashrApprovalDecisionValue,
  NashrApprovalStageValue,
  NashrAgentStatusValue,
  NashrMarketCode,
  NashrLocale,
} from './types';

// ---------------------------------------------------------------------------
// Brand profile
// ---------------------------------------------------------------------------

/**
 * The ONLY brand fields any prompt may ever see. Anything not on this list
 * (ids, timestamps, `customerId`, `organizationId`) never reaches a model.
 * See `grounding.ts` → `toBrandGrounding`.
 */
export const BRAND_PROMPT_FIELDS = [
  'brandName',
  'brandNameAr',
  'industry',
  'market',
  'timezone',
  'toneOfVoice',
  'targetAudience',
  'products',
  'offers',
  'prohibitedClaims',
  'keywords',
] as const;

export type BrandPromptField = (typeof BRAND_PROMPT_FIELDS)[number];

export interface BrandProfileRecord {
  id: string;
  organizationId: string;
  customerId?: string | null;
  brandName: string;
  brandNameAr?: string | null;
  industry: string;
  market: NashrMarketCode;
  timezone: string;
  toneOfVoice?: string | null;
  targetAudience?: string | null;
  products?: string | null;
  offers?: string | null;
  /** Newline-separated claims the agents must never make. */
  prohibitedClaims?: string | null;
  keywords?: string | null;
}

export type BrandProfileWrite = Partial<
  Pick<
    BrandProfileRecord,
    | 'brandName'
    | 'brandNameAr'
    | 'industry'
    | 'market'
    | 'timezone'
    | 'toneOfVoice'
    | 'targetAudience'
    | 'products'
    | 'offers'
    | 'prohibitedClaims'
    | 'keywords'
  >
> & { customerId?: string | null };

export interface BrandProfilePort {
  findForOrganization(
    organizationId: string,
    customerId?: string | null
  ): Promise<BrandProfileRecord | null>;
  listForOrganization(organizationId: string): Promise<BrandProfileRecord[]>;
  upsert(
    organizationId: string,
    data: BrandProfileWrite
  ): Promise<BrandProfileRecord>;
  softDelete(organizationId: string, profileId: string): Promise<{ deleted: boolean }>;
}

// ---------------------------------------------------------------------------
// Content / posts
// ---------------------------------------------------------------------------

export interface DraftPostInput {
  customerId?: string | null;
  integrationIds: string[];
  contentEn?: string;
  contentAr?: string;
  publishDate?: string;
  tags?: string[];
}

export interface PostsPort {
  createDraft(
    organizationId: string,
    input: DraftPostInput
  ): Promise<{ id: string; state: string }>;
  /** Used by the calendar agent's sensitive `scheduleCalendar` tool. */
  scheduleDrafts(
    organizationId: string,
    postIds: string[],
    timezone: string
  ): Promise<{ scheduled: number }>;
}

// ---------------------------------------------------------------------------
// Analytics
// ---------------------------------------------------------------------------

export interface ConnectedChannel {
  integrationId: string;
  providerIdentifier: string;
  name: string;
  /** True only when the provider implements `analytics()` upstream. */
  supportsAnalytics: boolean;
  disabled?: boolean;
}

export interface ChannelMetric {
  label: string;
  /** Real values only. An empty array means "no data", never "assume zero". */
  points: Array<{ date: string; total: number }>;
  percentageChange?: number;
}

export interface ChannelAnalytics {
  integrationId: string;
  providerIdentifier: string;
  name: string;
  metrics: ChannelMetric[];
}

export interface AnalyticsPort {
  listChannels(organizationId: string, customerId?: string | null): Promise<ConnectedChannel[]>;
  /** MUST return only what the provider actually returned. Never synthesise. */
  fetchChannelAnalytics(
    organizationId: string,
    integrationId: string,
    days: number
  ): Promise<ChannelAnalytics>;
}

// ---------------------------------------------------------------------------
// Approval — implemented by libraries/nashr-approval (owned by another engineer)
// ---------------------------------------------------------------------------

export interface ApprovalRecord {
  id: string;
  postId: string;
  organizationId: string;
  stage: NashrApprovalStageValue;
  decision: NashrApprovalDecisionValue;
  actorId?: string | null;
  note?: string | null;
  createdAt: string;
}

export interface ApprovalPort {
  getForPost(organizationId: string, postId: string): Promise<ApprovalRecord[]>;
  listPending(
    organizationId: string,
    stage?: NashrApprovalStageValue
  ): Promise<Array<{ postId: string; stage: NashrApprovalStageValue; updatedAt: string }>>;
  /** Moves a post into a review stage. Routing only — never a decision. */
  submitForReview(
    organizationId: string,
    postId: string,
    stage: Extract<NashrApprovalStageValue, 'INTERNAL_REVIEW' | 'CLIENT_APPROVAL'>,
    actorId: string,
    note?: string
  ): Promise<ApprovalRecord>;
  /**
   * Records a decision an identified human already made.
   * `actorId` is the human. The agent layer refuses to call this with an
   * actorId it cannot tie to the confirming human — see
   * `agents/approval.agent.ts` → assertHumanActor.
   */
  recordDecision(
    organizationId: string,
    postId: string,
    decision: NashrApprovalDecisionValue,
    actorId: string,
    note?: string
  ): Promise<ApprovalRecord>;
}

// ---------------------------------------------------------------------------
// Hijri — implemented by libraries/nashr-i18n/src/hijri.ts (another engineer)
// ---------------------------------------------------------------------------

export interface HijriDate {
  year: number;
  /** 1 = Muharram … 9 = Ramadan … 12 = Dhu al-Hijjah */
  month: number;
  day: number;
}

export interface MenaObservance {
  key: string;
  nameEn: string;
  nameAr: string;
  /** ISO date (approximate for lunar observances — flagged by `approximate`). */
  date: string;
  approximate: boolean;
  /** Markets the observance applies to; empty = all. */
  markets: NashrMarketCode[];
}

export interface HijriPort {
  toHijri(date: Date): HijriDate;
  /** Observances overlapping [from, to]. */
  observancesBetween(
    from: Date,
    to: Date,
    market: NashrMarketCode
  ): MenaObservance[];
}

// ---------------------------------------------------------------------------
// Model
// ---------------------------------------------------------------------------

export interface ModelRequest {
  system: string;
  prompt: string;
  /** Hard ceiling for this single call. */
  maxOutputTokens: number;
  temperature?: number;
  locale?: NashrLocale;
}

export interface ModelResponse {
  text: string;
  usage?: { inputTokens?: number; outputTokens?: number };
}

/**
 * Narrow model interface. Agents never touch an SDK directly; they go through
 * `GroundedModel` (grounding.ts), which is the component that guarantees brand
 * prohibited-claims are present in every system prompt.
 */
export interface ModelPort {
  generate(request: ModelRequest): Promise<ModelResponse>;
}

// ---------------------------------------------------------------------------
// Audit + proposals
// ---------------------------------------------------------------------------

export interface ActionLogEntry {
  organizationId: string;
  userOrgId?: string | null;
  agentKey: string;
  toolName: string;
  sensitive: boolean;
  status: NashrAgentStatusValue;
  argsDigest?: string | null;
  resultSummary?: string | null;
  errorMessage?: string | null;
  attempts: number;
  durationMs?: number | null;
}

/** Backed by Prisma `nashrAgentActionLog` in production. */
export interface ActionLogPort {
  record(entry: ActionLogEntry): Promise<{ id: string }>;
}

export type ProposalState = 'PROPOSED' | 'APPROVED' | 'REJECTED' | 'CONSUMED' | 'EXPIRED';

export interface StoredProposal {
  proposalId: string;
  organizationId: string;
  createdByUserId?: string;
  agentKey: string;
  toolId: string;
  /** Hash of the exact arguments proposed. Approval is bound to these bytes. */
  argsHash: string;
  state: ProposalState;
  createdAt: string;
  expiresAt: string;
  approvedByUserId?: string;
  approvedAt?: string;
}

export interface ProposalStorePort {
  save(proposal: StoredProposal): Promise<void>;
  get(organizationId: string, proposalId: string): Promise<StoredProposal | null>;
  update(
    organizationId: string,
    proposalId: string,
    patch: Partial<StoredProposal>
  ): Promise<StoredProposal | null>;
}

// ---------------------------------------------------------------------------
// Bundle handed to agent factories
// ---------------------------------------------------------------------------

export interface AgentPorts {
  brand: BrandProfilePort;
  posts: PostsPort;
  analytics: AnalyticsPort;
  approval: ApprovalPort;
  hijri: HijriPort;
  model: ModelPort;
}
