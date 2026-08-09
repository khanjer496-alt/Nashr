/**
 * Production adapters.
 *
 * Each one implements a port from `ports.ts` over the existing Postiz data
 * layer. The single rule they all obey: **every query filters
 * `organizationId`.** The repo has no row-level security (AUDIT_REPORT §15,
 * S6), so tenancy is a property of these queries and nothing else.
 */
import { Injectable } from '@nestjs/common';
import {
  NashrMarket,
  NashrAgentStatus,
  NashrApprovalStage,
  NashrApprovalDecision,
  type Organization,
} from '@prisma/client';
import { PrismaService } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';
import { IntegrationService } from '@gitroom/nestjs-libraries/database/prisma/integrations/integration.service';
import { IntegrationManager } from '@gitroom/nestjs-libraries/integrations/integration.manager';
import type {
  ActionLogEntry,
  ActionLogPort,
  AnalyticsPort,
  ApprovalPort,
  ApprovalRecord,
  BrandProfilePort,
  BrandProfileRecord,
  BrandProfileWrite,
  ChannelAnalytics,
  ConnectedChannel,
  DraftPostInput,
  PostsPort,
} from '../ports';
import type {
  NashrAgentStatusValue,
  NashrApprovalDecisionValue,
  NashrApprovalStageValue,
  NashrMarketCode,
} from '../types';
import { notConfigured, notFound, upstreamUnavailable } from '../errors';

// ---------------------------------------------------------------------------
// Brand profile
// ---------------------------------------------------------------------------

interface BrandProfileRow {
  id: string;
  organizationId: string;
  customerId: string | null;
  brandName: string;
  brandNameAr: string | null;
  industry: string;
  market: NashrMarket;
  timezone: string;
  toneOfVoice: string | null;
  targetAudience: string | null;
  products: string | null;
  offers: string | null;
  prohibitedClaims: string | null;
  keywords: string | null;
}

const toRecord = (row: BrandProfileRow): BrandProfileRecord => ({
  id: row.id,
  organizationId: row.organizationId,
  customerId: row.customerId,
  brandName: row.brandName,
  brandNameAr: row.brandNameAr,
  industry: row.industry,
  market: row.market as NashrMarketCode,
  timezone: row.timezone,
  toneOfVoice: row.toneOfVoice,
  targetAudience: row.targetAudience,
  products: row.products,
  offers: row.offers,
  prohibitedClaims: row.prohibitedClaims,
  keywords: row.keywords,
});

@Injectable()
export class PrismaBrandProfilePort implements BrandProfilePort {
  constructor(private readonly prisma: PrismaService) {}

  async findForOrganization(
    organizationId: string,
    customerId?: string | null
  ): Promise<BrandProfileRecord | null> {
    const row = await this.prisma.nashrBrandProfile.findFirst({
      where: {
        organizationId,
        deletedAt: null,
        ...(customerId ? { customerId } : {}),
      },
      orderBy: { updatedAt: 'desc' },
    });
    return row ? toRecord(row) : null;
  }

  async listForOrganization(organizationId: string): Promise<BrandProfileRecord[]> {
    const rows = await this.prisma.nashrBrandProfile.findMany({
      where: { organizationId, deletedAt: null },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(toRecord);
  }

  async upsert(
    organizationId: string,
    data: BrandProfileWrite
  ): Promise<BrandProfileRecord> {
    const { customerId, market, ...rest } = data;
    const existing = await this.prisma.nashrBrandProfile.findFirst({
      where: {
        organizationId,
        deletedAt: null,
        ...(customerId ? { customerId } : {}),
      },
      orderBy: { updatedAt: 'desc' },
    });

    if (existing) {
      const updated = await this.prisma.nashrBrandProfile.update({
        // Composite guard: the id alone would be enough for Prisma but not for
        // review — the organizationId keeps the tenant filter visible.
        where: { id: existing.id, organizationId },
        data: {
          ...rest,
          ...(market ? { market: market as NashrMarket } : {}),
        },
      });
      return toRecord(updated);
    }

    if (!rest.brandName || !rest.industry) {
      throw notFound('a new brand profile needs at least brandName and industry');
    }

    const created = await this.prisma.nashrBrandProfile.create({
      data: {
        organizationId,
        customerId: customerId ?? null,
        brandName: rest.brandName,
        industry: rest.industry,
        brandNameAr: rest.brandNameAr ?? null,
        market: (market ?? 'AE') as NashrMarket,
        timezone: rest.timezone ?? 'Asia/Dubai',
        toneOfVoice: rest.toneOfVoice ?? null,
        targetAudience: rest.targetAudience ?? null,
        products: rest.products ?? null,
        offers: rest.offers ?? null,
        prohibitedClaims: rest.prohibitedClaims ?? null,
        keywords: rest.keywords ?? null,
      },
    });
    return toRecord(created);
  }

  async softDelete(
    organizationId: string,
    profileId: string
  ): Promise<{ deleted: boolean }> {
    const result = await this.prisma.nashrBrandProfile.updateMany({
      where: { id: profileId, organizationId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    return { deleted: result.count > 0 };
  }
}

// ---------------------------------------------------------------------------
// Action log
// ---------------------------------------------------------------------------

@Injectable()
export class PrismaActionLogPort implements ActionLogPort {
  constructor(private readonly prisma: PrismaService) {}

  async record(entry: ActionLogEntry): Promise<{ id: string }> {
    const created = await this.prisma.nashrAgentActionLog.create({
      data: {
        organizationId: entry.organizationId,
        userOrgId: entry.userOrgId ?? null,
        agentKey: entry.agentKey,
        toolName: entry.toolName,
        sensitive: entry.sensitive,
        status: toPrismaStatus(entry.status),
        argsDigest: entry.argsDigest ?? null,
        resultSummary: entry.resultSummary ?? null,
        errorMessage: entry.errorMessage ?? null,
        attempts: entry.attempts,
        durationMs: entry.durationMs ?? null,
      },
      select: { id: true },
    });
    return created;
  }
}

function toPrismaStatus(status: NashrAgentStatusValue): NashrAgentStatus {
  return NashrAgentStatus[status];
}

// ---------------------------------------------------------------------------
// Analytics
// ---------------------------------------------------------------------------

@Injectable()
export class IntegrationAnalyticsPort implements AnalyticsPort {
  constructor(
    private readonly prisma: PrismaService,
    private readonly integrations: IntegrationService,
    private readonly integrationManager: IntegrationManager
  ) {}

  /** Only 11 of the 34 shipped providers implement `analytics()`. That fact is
   *  read off the provider, never assumed. */
  private supportsAnalytics(providerIdentifier: string): boolean {
    const provider = this.integrationManager.getSocialIntegration(providerIdentifier);
    return typeof provider?.analytics === 'function';
  }

  async listChannels(
    organizationId: string,
    customerId?: string | null
  ): Promise<ConnectedChannel[]> {
    const list = await this.integrations.getIntegrationsList(organizationId);
    return list
      .filter((i) => (customerId ? i.customerId === customerId : true))
      .map((i) => ({
        integrationId: i.id,
        providerIdentifier: i.providerIdentifier,
        name: i.name,
        supportsAnalytics: this.supportsAnalytics(i.providerIdentifier),
        disabled: i.disabled || i.refreshNeeded || false,
      }));
  }

  async fetchChannelAnalytics(
    organizationId: string,
    integrationId: string,
    days: number
  ): Promise<ChannelAnalytics> {
    const organization: Organization | null =
      await this.prisma.organization.findUnique({ where: { id: organizationId } });
    if (!organization) throw notFound('organization not found');

    const integration = await this.integrations.getIntegrationById(
      organizationId,
      integrationId
    );
    if (!integration) throw notFound('channel not found in this workspace');

    let raw: Array<{ label: string; data: Array<{ total: string; date: string }>; percentageChange: number }>;
    try {
      raw = await this.integrations.checkAnalytics(
        organization,
        integrationId,
        String(days)
      );
    } catch (e) {
      // Provider text can carry tokens and URLs. It stops here.
      throw upstreamUnavailable(e instanceof Error ? e.message : String(e));
    }

    return {
      integrationId,
      providerIdentifier: integration.providerIdentifier,
      name: integration.name,
      metrics: (raw ?? []).map((metric) => ({
        label: metric.label,
        points: (metric.data ?? [])
          .map((point) => ({ date: point.date, total: Number(point.total) }))
          // A non-numeric total is dropped rather than coerced to 0 — a zero we
          // invented would be indistinguishable from a real one.
          .filter((point) => Number.isFinite(point.total)),
        percentageChange: metric.percentageChange,
      })),
    };
  }
}

// ---------------------------------------------------------------------------
// Posts
// ---------------------------------------------------------------------------

/**
 * Draft creation and scheduling.
 *
 * `scheduleDrafts` is intentionally NOT implemented here. Publishing in Nashr
 * is gated on a `NashrPostApproval` row at stage APPROVED, enforced in the
 * Temporal publish activity (MENA_CUSTOMIZATIONS.md). Wiring scheduling from
 * this library before `libraries/nashr-approval` lands would create a second
 * path to the queue that does not traverse that chokepoint. It therefore fails
 * closed with NOT_CONFIGURED until the approval library exposes a scheduling
 * entry point. See README → "Integration points".
 */
@Injectable()
export class UnconfiguredPostsPort implements PostsPort {
  async createDraft(
    _organizationId: string,
    _input: DraftPostInput
  ): Promise<{ id: string; state: string }> {
    throw notConfigured('draft creation is not wired to PostsService yet');
  }

  async scheduleDrafts(
    _organizationId: string,
    _postIds: string[],
    _timezone: string
  ): Promise<{ scheduled: number }> {
    throw notConfigured(
      'scheduling must go through the Nashr approval chokepoint; not wired yet'
    );
  }
}

// ---------------------------------------------------------------------------
// Approval
// ---------------------------------------------------------------------------

/**
 * Minimal adapter over the `NashrPostApproval` table so the Approval agent is
 * useful today. `libraries/nashr-approval` owns the real workflow — its
 * notifications, stage transition rules and role checks. When it ships, replace
 * this binding in `NashrAgentsService` with theirs; the port contract does not
 * change.
 *
 * Note what this adapter deliberately does NOT do: it never derives an
 * approval. `recordDecision` writes exactly the decision it is given, with the
 * actorId the agent layer already verified is the signed-in human.
 */
@Injectable()
export class PrismaApprovalPort implements ApprovalPort {
  constructor(private readonly prisma: PrismaService) {}

  async getForPost(organizationId: string, postId: string): Promise<ApprovalRecord[]> {
    const rows = await this.prisma.nashrPostApproval.findMany({
      where: { organizationId, postId },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(toApprovalRecord);
  }

  async listPending(
    organizationId: string,
    stage?: NashrApprovalStageValue
  ): Promise<Array<{ postId: string; stage: NashrApprovalStageValue; updatedAt: string }>> {
    const rows = await this.prisma.nashrPostApproval.findMany({
      where: {
        organizationId,
        stage: stage
          ? NashrApprovalStage[stage]
          : { in: [NashrApprovalStage.INTERNAL_REVIEW, NashrApprovalStage.CLIENT_APPROVAL] },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    // Only the latest row per post represents the current stage.
    const latest = new Map<string, (typeof rows)[number]>();
    for (const row of rows) {
      if (!latest.has(row.postId)) latest.set(row.postId, row);
    }
    return [...latest.values()].map((row) => ({
      postId: row.postId,
      stage: row.stage as NashrApprovalStageValue,
      updatedAt: row.createdAt.toISOString(),
    }));
  }

  async submitForReview(
    organizationId: string,
    postId: string,
    stage: 'INTERNAL_REVIEW' | 'CLIENT_APPROVAL',
    actorId: string,
    note?: string
  ): Promise<ApprovalRecord> {
    await this.assertPostInOrganization(organizationId, postId);
    const created = await this.prisma.nashrPostApproval.create({
      data: {
        postId,
        organizationId,
        stage: NashrApprovalStage[stage],
        decision: NashrApprovalDecision.SUBMITTED,
        actorId,
        note: note ?? null,
      },
    });
    return toApprovalRecord(created);
  }

  async recordDecision(
    organizationId: string,
    postId: string,
    decision: NashrApprovalDecisionValue,
    actorId: string,
    note?: string
  ): Promise<ApprovalRecord> {
    await this.assertPostInOrganization(organizationId, postId);
    const created = await this.prisma.nashrPostApproval.create({
      data: {
        postId,
        organizationId,
        stage: STAGE_FOR_DECISION[decision],
        decision: NashrApprovalDecision[decision],
        actorId,
        note: note ?? null,
      },
    });
    return toApprovalRecord(created);
  }

  /** The post must belong to the caller's organisation. Without this a post id
   *  from another tenant would be written into this tenant's trail. */
  private async assertPostInOrganization(organizationId: string, postId: string) {
    const post = await this.prisma.post.findFirst({
      where: { id: postId, organizationId },
      select: { id: true },
    });
    if (!post) throw notFound('post not found in this workspace');
  }
}

const STAGE_FOR_DECISION: Record<NashrApprovalDecisionValue, NashrApprovalStage> = {
  SUBMITTED: NashrApprovalStage.INTERNAL_REVIEW,
  APPROVED: NashrApprovalStage.APPROVED,
  CHANGES_REQUESTED: NashrApprovalStage.CHANGES_REQUESTED,
  REJECTED: NashrApprovalStage.REJECTED,
  WITHDRAWN: NashrApprovalStage.DRAFT,
};

function toApprovalRecord(row: {
  id: string;
  postId: string;
  organizationId: string;
  stage: NashrApprovalStage;
  decision: NashrApprovalDecision;
  actorId: string | null;
  note: string | null;
  createdAt: Date;
}): ApprovalRecord {
  return {
    id: row.id,
    postId: row.postId,
    organizationId: row.organizationId,
    stage: row.stage as NashrApprovalStageValue,
    decision: row.decision as NashrApprovalDecisionValue,
    actorId: row.actorId,
    note: row.note,
    createdAt: row.createdAt.toISOString(),
  };
}
