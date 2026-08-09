/**
 * Nashr (نشر) — the publish gate.
 *
 * This is the check that actually stops an unapproved post from going out. It
 * is called from the Temporal publish activity, which is the single chokepoint
 * every `CreationMethod` (WEB, API, MCP, AUTOPOST, CLI) has to traverse — a UI
 * check alone would be bypassed by the public API and by the MCP tools.
 *
 * Written as a port + adapter so the activity does not need a new NestJS
 * provider registered (it can build the adapter from the globally-provided
 * PrismaRepository), and so the decision logic can be unit-tested with a fake.
 */

import {
  NashrApprovalStageName,
  INITIAL_STAGE,
  canSchedule,
} from './state-machine';
import { EnvLike, resolveAutonomyPolicy } from './autonomy.policy';

export interface ApprovalGatePort {
  /**
   * Resolve the thread root for a post (approvals are recorded against the
   * root, not against each comment in a thread) plus its owning organization.
   * Returns null when the post does not exist.
   */
  loadPostRoot(
    postId: string
  ): Promise<{ rootPostId: string; organizationId: string } | null>;

  /** Stage of the most recent approval row, or null when there are none. */
  loadLatestStage(
    organizationId: string,
    rootPostId: string
  ): Promise<NashrApprovalStageName | null>;
}

export interface PublishGateDecision {
  allowed: boolean;
  stage: NashrApprovalStageName | null;
  reason: string;
  /** Why it was allowed — 'approved' or an explicit autonomy opt-in. */
  via: 'approved' | 'autonomous' | 'denied' | 'not-found' | 'tenant-mismatch';
}

/**
 * Decide whether `postId` may publish on behalf of `organizationId`.
 *
 * Fails closed: any unexpected shape (missing post, org mismatch, unknown
 * stage) results in `allowed: false`.
 */
export async function evaluatePublishGate(
  port: ApprovalGatePort,
  params: { organizationId: string; postId: string },
  env: EnvLike = process.env
): Promise<PublishGateDecision> {
  const { organizationId, postId } = params;

  const policy = resolveAutonomyPolicy(organizationId, env);
  if (policy.autonomousPublishing) {
    return {
      allowed: true,
      stage: null,
      reason: `Autonomous publishing enabled for this organization (${policy.source})`,
      via: 'autonomous',
    };
  }

  const root = await port.loadPostRoot(postId);
  if (!root) {
    return {
      allowed: false,
      stage: null,
      reason: `Post ${postId} not found`,
      via: 'not-found',
    };
  }

  // Tenant isolation: never satisfy a gate with another organization's record.
  if (root.organizationId !== organizationId) {
    return {
      allowed: false,
      stage: null,
      reason: `Post ${postId} does not belong to organization ${organizationId}`,
      via: 'tenant-mismatch',
    };
  }

  const stage =
    (await port.loadLatestStage(organizationId, root.rootPostId)) ??
    INITIAL_STAGE;

  if (canSchedule(stage)) {
    return {
      allowed: true,
      stage,
      reason: 'Post has an APPROVED record',
      via: 'approved',
    };
  }

  return {
    allowed: false,
    stage,
    reason: `Post is at stage ${stage}; an APPROVED record is required before publishing`,
    via: 'denied',
  };
}

export class NashrApprovalRequiredError extends Error {
  readonly stage: NashrApprovalStageName | null;
  readonly postId: string;
  readonly organizationId: string;
  /** Marker Temporal activities/workflows can branch on. */
  readonly nashrApprovalGate = true;

  constructor(
    params: { organizationId: string; postId: string },
    decision: PublishGateDecision
  ) {
    super(`Nashr approval gate: ${decision.reason}`);
    this.name = 'NashrApprovalRequiredError';
    this.stage = decision.stage;
    this.postId = params.postId;
    this.organizationId = params.organizationId;
  }
}

/** Throwing variant used by the Temporal activity. */
export async function assertPublishAllowed(
  port: ApprovalGatePort,
  params: { organizationId: string; postId: string },
  env: EnvLike = process.env
): Promise<PublishGateDecision> {
  const decision = await evaluatePublishGate(port, params, env);
  if (!decision.allowed) {
    throw new NashrApprovalRequiredError(params, decision);
  }
  return decision;
}

// ─────────────────────────────────────────────────────────────────────────────
// Prisma adapter
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Structural subset of the generated Prisma client this adapter needs. Kept
 * loose on purpose so `PrismaRepository<'post' | 'nashrPostApproval'>.model`
 * can be handed straight in without generic gymnastics.
 */
export interface NashrPrismaLike {
  post: { findFirst(args: any): PromiseLike<any> };
  nashrPostApproval: { findFirst(args: any): PromiseLike<any> };
}

/** Maximum parent hops when resolving a thread root — cycle protection. */
const MAX_PARENT_DEPTH = 20;

export class PrismaApprovalGate implements ApprovalGatePort {
  constructor(private readonly _db: NashrPrismaLike) {}

  async loadPostRoot(postId: string) {
    let current = await this._db.post.findFirst({
      where: { id: postId },
      select: { id: true, organizationId: true, parentPostId: true },
    });

    if (!current) return null;

    let depth = 0;
    while (current.parentPostId && depth < MAX_PARENT_DEPTH) {
      const parent = await this._db.post.findFirst({
        where: { id: current.parentPostId },
        select: { id: true, organizationId: true, parentPostId: true },
      });
      if (!parent) break;
      current = parent;
      depth++;
    }

    return {
      rootPostId: current.id as string,
      organizationId: current.organizationId as string,
    };
  }

  async loadLatestStage(organizationId: string, rootPostId: string) {
    const latest = await this._db.nashrPostApproval.findFirst({
      // Both filters, always: postId alone would let a caller in another
      // tenant satisfy the gate with their own approval row.
      where: { postId: rootPostId, organizationId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: { stage: true },
    });

    return (latest?.stage as NashrApprovalStageName) ?? null;
  }
}
