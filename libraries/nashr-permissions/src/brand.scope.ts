/**
 * Nashr (نشر) — brand (tenant-within-tenant) scoping.
 *
 * An agency organization holds many client brands (`Customer`, which groups
 * `Integration`s). A CLIENT member must only ever see their own brand's posts.
 *
 * SCHEMA GAP — this is the one blocking change Phase 4 needs:
 *
 *   model UserOrganization {
 *     nashrCustomerId String?
 *     nashrCustomer   Customer? @relation(fields: [nashrCustomerId], references: [id])
 *   }
 *
 * Until that column exists there is no way to know which brand a CLIENT belongs
 * to, so this resolver FAILS CLOSED: a brand-scoped member is granted an empty
 * brand list and therefore sees nothing. `NASHR_CLIENT_SCOPE_ENFORCEMENT=org`
 * degrades that to organization-wide visibility for single-brand deployments;
 * it is unsafe for agencies and is logged every time it is used.
 */

import { isBrandScoped } from './role.matrix';

export type EnvLike = Record<string, string | undefined>;

/**
 * `null`  ⇒ organization-wide access (staff roles).
 * `[]`    ⇒ no brands at all; every brand-scoped query must return nothing.
 * `[ids]` ⇒ exactly these brands.
 */
export type AllowedCustomerIds = string[] | null;

export interface MembershipLike {
  /** Present once the schema column above is added. */
  nashrCustomerId?: string | null;
}

export interface BrandScopeResult {
  allowedCustomerIds: AllowedCustomerIds;
  /** Set when the resolver had to fall back; surface this in logs. */
  warning?: string;
}

export function resolveBrandScope(
  role: unknown,
  membership: MembershipLike | null | undefined,
  env: EnvLike = process.env
): BrandScopeResult {
  if (!isBrandScoped(role)) {
    return { allowedCustomerIds: null };
  }

  const linked = membership?.nashrCustomerId;
  if (typeof linked === 'string' && linked.length > 0) {
    return { allowedCustomerIds: [linked] };
  }

  if (env.NASHR_CLIENT_SCOPE_ENFORCEMENT === 'org') {
    return {
      allowedCustomerIds: null,
      warning:
        'NASHR_CLIENT_SCOPE_ENFORCEMENT=org — brand-scoped member granted ' +
        'organization-wide visibility. Unsafe for multi-brand agencies.',
    };
  }

  return {
    allowedCustomerIds: [],
    warning:
      'Brand-scoped member has no UserOrganization.nashrCustomerId link; ' +
      'denying all brands (fail closed).',
  };
}
