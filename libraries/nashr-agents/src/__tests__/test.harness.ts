/**
 * Shared fakes for the guardrail tests.
 *
 * Everything here is in-memory. The point of the suite is to prove the
 * guardrails hold, so nothing may depend on a database, a network call or a
 * model provider.
 */
import { z } from 'zod';
import type {
  AgentPorts,
  AnalyticsPort,
  ApprovalPort,
  ApprovalRecord,
  BrandProfilePort,
  BrandProfileRecord,
  BrandProfileWrite,
  ChannelAnalytics,
  ConnectedChannel,
  DraftPostInput,
  HijriPort,
  ModelPort,
  ModelRequest,
  ModelResponse,
  PostsPort,
} from '../ports';
import type {
  NashrApprovalDecisionValue,
  NashrApprovalStageValue,
  NashrToolContext,
  NashrToolDefinition,
} from '../types';
import { AuditLogger, InMemoryActionLog } from '../audit';
import { GuardrailRuntime, NASHR_AGENT_LIMITS } from '../guardrails';
import type { NashrAgentLimits } from '../guardrails';
import { InMemoryProposalStore, signConfirmation } from '../proposals';
import { IntlHijriAdapter } from '../hijri';

export const TEST_SECRET = 'test-proposal-secret-0123456789';
export const ORG_A = 'org-aaaaaaaa';
export const ORG_B = 'org-bbbbbbbb';
export const USER_A = 'user-aaaaaaaa';

export function makeContext(overrides: Partial<NashrToolContext> = {}): NashrToolContext {
  return {
    organizationId: ORG_A,
    userOrgId: 'userorg-a',
    userId: USER_A,
    locale: 'en',
    market: 'AE',
    requestId: 'req-1',
    now: new Date('2026-08-08T09:00:00.000Z'),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Fake ports
// ---------------------------------------------------------------------------

export class FakeBrandProfilePort implements BrandProfilePort {
  readonly rows: BrandProfileRecord[] = [];
  /** Records every organizationId the port was queried with. */
  readonly seenOrgIds: string[] = [];

  seed(record: BrandProfileRecord) {
    this.rows.push(record);
    return this;
  }

  async findForOrganization(organizationId: string, customerId?: string | null) {
    this.seenOrgIds.push(organizationId);
    return (
      this.rows.find(
        (r) =>
          r.organizationId === organizationId &&
          (customerId ? r.customerId === customerId : true)
      ) ?? null
    );
  }

  async listForOrganization(organizationId: string) {
    this.seenOrgIds.push(organizationId);
    return this.rows.filter((r) => r.organizationId === organizationId);
  }

  async upsert(organizationId: string, data: BrandProfileWrite) {
    this.seenOrgIds.push(organizationId);
    const existing = this.rows.find((r) => r.organizationId === organizationId);
    if (existing) {
      Object.assign(existing, data);
      return existing;
    }
    const created: BrandProfileRecord = {
      id: `bp-${this.rows.length + 1}`,
      organizationId,
      customerId: data.customerId ?? null,
      brandName: data.brandName ?? 'Untitled',
      brandNameAr: data.brandNameAr ?? null,
      industry: data.industry ?? 'general',
      market: data.market ?? 'AE',
      timezone: data.timezone ?? 'Asia/Dubai',
      toneOfVoice: data.toneOfVoice ?? null,
      targetAudience: data.targetAudience ?? null,
      products: data.products ?? null,
      offers: data.offers ?? null,
      prohibitedClaims: data.prohibitedClaims ?? null,
      keywords: data.keywords ?? null,
    };
    this.rows.push(created);
    return created;
  }

  async softDelete(organizationId: string, profileId: string) {
    this.seenOrgIds.push(organizationId);
    const index = this.rows.findIndex(
      (r) => r.id === profileId && r.organizationId === organizationId
    );
    if (index === -1) return { deleted: false };
    this.rows.splice(index, 1);
    return { deleted: true };
  }
}

export class FakePostsPort implements PostsPort {
  readonly drafts: Array<{ organizationId: string; input: DraftPostInput }> = [];
  readonly scheduled: Array<{ organizationId: string; postIds: string[] }> = [];

  async createDraft(organizationId: string, input: DraftPostInput) {
    this.drafts.push({ organizationId, input });
    return { id: `post-${this.drafts.length}`, state: 'DRAFT' };
  }

  async scheduleDrafts(organizationId: string, postIds: string[]) {
    this.scheduled.push({ organizationId, postIds });
    return { scheduled: postIds.length };
  }
}

export class FakeAnalyticsPort implements AnalyticsPort {
  channels: ConnectedChannel[] = [];
  data = new Map<string, ChannelAnalytics>();
  failing = new Set<string>();

  async listChannels(_organizationId: string) {
    return this.channels;
  }

  async fetchChannelAnalytics(_organizationId: string, integrationId: string) {
    if (this.failing.has(integrationId)) {
      throw new Error('provider exploded: token sk-proj-abcdef1234567890 rejected');
    }
    const found = this.data.get(integrationId);
    if (!found) throw new Error('no data');
    return found;
  }
}

export class FakeApprovalPort implements ApprovalPort {
  readonly records: ApprovalRecord[] = [];

  async getForPost(organizationId: string, postId: string) {
    return this.records.filter(
      (r) => r.organizationId === organizationId && r.postId === postId
    );
  }

  async listPending(organizationId: string, stage?: NashrApprovalStageValue) {
    return this.records
      .filter((r) => r.organizationId === organizationId)
      .filter((r) => (stage ? r.stage === stage : true))
      .map((r) => ({ postId: r.postId, stage: r.stage, updatedAt: r.createdAt }));
  }

  async submitForReview(
    organizationId: string,
    postId: string,
    stage: 'INTERNAL_REVIEW' | 'CLIENT_APPROVAL',
    actorId: string,
    note?: string
  ) {
    const record: ApprovalRecord = {
      id: `ap-${this.records.length + 1}`,
      postId,
      organizationId,
      stage,
      decision: 'SUBMITTED',
      actorId,
      note: note ?? null,
      createdAt: new Date().toISOString(),
    };
    this.records.push(record);
    return record;
  }

  async recordDecision(
    organizationId: string,
    postId: string,
    decision: NashrApprovalDecisionValue,
    actorId: string,
    note?: string
  ) {
    const record: ApprovalRecord = {
      id: `ap-${this.records.length + 1}`,
      postId,
      organizationId,
      stage: decision === 'APPROVED' ? 'APPROVED' : 'CHANGES_REQUESTED',
      decision,
      actorId,
      note: note ?? null,
      createdAt: new Date().toISOString(),
    };
    this.records.push(record);
    return record;
  }
}

export class FakeModelPort implements ModelPort {
  readonly requests: ModelRequest[] = [];
  response = 'ok';
  shouldFail = false;

  async generate(request: ModelRequest): Promise<ModelResponse> {
    this.requests.push(request);
    if (this.shouldFail) {
      throw new Error('provider 401: invalid api key sk-proj-SECRETSECRETSECRET');
    }
    return { text: this.response, usage: { inputTokens: 10, outputTokens: 10 } };
  }
}

export function makePorts(overrides: Partial<AgentPorts> = {}): AgentPorts {
  return {
    brand: new FakeBrandProfilePort(),
    posts: new FakePostsPort(),
    analytics: new FakeAnalyticsPort(),
    approval: new FakeApprovalPort(),
    hijri: new IntlHijriAdapter() as HijriPort,
    model: new FakeModelPort(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Guardrail harness
// ---------------------------------------------------------------------------

export interface Harness {
  runtime: GuardrailRuntime;
  log: InMemoryActionLog;
  proposals: InMemoryProposalStore;
  sleeps: number[];
  /** Simulates the HTTP approve endpoint: a human approves, a token is minted. */
  humanApproves(
    proposalId: string,
    organizationId: string,
    userId: string
  ): Promise<string>;
}

export function makeHarness(limits: Partial<NashrAgentLimits> = {}): Harness {
  const log = new InMemoryActionLog();
  const proposals = new InMemoryProposalStore();
  const sleeps: number[] = [];

  const runtime = new GuardrailRuntime({
    audit: new AuditLogger(log, { onAuditFailure: () => undefined }),
    proposals,
    limits: { ...NASHR_AGENT_LIMITS, ...limits },
    sleep: async (ms) => {
      sleeps.push(ms);
    },
    random: () => 0.5,
    secret: () => TEST_SECRET,
  });

  return {
    runtime,
    log,
    proposals,
    sleeps,
    async humanApproves(proposalId, organizationId, userId) {
      const stored = await proposals.get(organizationId, proposalId);
      if (!stored) throw new Error('proposal missing in test harness');
      await proposals.update(organizationId, proposalId, {
        state: 'APPROVED',
        approvedByUserId: userId,
        approvedAt: new Date().toISOString(),
      });
      return signConfirmation(
        {
          proposalId: stored.proposalId,
          organizationId,
          toolId: stored.toolId,
          argsHash: stored.argsHash,
          approvedByUserId: userId,
          expiresAt: new Date(stored.expiresAt).getTime(),
        },
        TEST_SECRET
      );
    },
  };
}

// ---------------------------------------------------------------------------
// Tool builders
// ---------------------------------------------------------------------------

export function readTool(
  handler: (input: { value?: string }, ctx: NashrToolContext) => Promise<unknown>
): NashrToolDefinition<{ value?: string }, unknown> {
  return {
    id: 'testRead',
    title: 'Test read',
    description: 'A read tool used by the guardrail tests.',
    category: 'read',
    sensitive: false,
    capability: 'brand.read',
    inputSchema: z.object({ value: z.string().optional() }),
    outputSchema: z.unknown(),
    handler,
  };
}

export function sensitiveTool(
  handler: (input: { target: string }, ctx: NashrToolContext) => Promise<{ done: boolean }>
): NashrToolDefinition<{ target: string }, { done: boolean }> {
  return {
    id: 'testPublish',
    title: 'Test publish',
    description: 'A sensitive tool used by the guardrail tests.',
    category: 'publish',
    sensitive: true,
    capability: 'calendar.schedule',
    inputSchema: z.object({ target: z.string() }),
    outputSchema: z.object({ done: z.boolean() }),
    describeProposal: (input) => ({
      title: 'Publish',
      summary: `Publish to ${input.target}`,
      details: [{ label: 'Target', value: input.target }],
      effect: 'The post goes live.',
      reversible: false,
    }),
    handler,
  };
}
