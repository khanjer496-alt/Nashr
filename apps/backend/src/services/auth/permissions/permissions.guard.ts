import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  AppAbility,
  PermissionsService,
} from '@gitroom/backend/services/auth/permissions/permissions.service';
import {
  AbilityPolicy,
  CHECK_POLICIES_KEY,
  CHECK_ROLE_KEY,
  RolePolicy,
} from '@gitroom/backend/services/auth/permissions/permissions.ability';
import { Organization, User } from '@prisma/client';
import { Request } from 'express';
import { SubscriptionException } from './permission.exception.class';
import { NashrRoleException } from './nashr.role.exception';

@Injectable()
export class PoliciesGuard implements CanActivate {
  constructor(
    private _reflector: Reflector,
    private _authorizationService: PermissionsService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request: Request = context.switchToHttp().getRequest();
    if (
      request.path.indexOf('/auth') > -1 ||
      request.path.indexOf('/auth') > -1 ||
      request.path.indexOf('/integrations/social-connect') > -1 ||
      request.path.indexOf('/integrations/provider') > -1
    ) {
      return true;
    }

    const policyHandlers =
      this._reflector.get<AbilityPolicy[]>(
        CHECK_POLICIES_KEY,
        context.getHandler()
      ) || [];

    // Nashr addition: role metadata is read alongside the tier metadata.
    const roleHandlers =
      this._reflector.get<RolePolicy[]>(
        CHECK_ROLE_KEY,
        context.getHandler()
      ) || [];

    // Backwards compatible: a handler with neither decorator is untouched.
    if (!policyHandlers.length && !roleHandlers.length) {
      return true;
    }

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    const { org }: { org: Organization } = request;

    // ── Upstream subscription-tier gating (unchanged) ────────────────────────
    if (policyHandlers.length) {
      const refreshChannelId =
        typeof request.query?.refresh === 'string'
          ? request.query.refresh
          : undefined;

      // @ts-ignore
      const ability = await this._authorizationService.check(org.id, org.createdAt, org.users[0].role, policyHandlers, refreshChannelId);

      const item = policyHandlers.find(
        (handler) => !this.execPolicyHandler(handler, ability)
      );

      if (item) {
        throw new SubscriptionException({
          section: item[1],
          action: item[0],
        });
      }
    }

    // ── Nashr (نشر) role gating — runs IN ADDITION TO the tier gate ──────────
    // Never replaces it: a request must satisfy both. Ordering is deliberate —
    // the tier answer (402, "upgrade") is more actionable than the role answer
    // (403, "ask your admin"), so it is reported first when both fail.
    if (roleHandlers.length) {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error
      const { user }: { user: User } = request;

      if (!org?.id || !user?.id) {
        // No resolved tenant/identity: deny rather than fall through.
        throw new NashrRoleException({
          resource: roleHandlers[0][0],
          action: roleHandlers[0][1],
          role: 'NONE',
        });
      }

      // Throws NashrRoleException (403) on the first missing permission.
      const role = await this._authorizationService.checkNashrRole(
        org.id,
        user.id,
        roleHandlers
      );

      // Handed to controllers so they do not have to re-query it.
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error
      request.nashrRole = role;
    }

    return true;
  }

  private execPolicyHandler(handler: AbilityPolicy, ability: AppAbility) {
    return ability.can(handler[0], handler[1]);
  }
}
