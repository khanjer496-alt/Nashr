/**
 * Nashr (نشر) — declarative role × resource × action matrix.
 *
 * This file is deliberately framework-free and dependency-free (no NestJS, no
 * Prisma import) so it can be unit-tested in isolation and reused by the
 * backend, the orchestrator and — if ever needed — the frontend.
 *
 * Upstream Postiz's `Sections` (permission.exception.class.ts) is *subscription
 * tier* gating and is left completely untouched. This matrix is a second,
 * orthogonal gate: "is this member's role allowed to do this at all?".
 * Both must pass. See permissions.guard.ts.
 *
 * DEFAULT DENY: `can()` returns false for anything not explicitly listed,
 * including unknown roles, resources and actions.
 */

/**
 * Mirrors `enum NashrRole` in schema.prisma. Kept as a local string union so
 * this module never has to import the generated Prisma client.
 * `nashr.prisma.compat.ts` asserts the two stay in sync at compile time.
 */
export const NASHR_ROLES = [
  'OWNER',
  'ADMIN',
  'EDITOR',
  'APPROVER',
  'CLIENT',
  'VIEWER',
] as const;
export type NashrRoleName = (typeof NASHR_ROLES)[number];

export const NASHR_RESOURCES = [
  'post',
  /** A client brand — the `Customer` model, org-scoped. */
  'brand',
  'integration',
  'team_member',
  'billing',
  'analytics',
  'webhook',
  'agent',
  'approval',
  'organization',
] as const;
export type NashrResource = (typeof NASHR_RESOURCES)[number];

export const NASHR_ACTIONS = [
  'create',
  'read',
  'update',
  'delete',
  /** Move a draft into the review pipeline. */
  'submit',
  'approve',
  'request_changes',
  'reject',
  /** Pull a post back out of review; returns it to DRAFT. */
  'withdraw',
  /** Move an approved post to State.QUEUE. */
  'schedule',
  /** Publish immediately (post-now). */
  'publish',
  'invite',
  /** Run an AI agent / execute an agent-proposed tool call. */
  'execute',
] as const;
export type NashrAction = (typeof NASHR_ACTIONS)[number];

export type NashrPermission = readonly [NashrResource, NashrAction];

/**
 * How wide a role's reach is inside its organization.
 * - `organization` — every brand (`Customer`) in the org.
 * - `own_brand`    — only the brands (`Customer`s) the member is attached to.
 *                    Used for CLIENT: an agency's client must never see another
 *                    client's posts.
 */
export type NashrScope = 'organization' | 'own_brand';

export const ROLE_SCOPE: Readonly<Record<NashrRoleName, NashrScope>> = {
  OWNER: 'organization',
  ADMIN: 'organization',
  EDITOR: 'organization',
  APPROVER: 'organization',
  CLIENT: 'own_brand',
  VIEWER: 'organization',
};

type ResourceGrants = Readonly<Partial<Record<NashrResource, readonly NashrAction[]>>>;

const READ_ONLY_EVERYWHERE: ResourceGrants = {
  post: ['read'],
  brand: ['read'],
  integration: ['read'],
  team_member: ['read'],
  analytics: ['read'],
  webhook: ['read'],
  agent: ['read'],
  approval: ['read'],
  organization: ['read'],
};

const FULL_POST: readonly NashrAction[] = [
  'create',
  'read',
  'update',
  'delete',
  'submit',
  'withdraw',
  'schedule',
  'publish',
];

const CRUD: readonly NashrAction[] = ['create', 'read', 'update', 'delete'];

/**
 * The matrix. Anything absent is denied.
 *
 * Design intent (from the Nashr brief):
 *   OWNER    — everything, including billing and deleting the organization.
 *   ADMIN    — everything except billing mutations and org deletion.
 *              Billing is `read` only: an admin may look at the plan/invoices
 *              but may not change the card, upgrade, or cancel.
 *   EDITOR   — authors content: create/edit drafts and submit them for review.
 *              Explicitly CANNOT approve, schedule or publish.
 *   APPROVER — makes internal review decisions. Cannot author or publish.
 *   CLIENT   — the agency's customer. Read-only on their OWN brand plus the
 *              client-approval decision. Cannot edit anything.
 *   VIEWER   — read-only, nothing else.
 *
 * Stage-level authority (who may decide at INTERNAL_REVIEW vs CLIENT_APPROVAL)
 * is NOT encoded here — that lives in the approval state machine
 * (libraries/nashr-approval/src/state-machine.ts). This matrix answers only
 * "may this role ever perform this action on this resource".
 */
export const ROLE_MATRIX: Readonly<Record<NashrRoleName, ResourceGrants>> = {
  OWNER: {
    post: FULL_POST,
    brand: CRUD,
    integration: CRUD,
    team_member: [...CRUD, 'invite'],
    billing: CRUD,
    analytics: ['read'],
    webhook: CRUD,
    agent: [...CRUD, 'execute', 'approve'],
    approval: ['read', 'submit', 'approve', 'request_changes', 'reject', 'withdraw'],
    organization: ['read', 'update', 'delete'],
  },

  ADMIN: {
    post: FULL_POST,
    brand: CRUD,
    integration: CRUD,
    team_member: [...CRUD, 'invite'],
    // No create/update/delete: billing belongs to OWNER only.
    billing: ['read'],
    analytics: ['read'],
    webhook: CRUD,
    agent: [...CRUD, 'execute', 'approve'],
    approval: ['read', 'submit', 'approve', 'request_changes', 'reject', 'withdraw'],
    // No 'delete': destroying the organization belongs to OWNER only.
    organization: ['read', 'update'],
  },

  EDITOR: {
    // No 'schedule', no 'publish' — an editor's work must pass review first.
    post: ['create', 'read', 'update', 'delete', 'submit', 'withdraw'],
    brand: ['read'],
    integration: ['read'],
    team_member: ['read'],
    analytics: ['read'],
    webhook: ['read'],
    agent: ['read', 'execute'],
    // Can push into review and pull back out, but never decide.
    approval: ['read', 'submit', 'withdraw'],
    organization: ['read'],
  },

  APPROVER: {
    // Reviewers do not author content and do not publish it.
    post: ['read'],
    brand: ['read'],
    integration: ['read'],
    team_member: ['read'],
    analytics: ['read'],
    webhook: ['read'],
    agent: ['read'],
    approval: ['read', 'approve', 'request_changes', 'reject'],
    organization: ['read'],
  },

  CLIENT: {
    // Read-only on content. No create/update/delete anywhere.
    post: ['read'],
    brand: ['read'],
    integration: ['read'],
    analytics: ['read'],
    approval: ['read', 'approve', 'request_changes', 'reject'],
    organization: ['read'],
  },

  VIEWER: READ_ONLY_EVERYWHERE,
};

function isKnownRole(role: unknown): role is NashrRoleName {
  return (
    typeof role === 'string' &&
    (NASHR_ROLES as readonly string[]).includes(role)
  );
}

function isKnownResource(resource: unknown): resource is NashrResource {
  return (
    typeof resource === 'string' &&
    (NASHR_RESOURCES as readonly string[]).includes(resource)
  );
}

function isKnownAction(action: unknown): action is NashrAction {
  return (
    typeof action === 'string' &&
    (NASHR_ACTIONS as readonly string[]).includes(action)
  );
}

/**
 * The single authorization primitive. Default deny.
 *
 * Accepts `unknown` on purpose: role values arrive from the database and from
 * JSON request bodies, and a value that is null/undefined/garbage must be
 * denied rather than crash or accidentally match.
 */
export function can(
  role: unknown,
  resource: unknown,
  action: unknown
): boolean {
  if (!isKnownRole(role)) return false;
  if (!isKnownResource(resource)) return false;
  if (!isKnownAction(action)) return false;

  const grants = ROLE_MATRIX[role];
  // Object.prototype.hasOwnProperty guards against prototype-chain keys
  // ('constructor', '__proto__', 'toString') smuggled in as a resource name.
  if (!Object.prototype.hasOwnProperty.call(grants, resource)) return false;

  const allowed = grants[resource];
  if (!allowed) return false;

  return allowed.includes(action);
}

/** Convenience: every permission a role holds, flattened. */
export function permissionsFor(role: unknown): NashrPermission[] {
  if (!isKnownRole(role)) return [];
  const grants = ROLE_MATRIX[role];
  const out: NashrPermission[] = [];
  for (const resource of NASHR_RESOURCES) {
    for (const action of grants[resource] ?? []) {
      out.push([resource, action]);
    }
  }
  return out;
}

/** Scope of a role. Unknown roles get the narrowest scope, never the widest. */
export function scopeFor(role: unknown): NashrScope {
  return isKnownRole(role) ? ROLE_SCOPE[role] : 'own_brand';
}

/** True when the role may only ever see brands it is explicitly attached to. */
export function isBrandScoped(role: unknown): boolean {
  return scopeFor(role) === 'own_brand';
}

export interface RoleCheckFailure {
  resource: NashrResource | string;
  action: NashrAction | string;
  role: string;
}

/**
 * Returns the first permission the role does NOT hold, or `null` when all pass.
 * Used by the guard so the 403 body can name the exact missing permission.
 */
export function firstDenied(
  role: unknown,
  required: readonly NashrPermission[]
): RoleCheckFailure | null {
  for (const [resource, action] of required) {
    if (!can(role, resource, action)) {
      return {
        resource,
        action,
        role: typeof role === 'string' ? role : 'UNKNOWN',
      };
    }
  }
  return null;
}
