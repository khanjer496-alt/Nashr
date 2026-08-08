/**
 * Nashr (نشر) — approval service.
 *
 * Persists the append-only `NashrPostApproval` trail. Nothing in this file ever
 * updates or deletes an approval row: the current stage of a post is simply the
 * stage of its newest row, so the history is immutable by construction.
 *
 * TENANT ISOLATION: every read and every write filters on `organizationId`.
 * A postId alone is never sufficient to reach a row.
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaRepository } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';
import { NashrRoleName } from '@gitroom/nashr-permissions/role.matrix';
import {
  INITIAL_STAGE,
  NashrApprovalDecisionName,
  NashrApprovalStageName,
  canSchedule,
  describeStage,
  isTransitionFailure,
  legalDecisionsFor,
  transition,
} from './state-machine';
import { clientApprovalRequired } from './autonomy.policy';
import { PrismaApprovalGate, evaluatePublishGate } from './publish.gate';

export class NashrApprovalError extends Error {
  constructor(
    readonly code:
      | 'POST_NOT_FOUND'
      | 'ILLEGAL_TRANSITION'
      | 'ROLE_NOT_PERMITTED'
      | 'UNKNOWN_STAGE'
      | 'UNKNOWN_DECISION'
      | 'UNKNOWN_ROLE'
      | 'BRAND_FORBIDDEN',
    message: string
  ) {
    super(message);
    this.name = 'NashrApprovalError';
  }
}

export interface ApprovalRecord {
  id: string;
  postId: string;
  stage: NashrApprovalStageName;
  decision: NashrApprovalDecisionName;
  actorId: string | null;
  actorRole: NashrRoleName | null;
  note: string | null;
  createdAt: Date;
}

export interface DecideParams {
  organizationId: string;
  postId: string;
  actorId: string;
  actorRole: NashrRoleName;
  decision: NashrApprovalDecisionName;
  note?: string;
  /**
   * Customer/brand IDs the actor is allowed to touch. `null` means
   * organization-wide (staff roles). An empty array means "no brands" and
   * every post is refused — the fail-closed default for a CLIENT whose brand
   * link is not configured.
   */
  allowedCustomerIds?: string[] | null;
}

type PostScope = {
  rootPostId: string;
  organizationId: string;
  customerId: string | null;
};

@Injectable()
export class NashrApprovalService {
  private readonly _logger = new Logger(NashrApprovalService.name);

  constructor(
    private readonly _prisma: PrismaRepository<
      'post' | 'nashrPostApproval' | 'userOrganization'
    >
  ) {}

  private get _db() {
    return this._prisma.model as any;
  }

  /**
   * Resolve the post's thread root, owning org and brand, scoped to `orgId`.
   * Returns null when the post is missing, deleted, or owned by another tenant.
   */
  private async _resolveScope(
    organizationId: string,
    postId: string
  ): Promise<PostScope | null> {
    const post = await this._db.post.findFirst({
      // organizationId in the WHERE, not checked afterwards — a cross-tenant
      // id must not even be readable.
      where: { id: postId, organizationId, deletedAt: null },
      select: {
        id: true,
        organizationId: true,
        parentPostId: true,
        integration: { select: { customerId: true } },
      },
    });

    if (!post) return null;

    let rootId: string = post.id;
    let customerId: string | null = post.integration?.customerId ?? null;
    let parentId: string | null = post.parentPostId ?? null;

    for (let depth = 0; parentId && depth < 20; depth++) {
      const parent = await this._db.post.findFirst({
        where: { id: parentId, organizationId },
        select: {
          id: true,
          parentPostId: true,
          integration: { select: { customerId: true } },
        },
      });
      if (!parent) break;
      rootId = parent.id;
      customerId = parent.integration?.customerId ?? customerId;
      parentId = parent.parentPostId ?? null;
    }

    return { rootPostId: rootId, organizationId, customerId };
  }

  private _assertBrandAccess(
    scope: PostScope,
    allowedCustomerIds: string[] | null | undefined
  ) {
    // undefined / null ⇒ organization-wide access (staff roles).
    if (allowedCustomerIds === undefined || allowedCustomerIds === null) return;

    if (!scope.customerId || !allowedCustomerIds.includes(scope.customerId)) {
      throw new NashrApprovalError(
        'BRAND_FORBIDDEN',
        'This post belongs to a brand you do not have access to'
      );
    }
  }

  /** Current stage. A post with no rows has never been submitted ⇒ DRAFT. */
  async getCurrentStage(
    organizationId: string,
    postId: string
  ): Promise<NashrApprovalStageName> {
    const scope = await this._resolveScope(organizationId, postId);
    if (!scope) {
      throw new NashrApprovalError(
        'POST_NOT_FOUND',
        `Post ${postId} was not found in this organization`
      );
    }
    return this._latestStage(organizationId, scope.rootPostId);
  }

  private async _latestStage(
    organizationId: string,
    rootPostId: string
  ): Promise<NashrApprovalStageName> {
    const latest = await this._db.nashrPostApproval.findFirst({
      where: { postId: rootPostId, organizationId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: { stage: true },
    });
    return (latest?.stage as NashrApprovalStageName) ?? INITIAL_STAGE;
  }

  /** Full append-only trail, oldest first. */
  async getHistory(
    organizationId: string,
    postId: string
  ): Promise<ApprovalRecord[]> {
    const scope = await this._resolveScope(organizationId, postId);
    if (!scope) {
      throw new NashrApprovalError(
        'POST_NOT_FOUND',
        `Post ${postId} was not found in this organization`
      );
    }

    return this._db.nashrPostApproval.findMany({
      where: { postId: scope.rootPostId, organizationId },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        postId: true,
        stage: true,
        decision: true,
        actorId: true,
        actorRole: true,
        note: true,
        createdAt: true,
      },
    });
  }

  /** Stage + the decisions this actor may legally record right now. */
  async getStatus(
    organizationId: string,
    postId: string,
    actorRole: NashrRoleName
  ) {
    const stage = await this.getCurrentStage(organizationId, postId);
    return {
      postId,
      stage,
      stageLabel: describeStage(stage),
      schedulable: canSchedule(stage),
      availableDecisions: legalDecisionsFor(stage, actorRole),
    };
  }

  /**
   * Record a decision. This is the ONLY write path, and it only ever creates.
   *
   * Order of checks matters: tenant → brand → state machine. A caller must not
   * be able to learn that a post exists in another tenant by comparing error
   * messages.
   */
  async decide(params: DecideParams): Promise<ApprovalRecord> {
    const {
      organizationId,
      postId,
      actorId,
      actorRole,
      decision,
      note,
      allowedCustomerIds,
    } = params;

    const scope = await this._resolveScope(organizationId, postId);
    if (!scope) {
      throw new NashrApprovalError(
        'POST_NOT_FOUND',
        `Post ${postId} was not found in this organization`
      );
    }

    this._assertBrandAccess(scope, allowedCustomerIds);

    const currentStage = await this._latestStage(
      organizationId,
      scope.rootPostId
    );

    const result = transition({
      currentStage,
      decision,
      actorRole,
      options: {
        clientApprovalRequired: clientApprovalRequired(organizationId),
      },
    });

    // isTransitionFailure() rather than `!result.ok`: see the note on the
    // predicate — narrowing on a boolean discriminant is unreliable under this
    // repo's `strictNullChecks: false`. Every TransitionErrorCode is also a
    // NashrApprovalError code, so no cast is needed.
    if (isTransitionFailure(result)) {
      throw new NashrApprovalError(result.code, result.reason);
    }

    const created = await this._db.nashrPostApproval.create({
      data: {
        postId: scope.rootPostId,
        organizationId,
        stage: result.nextStage,
        decision,
        actorId,
        actorRole,
        note: note ?? null,
      },
      select: {
        id: true,
        postId: true,
        stage: true,
        decision: true,
        actorId: true,
        actorRole: true,
        note: true,
        createdAt: true,
      },
    });

    this._logger.log(
      `approval post=${scope.rootPostId} org=${organizationId} ${currentStage} -> ${result.nextStage} by ${actorRole}`
    );

    return created;
  }

  /**
   * Guard for the scheduling path: a post may only enter `State.QUEUE` once it
   * carries an APPROVED record. Callers that move a post to QUEUE should call
   * this first. (The Temporal publish activity enforces the same rule again —
   * that check is the authoritative one, this is the fast, friendly one.)
   */
  async assertSchedulable(organizationId: string, postId: string) {
    const stage = await this.getCurrentStage(organizationId, postId);
    if (!canSchedule(stage)) {
      throw new NashrApprovalError(
        'ILLEGAL_TRANSITION',
        `Post is at stage ${stage}; it must be APPROVED before it can be scheduled`
      );
    }
    return stage;
  }

  /** Non-throwing check used by read paths and by the publish gate adapter. */
  async isApprovedForPublish(organizationId: string, postId: string) {
    const gate = new PrismaApprovalGate(this._db);
    return evaluatePublishGate(gate, { organizationId, postId });
  }

  /**
   * Posts currently waiting on this actor, org-scoped.
   * INTERNAL_REVIEW for approvers, CLIENT_APPROVAL for clients, both for staff.
   */
  async listPending(
    organizationId: string,
    actorRole: NashrRoleName,
    allowedCustomerIds?: string[] | null
  ) {
    const stages: NashrApprovalStageName[] =
      actorRole === 'CLIENT'
        ? ['CLIENT_APPROVAL']
        : actorRole === 'APPROVER'
        ? ['INTERNAL_REVIEW']
        : ['INTERNAL_REVIEW', 'CLIENT_APPROVAL'];

    // Newest row per post decides the current stage, so pull the newest rows
    // and keep the first occurrence of each post.
    const rows = await this._db.nashrPostApproval.findMany({
      where: { organizationId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: {
        id: true,
        postId: true,
        stage: true,
        decision: true,
        createdAt: true,
        post: {
          select: {
            id: true,
            content: true,
            publishDate: true,
            state: true,
            organizationId: true,
            integration: {
              select: { id: true, name: true, customerId: true },
            },
          },
        },
      },
      take: 500,
    });

    const seen = new Set<string>();
    const pending: any[] = [];

    for (const row of rows) {
      if (seen.has(row.postId)) continue;
      seen.add(row.postId);

      if (!stages.includes(row.stage)) continue;
      // Defence in depth — the WHERE already scoped this.
      if (row.post?.organizationId !== organizationId) continue;

      if (allowedCustomerIds !== undefined && allowedCustomerIds !== null) {
        const customerId = row.post?.integration?.customerId ?? null;
        if (!customerId || !allowedCustomerIds.includes(customerId)) continue;
      }

      pending.push({
        postId: row.postId,
        stage: row.stage,
        stageLabel: describeStage(row.stage),
        since: row.createdAt,
        post: row.post,
      });
    }

    return pending;
  }

  /**
   * The Nashr role of a member inside an organization.
   *
   * Read fresh from the database rather than from the JWT: upstream's auth
   * middleware only selects `role` and `disabled` onto `req.org.users[0]`, and
   * a role change must take effect immediately, not at next login.
   */
  async getMemberRole(
    organizationId: string,
    userId: string
  ): Promise<NashrRoleName | null> {
    const membership = await this._db.userOrganization.findFirst({
      where: { organizationId, userId, disabled: false },
      select: { nashrRole: true },
    });
    return (membership?.nashrRole as NashrRoleName) ?? null;
  }
}
