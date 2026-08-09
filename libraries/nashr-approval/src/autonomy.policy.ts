/**
 * Nashr (نشر) — autonomous publishing policy.
 *
 * Autonomous publishing (publishing without a recorded human APPROVED decision)
 * is OFF BY DEFAULT for every organization. There is no code path that turns it
 * on implicitly: an org must be named explicitly in configuration.
 *
 * SCHEMA GAP: `NashrBrandProfile` has no per-brand autonomy column, and
 * `Organization` has no per-org one either, so the opt-in currently lives in
 * environment configuration. See the note at the bottom of this file for the
 * exact column to add. When that column lands, `resolveAutonomyPolicy` gains a
 * DB read and the env allowlist becomes a fallback only — the default (deny)
 * does not change.
 *
 * Pure and dependency-free so it is unit-testable; `env` is injected.
 */

export type EnvLike = Record<string, string | undefined>;

export interface AutonomyPolicy {
  /** When false (the default) a post needs an APPROVED record before it flies. */
  autonomousPublishing: boolean;
  /** Where the decision came from — logged so an audit can explain a bypass. */
  source: 'default-deny' | 'org-allowlist' | 'global-disabled-gate';
}

function parseList(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Per-organization opt-in.
 *
 * `NASHR_AUTONOMOUS_PUBLISH_ORG_IDS` — comma-separated organization IDs allowed
 * to publish without approval. Absent or empty (the default) ⇒ everyone needs
 * approval.
 *
 * `NASHR_APPROVAL_GATE_ENABLED=false` — a global break-glass kill switch for
 * incident response. Defaults to enabled; any value other than the literal
 * string 'false' keeps the gate on, so a typo fails closed.
 */
export function resolveAutonomyPolicy(
  organizationId: string,
  env: EnvLike = process.env
): AutonomyPolicy {
  if (env.NASHR_APPROVAL_GATE_ENABLED === 'false') {
    return { autonomousPublishing: true, source: 'global-disabled-gate' };
  }

  const allowlist = parseList(env.NASHR_AUTONOMOUS_PUBLISH_ORG_IDS);
  if (organizationId && allowlist.includes(organizationId)) {
    return { autonomousPublishing: true, source: 'org-allowlist' };
  }

  return { autonomousPublishing: false, source: 'default-deny' };
}

/** Convenience wrapper: does this org still need a human APPROVED record? */
export function requiresApproval(
  organizationId: string,
  env: EnvLike = process.env
): boolean {
  return !resolveAutonomyPolicy(organizationId, env).autonomousPublishing;
}

/**
 * Whether the client sign-off stage applies. Same story as above — there is no
 * schema column yet, so this is org-level configuration with a safe default
 * (client approval IS required unless the org opts out).
 */
export function clientApprovalRequired(
  organizationId: string,
  env: EnvLike = process.env
): boolean {
  const skipList = parseList(env.NASHR_SKIP_CLIENT_APPROVAL_ORG_IDS);
  return !(organizationId && skipList.includes(organizationId));
}

/*
 * ─────────────────────────────────────────────────────────────────────────────
 * REQUESTED SCHEMA CHANGE (not applied — schema.prisma is owned elsewhere)
 *
 *   model NashrBrandProfile {
 *     ...
 *     /// Publish without a recorded human approval. Off by default.
 *     autonomousPublishing  Boolean @default(false)
 *     /// Require the client's sign-off after internal review.
 *     clientApprovalRequired Boolean @default(true)
 *   }
 *
 * and, for CLIENT tenant scoping:
 *
 *   model UserOrganization {
 *     ...
 *     /// Brand a CLIENT member is attached to. NULL for staff roles.
 *     nashrCustomerId String?
 *     nashrCustomer   Customer? @relation(fields: [nashrCustomerId], references: [id])
 *   }
 * ─────────────────────────────────────────────────────────────────────────────
 */
