/**
 * Audit trail.
 *
 * Every guarded tool invocation produces at least one `NashrAgentActionLog`
 * row. Writing the row is best-effort *for the caller* (an audit outage must
 * not silently swallow a user's work) but a failure to audit is itself logged
 * and surfaced through `onAuditFailure`, so it cannot pass unnoticed.
 *
 * Nothing raw is persisted: arguments become a redacted digest with a
 * non-reversible fingerprint, results become a redacted summary, and error
 * text is the safe message plus the redacted internal detail.
 */
import { createHash } from 'node:crypto';
import type { ActionLogEntry, ActionLogPort } from './ports';
import type { NashrAgentStatusValue } from './types';
import { buildArgsDigest, buildResultSummary, redactText } from './redaction';
import { normalizeError } from './errors';

export const sha256 = (input: string): string =>
  createHash('sha256').update(input).digest('hex');

export interface AuditRecordInput {
  organizationId: string;
  userOrgId?: string | null;
  agentKey: string;
  toolName: string;
  sensitive: boolean;
  status: NashrAgentStatusValue;
  args?: unknown;
  result?: unknown;
  error?: unknown;
  attempts: number;
  durationMs?: number;
}

export interface AuditLoggerOptions {
  /** Invoked when the audit write itself fails. Default: console.error. */
  onAuditFailure?: (error: Error, entry: ActionLogEntry) => void;
  hash?: (input: string) => string;
}

export class AuditLogger {
  private readonly hash: (input: string) => string;
  private readonly onAuditFailure: (error: Error, entry: ActionLogEntry) => void;

  constructor(private readonly port: ActionLogPort, options: AuditLoggerOptions = {}) {
    this.hash = options.hash ?? sha256;
    this.onAuditFailure =
      options.onAuditFailure ??
      ((error, entry) => {
        // Redacted, structured, no payload.
        // eslint-disable-next-line no-console
        console.error(
          `[nashr-agents] audit write failed agent=${entry.agentKey} tool=${entry.toolName} status=${entry.status}: ${redactText(error.message)}`
        );
      });
  }

  toEntry(input: AuditRecordInput): ActionLogEntry {
    const err = input.error === undefined ? undefined : normalizeError(input.error);
    return {
      organizationId: input.organizationId,
      userOrgId: input.userOrgId ?? null,
      agentKey: input.agentKey,
      toolName: input.toolName,
      sensitive: input.sensitive,
      status: input.status,
      argsDigest:
        input.args === undefined ? null : buildArgsDigest(input.args, this.hash),
      resultSummary:
        input.result === undefined ? null : buildResultSummary(input.result),
      errorMessage: err
        ? redactText(
            `${err.code}: ${err.message}${err.internalDetail ? ` | ${err.internalDetail}` : ''}`
          ).slice(0, 1000)
        : null,
      attempts: input.attempts,
      durationMs: input.durationMs ?? null,
    };
  }

  /** Never throws. A broken audit sink must not break the product. */
  async record(input: AuditRecordInput): Promise<void> {
    const entry = this.toEntry(input);
    try {
      await this.port.record(entry);
    } catch (e) {
      this.onAuditFailure(e instanceof Error ? e : new Error(String(e)), entry);
    }
  }
}

/** In-memory sink. Used by tests and by local development. */
export class InMemoryActionLog implements ActionLogPort {
  readonly entries: ActionLogEntry[] = [];
  private seq = 0;

  async record(entry: ActionLogEntry): Promise<{ id: string }> {
    this.entries.push(entry);
    this.seq += 1;
    return { id: `mem-${this.seq}` };
  }

  /** Convenience for assertions. */
  byTool(toolName: string): ActionLogEntry[] {
    return this.entries.filter((e) => e.toolName === toolName);
  }

  clear(): void {
    this.entries.length = 0;
    this.seq = 0;
  }
}
