/**
 * Nashr (نشر) — approval state machine.
 *
 * Draft → Internal review → Client approval → Schedule → Publish
 *
 * Pure and dependency-free: no NestJS, no Prisma, no I/O. Everything here is a
 * total function of (currentStage, decision, actorRole, options), which makes
 * the whole policy unit-testable without a database.
 *
 * The persisted trail (`NashrPostApproval`) is APPEND-ONLY. The "current stage"
 * of a post is the stage of its most recent row; there is no mutable status
 * column, so history can never be rewritten. See approval.service.ts.
 */

import type { NashrRoleName } from '@gitroom/nashr-permissions/role.matrix';

/** Mirrors `enum NashrApprovalStage` in schema.prisma. */
export const NASHR_APPROVAL_STAGES = [
  'DRAFT',
  'INTERNAL_REVIEW',
  'CLIENT_APPROVAL',
  'APPROVED',
  'CHANGES_REQUESTED',
  'REJECTED',
] as const;
export type NashrApprovalStageName = (typeof NASHR_APPROVAL_STAGES)[number];

/** Mirrors `enum NashrApprovalDecision` in schema.prisma. */
export const NASHR_APPROVAL_DECISIONS = [
  'SUBMITTED',
  'APPROVED',
  'CHANGES_REQUESTED',
  'REJECTED',
  'WITHDRAWN',
] as const;
export type NashrApprovalDecisionName = (typeof NASHR_APPROVAL_DECISIONS)[number];

/** A post with no approval rows at all has never been submitted. */
export const INITIAL_STAGE: NashrApprovalStageName = 'DRAFT';

/**
 * The only stage from which a post may enter `State.QUEUE` (scheduled) or be
 * published. Enforced in the approval service AND, critically, in the Temporal
 * publish activity.
 */
export const PUBLISHABLE_STAGE: NashrApprovalStageName = 'APPROVED';

/**
 * Stages in which the author may still edit the content.
 * CHANGES_REQUESTED is functionally "back to draft": the brief calls for
 * CHANGES_REQUESTED to return the post to DRAFT, and the schema models it as
 * its own stage so the trail records *why* it went back. Editing and
 * re-submission behave exactly as they do from DRAFT.
 */
const EDITABLE_STAGES: readonly NashrApprovalStageName[] = [
  'DRAFT',
  'CHANGES_REQUESTED',
  'REJECTED',
];

export function isEditableStage(stage: unknown): boolean {
  return (
    typeof stage === 'string' &&
    (EDITABLE_STAGES as readonly string[]).includes(stage)
  );
}

/** True only for APPROVED. Everything else may not be scheduled or published. */
export function canSchedule(stage: unknown): boolean {
  return stage === PUBLISHABLE_STAGE;
}

export interface TransitionOptions {
  /**
   * Whether this organization/brand requires the client to sign off after
   * internal review. Default true. When false, an internal APPROVED decision
   * lands straight on APPROVED — for agencies that manage a brand end-to-end
   * with no client user in the workspace.
   */
  clientApprovalRequired?: boolean;
}

export interface TransitionInput {
  currentStage: NashrApprovalStageName;
  decision: NashrApprovalDecisionName;
  actorRole: NashrRoleName;
  options?: TransitionOptions;
}

export type TransitionErrorCode =
  | 'UNKNOWN_STAGE'
  | 'UNKNOWN_DECISION'
  | 'UNKNOWN_ROLE'
  | 'ILLEGAL_TRANSITION'
  | 'ROLE_NOT_PERMITTED';

export type TransitionResult =
  | { ok: true; nextStage: NashrApprovalStageName }
  | { ok: false; code: TransitionErrorCode; reason: string };

export type TransitionFailure = Extract<TransitionResult, { ok: false }>;
export type TransitionSuccess = Extract<TransitionResult, { ok: true }>;

/**
 * Narrowing helper for `TransitionResult`.
 *
 * The repo compiles with `strictNullChecks: false` (tsconfig.base.json), which
 * weakens TypeScript's narrowing on boolean-literal discriminants — a plain
 * `if (!result.ok)` does NOT give you the failure branch. This predicate does,
 * without any cast at the call site.
 */
export function isTransitionFailure(
  result: TransitionResult
): result is TransitionFailure {
  return result.ok !== true;
}

interface Rule {
  from: NashrApprovalStageName;
  decision: NashrApprovalDecisionName;
  /** Roles allowed to make this decision from this stage. */
  roles: readonly NashrRoleName[];
  /** Static target stage, or a resolver when the target depends on config. */
  to:
    | NashrApprovalStageName
    | ((options: Required<TransitionOptions>) => NashrApprovalStageName);
}

const AUTHORS: readonly NashrRoleName[] = ['OWNER', 'ADMIN', 'EDITOR'];
const INTERNAL_REVIEWERS: readonly NashrRoleName[] = ['OWNER', 'ADMIN', 'APPROVER'];
const CLIENT_REVIEWERS: readonly NashrRoleName[] = ['OWNER', 'ADMIN', 'CLIENT'];
const ORG_MANAGERS: readonly NashrRoleName[] = ['OWNER', 'ADMIN'];

/**
 * The complete transition table.
 *
 * Note what is deliberately absent:
 *   - EDITOR appears in no APPROVED / REJECTED / CHANGES_REQUESTED rule, so an
 *     editor can never approve their own (or anyone's) work.
 *   - CLIENT appears only on CLIENT_APPROVAL rules, so a client can never make
 *     an internal review decision.
 *   - APPROVER appears only on INTERNAL_REVIEW rules, so internal sign-off
 *     cannot substitute for the client's.
 *   - VIEWER appears nowhere at all.
 *   - There is no rule out of APPROVED other than WITHDRAWN, so approval cannot
 *     be laundered into a different stage without a fresh, logged decision.
 */
export const TRANSITIONS: readonly Rule[] = [
  // ── Draft → internal review ────────────────────────────────────────────────
  { from: 'DRAFT', decision: 'SUBMITTED', roles: AUTHORS, to: 'INTERNAL_REVIEW' },
  // Re-submission after changes were requested.
  {
    from: 'CHANGES_REQUESTED',
    decision: 'SUBMITTED',
    roles: AUTHORS,
    to: 'INTERNAL_REVIEW',
  },
  // REJECTED is terminal *until resubmitted* — this rule is the only way out.
  { from: 'REJECTED', decision: 'SUBMITTED', roles: AUTHORS, to: 'INTERNAL_REVIEW' },

  // ── Internal review decisions ─────────────────────────────────────────────
  {
    from: 'INTERNAL_REVIEW',
    decision: 'APPROVED',
    roles: INTERNAL_REVIEWERS,
    to: (options) =>
      options.clientApprovalRequired ? 'CLIENT_APPROVAL' : 'APPROVED',
  },
  {
    from: 'INTERNAL_REVIEW',
    decision: 'CHANGES_REQUESTED',
    roles: INTERNAL_REVIEWERS,
    to: 'CHANGES_REQUESTED',
  },
  {
    from: 'INTERNAL_REVIEW',
    decision: 'REJECTED',
    roles: INTERNAL_REVIEWERS,
    to: 'REJECTED',
  },
  { from: 'INTERNAL_REVIEW', decision: 'WITHDRAWN', roles: AUTHORS, to: 'DRAFT' },

  // ── Client approval decisions ─────────────────────────────────────────────
  {
    from: 'CLIENT_APPROVAL',
    decision: 'APPROVED',
    roles: CLIENT_REVIEWERS,
    to: 'APPROVED',
  },
  {
    from: 'CLIENT_APPROVAL',
    decision: 'CHANGES_REQUESTED',
    roles: CLIENT_REVIEWERS,
    to: 'CHANGES_REQUESTED',
  },
  {
    from: 'CLIENT_APPROVAL',
    decision: 'REJECTED',
    roles: CLIENT_REVIEWERS,
    to: 'REJECTED',
  },
  { from: 'CLIENT_APPROVAL', decision: 'WITHDRAWN', roles: AUTHORS, to: 'DRAFT' },

  // ── Revoking an approval ──────────────────────────────────────────────────
  // Sending an approved post back to draft un-approves it, which means the
  // publish gate will refuse it until it goes through review again.
  { from: 'APPROVED', decision: 'WITHDRAWN', roles: ORG_MANAGERS, to: 'DRAFT' },
];

function isStage(v: unknown): v is NashrApprovalStageName {
  return (
    typeof v === 'string' &&
    (NASHR_APPROVAL_STAGES as readonly string[]).includes(v)
  );
}
function isDecision(v: unknown): v is NashrApprovalDecisionName {
  return (
    typeof v === 'string' &&
    (NASHR_APPROVAL_DECISIONS as readonly string[]).includes(v)
  );
}
const KNOWN_ROLES: readonly string[] = [
  'OWNER',
  'ADMIN',
  'EDITOR',
  'APPROVER',
  'CLIENT',
  'VIEWER',
];
function isRole(v: unknown): v is NashrRoleName {
  return typeof v === 'string' && KNOWN_ROLES.includes(v);
}

/**
 * The transition function. Never throws; always returns a discriminated result
 * so callers must handle failure explicitly.
 *
 * Distinguishes "this transition does not exist" (ILLEGAL_TRANSITION) from
 * "this transition exists but you may not perform it" (ROLE_NOT_PERMITTED),
 * because the two produce different UI and different audit meaning.
 */
export function transition(input: TransitionInput): TransitionResult {
  const { currentStage, decision, actorRole } = input ?? ({} as TransitionInput);

  if (!isStage(currentStage)) {
    return {
      ok: false,
      code: 'UNKNOWN_STAGE',
      reason: `Unknown approval stage: ${String(currentStage)}`,
    };
  }
  if (!isDecision(decision)) {
    return {
      ok: false,
      code: 'UNKNOWN_DECISION',
      reason: `Unknown approval decision: ${String(decision)}`,
    };
  }
  if (!isRole(actorRole)) {
    return {
      ok: false,
      code: 'UNKNOWN_ROLE',
      reason: `Unknown role: ${String(actorRole)}`,
    };
  }

  const options: Required<TransitionOptions> = {
    clientApprovalRequired: input.options?.clientApprovalRequired ?? true,
  };

  const matching = TRANSITIONS.filter(
    (r) => r.from === currentStage && r.decision === decision
  );

  if (matching.length === 0) {
    return {
      ok: false,
      code: 'ILLEGAL_TRANSITION',
      reason: `${decision} is not a legal decision from stage ${currentStage}`,
    };
  }

  const permitted = matching.find((r) => r.roles.includes(actorRole));
  if (!permitted) {
    return {
      ok: false,
      code: 'ROLE_NOT_PERMITTED',
      reason: `Role ${actorRole} may not record ${decision} from stage ${currentStage}`,
    };
  }

  const nextStage =
    typeof permitted.to === 'function' ? permitted.to(options) : permitted.to;

  return { ok: true, nextStage };
}

/** Every decision `role` may legally record from `stage`. Drives the UI. */
export function legalDecisionsFor(
  stage: unknown,
  role: unknown
): NashrApprovalDecisionName[] {
  if (!isStage(stage) || !isRole(role)) return [];
  const out = new Set<NashrApprovalDecisionName>();
  for (const rule of TRANSITIONS) {
    if (rule.from === stage && rule.roles.includes(role)) {
      out.add(rule.decision);
    }
  }
  return [...out];
}

/** Human-readable label for the pipeline position. Useful for notifications. */
export function describeStage(stage: NashrApprovalStageName): string {
  switch (stage) {
    case 'DRAFT':
      return 'Draft';
    case 'INTERNAL_REVIEW':
      return 'Internal review';
    case 'CLIENT_APPROVAL':
      return 'Awaiting client approval';
    case 'APPROVED':
      return 'Approved — ready to schedule';
    case 'CHANGES_REQUESTED':
      return 'Changes requested';
    case 'REJECTED':
      return 'Rejected';
  }
}
