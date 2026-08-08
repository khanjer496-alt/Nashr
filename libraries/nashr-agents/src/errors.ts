/**
 * Typed failures for the Nashr agent layer.
 *
 * Rule: nothing thrown inside a tool handler ever reaches the model or the user
 * verbatim. `toSafeError()` is the only exit; it emits a stable code and a
 * short, redacted, human-safe sentence. Stack traces, provider payloads,
 * Prisma messages and internal identifiers stay server-side.
 */
import type { NashrAgentStatusValue, SafeError } from './types';
import { redactText } from './redaction';

export type NashrErrorCode =
  | 'INVALID_INPUT'
  | 'FORBIDDEN'
  | 'CROSS_TENANT'
  | 'NOT_FOUND'
  | 'APPROVAL_REQUIRED'
  | 'APPROVAL_INVALID'
  | 'SELF_APPROVAL_BLOCKED'
  | 'TIMEOUT'
  | 'RETRY_EXHAUSTED'
  | 'TOKEN_BUDGET_EXCEEDED'
  | 'UPSTREAM_UNAVAILABLE'
  | 'NOT_CONFIGURED'
  | 'PROHIBITED_CLAIM'
  | 'INTERNAL';

/** Messages below are the ONLY strings that may be shown to a user or model. */
const SAFE_MESSAGES: Record<NashrErrorCode, string> = {
  INVALID_INPUT: 'The request was not valid for this tool.',
  FORBIDDEN: 'You do not have permission to perform this action.',
  CROSS_TENANT: 'That resource does not belong to this workspace.',
  NOT_FOUND: 'The requested record was not found in this workspace.',
  APPROVAL_REQUIRED: 'This action needs to be approved by a person before it can run.',
  APPROVAL_INVALID: 'The approval for this action is missing, expired, or already used.',
  SELF_APPROVAL_BLOCKED: 'An agent cannot record an approval on a person’s behalf.',
  TIMEOUT: 'The action took too long and was stopped.',
  RETRY_EXHAUSTED: 'The action failed repeatedly and was stopped.',
  TOKEN_BUDGET_EXCEEDED: 'This conversation reached its processing limit for now.',
  UPSTREAM_UNAVAILABLE: 'A service this action depends on is unavailable right now.',
  NOT_CONFIGURED: 'This capability is not configured for this deployment.',
  PROHIBITED_CLAIM: 'The generated content violated the brand’s prohibited claims.',
  INTERNAL: 'Something went wrong. The action was not completed.',
};

/** Codes that may be retried. Retrying anything else risks duplicate writes. */
const RETRIABLE: ReadonlySet<NashrErrorCode> = new Set<NashrErrorCode>([
  'UPSTREAM_UNAVAILABLE',
  'TIMEOUT',
]);

/** How a failure is recorded in `NashrAgentActionLog.status`. */
const STATUS_FOR_CODE: Partial<Record<NashrErrorCode, NashrAgentStatusValue>> = {
  TIMEOUT: 'TIMED_OUT',
  RETRY_EXHAUSTED: 'FAILED',
  APPROVAL_REQUIRED: 'AWAITING_APPROVAL',
  APPROVAL_INVALID: 'REJECTED',
  SELF_APPROVAL_BLOCKED: 'REJECTED',
};

export class NashrAgentError extends Error {
  readonly code: NashrErrorCode;
  /** Never sent anywhere except the server log. Already redacted. */
  readonly internalDetail?: string;

  constructor(code: NashrErrorCode, internalDetail?: string) {
    super(SAFE_MESSAGES[code]);
    this.name = 'NashrAgentError';
    this.code = code;
    this.internalDetail = internalDetail ? redactText(internalDetail) : undefined;
    // Restore prototype chain under ES2015 downlevel targets.
    Object.setPrototypeOf(this, new.target.prototype);
  }

  get retriable(): boolean {
    return RETRIABLE.has(this.code);
  }

  get status(): NashrAgentStatusValue {
    return STATUS_FOR_CODE[this.code] ?? 'FAILED';
  }

  toSafe(): SafeError {
    return { code: this.code, message: SAFE_MESSAGES[this.code] };
  }
}

export const invalidInput = (d?: string) => new NashrAgentError('INVALID_INPUT', d);
export const forbidden = (d?: string) => new NashrAgentError('FORBIDDEN', d);
export const crossTenant = (d?: string) => new NashrAgentError('CROSS_TENANT', d);
export const notFound = (d?: string) => new NashrAgentError('NOT_FOUND', d);
export const approvalRequired = (d?: string) => new NashrAgentError('APPROVAL_REQUIRED', d);
export const approvalInvalid = (d?: string) => new NashrAgentError('APPROVAL_INVALID', d);
export const selfApprovalBlocked = (d?: string) =>
  new NashrAgentError('SELF_APPROVAL_BLOCKED', d);
export const timeout = (d?: string) => new NashrAgentError('TIMEOUT', d);
export const upstreamUnavailable = (d?: string) =>
  new NashrAgentError('UPSTREAM_UNAVAILABLE', d);
export const notConfigured = (d?: string) => new NashrAgentError('NOT_CONFIGURED', d);

export function isNashrAgentError(err: unknown): err is NashrAgentError {
  return err instanceof NashrAgentError || (err as any)?.name === 'NashrAgentError';
}

/**
 * Convert anything thrown into a `NashrAgentError`. Unknown throwables collapse
 * to `INTERNAL` so provider errors ("OpenAI 401 invalid api key sk-..."),
 * Prisma errors and stack traces can never be echoed back.
 */
export function normalizeError(err: unknown): NashrAgentError {
  if (isNashrAgentError(err)) return err as NashrAgentError;
  const detail =
    err instanceof Error ? `${err.name}: ${err.message}` : String(err ?? 'unknown');
  return new NashrAgentError('INTERNAL', detail);
}

/** The only sanctioned way to produce something the model/user may see. */
export function toSafeError(err: unknown): SafeError {
  return normalizeError(err).toSafe();
}
