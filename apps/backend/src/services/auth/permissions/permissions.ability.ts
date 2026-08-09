import { SetMetadata } from '@nestjs/common';
import { AuthorizationActions, Sections } from './permission.exception.class';
import type {
  NashrAction,
  NashrResource,
} from '@gitroom/nashr-permissions/role.matrix';

export const CHECK_POLICIES_KEY = 'check_policy';
export type AbilityPolicy = [AuthorizationActions, Sections];
export const CheckPolicies = (...handlers: AbilityPolicy[]) =>
  SetMetadata(CHECK_POLICIES_KEY, handlers);

// ─────────────────────────────────────────────────────────────────────────────
// Nashr (نشر) addition — role gating.
//
// `@CheckPolicies` gates on SUBSCRIPTION TIER (upstream behaviour, untouched).
// `@CheckRole` gates on the member's NashrRole. They are independent: a handler
// may carry either, both, or neither, and PoliciesGuard evaluates both. A
// handler with no `@CheckRole` behaves exactly as it did before.
//
//   @CheckPolicies([AuthorizationActions.Create, Sections.WEBHOOKS])
//   @CheckRole(['webhook', 'create'])
// ─────────────────────────────────────────────────────────────────────────────

export const CHECK_ROLE_KEY = 'nashr_check_role';
export type RolePolicy = [NashrResource, NashrAction];

/** Every listed permission must be held — the list is ANDed. */
export const CheckRole = (...handlers: RolePolicy[]) =>
  SetMetadata(CHECK_ROLE_KEY, handlers);
