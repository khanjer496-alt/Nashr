import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { NashrRoleName } from '@gitroom/nashr-permissions/role.matrix';

/**
 * Nashr (نشر) addition.
 *
 * Reads the NashrRole that PoliciesGuard resolved for this request. Only
 * populated on handlers carrying `@CheckRole(...)`; undefined otherwise, so
 * controllers must not treat it as authoritative on un-decorated routes.
 */
export const GetNashrRoleFromRequest = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): NashrRoleName | undefined => {
    const request = ctx.switchToHttp().getRequest();
    return request.nashrRole;
  }
);
