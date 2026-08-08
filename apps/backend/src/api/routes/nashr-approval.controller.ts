/**
 * Nashr (نشر) — approval workflow controller.
 *
 * Draft → Internal review → Client approval → Schedule → Publish.
 *
 * Every endpoint is organization-scoped: the org comes from the authenticated
 * request (never from the body or a query param) and is passed into every
 * service call, which in turn puts it in every WHERE clause. A postId on its
 * own is never enough to reach a row.
 *
 * Authorization is two-layered:
 *   1. `@CheckRole` — may this role ever perform this action (role matrix)?
 *   2. the state machine — may this role perform it *from the current stage*?
 * A CLIENT holds `approval:approve` but the state machine still refuses their
 * approval at INTERNAL_REVIEW.
 */

import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { GetOrgFromRequest } from '@gitroom/nestjs-libraries/user/org.from.request';
import { GetUserFromRequest } from '@gitroom/nestjs-libraries/user/user.from.request';
import { Organization, User } from '@prisma/client';
import { CheckRole } from '@gitroom/backend/services/auth/permissions/permissions.ability';
import { GetNashrRoleFromRequest } from '@gitroom/backend/services/auth/permissions/nashr.role.from.request';
import { PermissionsService } from '@gitroom/backend/services/auth/permissions/permissions.service';
import type { NashrRoleName } from '@gitroom/nashr-permissions/role.matrix';
import {
  NashrApprovalError,
  NashrApprovalService,
} from '@gitroom/nashr-approval/approval.service';
import type { NashrApprovalDecisionName } from '@gitroom/nashr-approval/state-machine';

export class ApprovalNoteDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}

export class ApprovalDecisionDto extends ApprovalNoteDto {
  @IsIn(['SUBMITTED', 'APPROVED', 'CHANGES_REQUESTED', 'REJECTED', 'WITHDRAWN'])
  decision: NashrApprovalDecisionName;
}

@ApiTags('Nashr Approvals')
@Controller('/nashr/approvals')
export class NashrApprovalController {
  constructor(
    private _approvalService: NashrApprovalService,
    private _permissionsService: PermissionsService
  ) {}

  /**
   * The role the guard resolved. Falls back to a fresh lookup so the controller
   * is still correct if a route is ever added without `@CheckRole`.
   */
  private async _role(
    org: Organization,
    user: User,
    fromGuard?: NashrRoleName
  ): Promise<NashrRoleName> {
    const role =
      fromGuard ??
      (await this._permissionsService.getNashrRole(org.id, user.id));

    if (!role) {
      throw new HttpException(
        { message: 'No active membership in this organization' },
        HttpStatus.FORBIDDEN
      );
    }
    return role;
  }

  /** null ⇒ org-wide. [] ⇒ nothing (CLIENT without a brand link). */
  private _brandScope(org: Organization, user: User) {
    return this._permissionsService.getAllowedCustomerIds(org.id, user.id);
  }

  private _translate(err: unknown): never {
    if (err instanceof NashrApprovalError) {
      const status =
        err.code === 'POST_NOT_FOUND'
          ? HttpStatus.NOT_FOUND
          : err.code === 'ROLE_NOT_PERMITTED' || err.code === 'BRAND_FORBIDDEN'
          ? HttpStatus.FORBIDDEN
          : HttpStatus.BAD_REQUEST;

      throw new HttpException(
        { statusCode: status, error: err.code, message: err.message },
        status
      );
    }
    throw err as Error;
  }

  private async _decide(
    org: Organization,
    user: User,
    guardRole: NashrRoleName | undefined,
    postId: string,
    decision: NashrApprovalDecisionName,
    note?: string
  ) {
    const actorRole = await this._role(org, user, guardRole);
    const allowedCustomerIds = await this._brandScope(org, user);

    try {
      return await this._approvalService.decide({
        organizationId: org.id,
        postId,
        actorId: user.id,
        actorRole,
        decision,
        note,
        allowedCustomerIds,
      });
    } catch (err) {
      return this._translate(err);
    }
  }

  // ── Read ──────────────────────────────────────────────────────────────────

  /** Current stage plus the decisions this member may record right now. */
  @Get('/posts/:postId')
  @CheckRole(['approval', 'read'], ['post', 'read'])
  async getStatus(
    @GetOrgFromRequest() org: Organization,
    @GetUserFromRequest() user: User,
    @GetNashrRoleFromRequest() guardRole: NashrRoleName,
    @Param('postId') postId: string
  ) {
    const actorRole = await this._role(org, user, guardRole);
    try {
      const [status, history] = await Promise.all([
        this._approvalService.getStatus(org.id, postId, actorRole),
        this._approvalService.getHistory(org.id, postId),
      ]);
      return { ...status, history };
    } catch (err) {
      return this._translate(err);
    }
  }

  /** The append-only trail on its own. */
  @Get('/posts/:postId/history')
  @CheckRole(['approval', 'read'])
  async getHistory(
    @GetOrgFromRequest() org: Organization,
    @Param('postId') postId: string
  ) {
    try {
      return await this._approvalService.getHistory(org.id, postId);
    } catch (err) {
      return this._translate(err);
    }
  }

  /** Everything waiting on this member's decision, brand-scoped. */
  @Get('/pending')
  @CheckRole(['approval', 'read'])
  async listPending(
    @GetOrgFromRequest() org: Organization,
    @GetUserFromRequest() user: User,
    @GetNashrRoleFromRequest() guardRole: NashrRoleName
  ) {
    const actorRole = await this._role(org, user, guardRole);
    const allowedCustomerIds = await this._brandScope(org, user);
    return this._approvalService.listPending(
      org.id,
      actorRole,
      allowedCustomerIds
    );
  }

  // ── Write ─────────────────────────────────────────────────────────────────

  /** DRAFT | CHANGES_REQUESTED | REJECTED → INTERNAL_REVIEW. */
  @Post('/posts/:postId/submit')
  @CheckRole(['approval', 'submit'])
  async submit(
    @GetOrgFromRequest() org: Organization,
    @GetUserFromRequest() user: User,
    @GetNashrRoleFromRequest() guardRole: NashrRoleName,
    @Param('postId') postId: string,
    @Body() body: ApprovalNoteDto
  ) {
    return this._decide(org, user, guardRole, postId, 'SUBMITTED', body?.note);
  }

  /**
   * Approve at whichever stage the post is in. The state machine decides
   * whether this member's approval counts here: an APPROVER's approval moves
   * INTERNAL_REVIEW → CLIENT_APPROVAL, a CLIENT's moves CLIENT_APPROVAL →
   * APPROVED, and neither can stand in for the other.
   */
  @Post('/posts/:postId/approve')
  @CheckRole(['approval', 'approve'])
  async approve(
    @GetOrgFromRequest() org: Organization,
    @GetUserFromRequest() user: User,
    @GetNashrRoleFromRequest() guardRole: NashrRoleName,
    @Param('postId') postId: string,
    @Body() body: ApprovalNoteDto
  ) {
    return this._decide(org, user, guardRole, postId, 'APPROVED', body?.note);
  }

  /** Sends the post back to the author. */
  @Post('/posts/:postId/request-changes')
  @CheckRole(['approval', 'request_changes'])
  async requestChanges(
    @GetOrgFromRequest() org: Organization,
    @GetUserFromRequest() user: User,
    @GetNashrRoleFromRequest() guardRole: NashrRoleName,
    @Param('postId') postId: string,
    @Body() body: ApprovalNoteDto
  ) {
    return this._decide(
      org,
      user,
      guardRole,
      postId,
      'CHANGES_REQUESTED',
      body?.note
    );
  }

  /** Terminal until someone resubmits. */
  @Post('/posts/:postId/reject')
  @CheckRole(['approval', 'reject'])
  async reject(
    @GetOrgFromRequest() org: Organization,
    @GetUserFromRequest() user: User,
    @GetNashrRoleFromRequest() guardRole: NashrRoleName,
    @Param('postId') postId: string,
    @Body() body: ApprovalNoteDto
  ) {
    return this._decide(org, user, guardRole, postId, 'REJECTED', body?.note);
  }

  /** Pull a post back out of review, or revoke an approval. Returns to DRAFT. */
  @Post('/posts/:postId/withdraw')
  @CheckRole(['approval', 'withdraw'])
  async withdraw(
    @GetOrgFromRequest() org: Organization,
    @GetUserFromRequest() user: User,
    @GetNashrRoleFromRequest() guardRole: NashrRoleName,
    @Param('postId') postId: string,
    @Body() body: ApprovalNoteDto
  ) {
    return this._decide(org, user, guardRole, postId, 'WITHDRAWN', body?.note);
  }

  /**
   * Generic decision endpoint. Same guards, same state machine — convenient for
   * the SDK and for MCP tools that carry the decision in the body.
   */
  @Post('/posts/:postId/decision')
  @CheckRole(['approval', 'read'])
  async decide(
    @GetOrgFromRequest() org: Organization,
    @GetUserFromRequest() user: User,
    @GetNashrRoleFromRequest() guardRole: NashrRoleName,
    @Param('postId') postId: string,
    @Body() body: ApprovalDecisionDto
  ) {
    return this._decide(
      org,
      user,
      guardRole,
      postId,
      body.decision,
      body?.note
    );
  }

  /**
   * Pre-flight for the scheduling path: is this post allowed into State.QUEUE?
   * The authoritative gate is in the Temporal publish activity; this exists so
   * the UI can refuse early with a useful message.
   */
  @Get('/posts/:postId/schedulable')
  @CheckRole(['post', 'schedule'])
  async schedulable(
    @GetOrgFromRequest() org: Organization,
    @Param('postId') postId: string
  ) {
    try {
      const stage = await this._approvalService.getCurrentStage(org.id, postId);
      return { schedulable: stage === 'APPROVED', stage };
    } catch (err) {
      return this._translate(err);
    }
  }
}
