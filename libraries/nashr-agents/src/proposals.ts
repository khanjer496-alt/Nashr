/**
 * Proposals — the human-in-the-loop gate for sensitive tools.
 *
 * The threat this design addresses: a model that sees a confirmation secret in
 * a tool result can replay it and approve its own action. So the model never
 * sees one.
 *
 *   1. The agent calls a sensitive tool. The guardrail creates a proposal,
 *      persists it in state PROPOSED, and returns a `ProposedAction` to the
 *      model. That object contains an opaque `proposalId` and redacted preview
 *      text — no signature, no token, nothing that can authorise anything.
 *
 *   2. A human, authenticated over HTTP (nashr-agents.controller.ts →
 *      POST /nashr-agents/proposals/:id/approve), approves it. Only then is a
 *      confirmation token minted — an HMAC over
 *      (proposalId, orgId, toolId, argsHash, approverUserId, expiry).
 *      The token is returned to the browser, never to the model.
 *
 *   3. The client replays the tool call with that token. The guardrail
 *      verifies the HMAC *and* that the stored proposal is in state APPROVED,
 *      then flips it to CONSUMED before the handler runs — so a token is
 *      strictly single-use even if the HMAC is replayed.
 *
 * Both checks are required. The signature alone would allow reuse; the store
 * alone would be forgeable by anything that can write to it.
 */
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import type { ProposalStorePort, StoredProposal } from './ports';
import { approvalInvalid, notConfigured } from './errors';
import { sha256 } from './audit';

export const DEFAULT_PROPOSAL_TTL_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Signing key. Resolved from the environment at call time (never at import
 * time, so a test or a boot-order change cannot pin a stale value).
 * `NASHR_AGENT_PROPOSAL_SECRET` is preferred; `JWT_SECRET` is the fallback so
 * a deployment does not silently run unsigned.
 */
export function resolveProposalSecret(env: NodeJS.ProcessEnv = process.env): string {
  const secret = env.NASHR_AGENT_PROPOSAL_SECRET || env.JWT_SECRET;
  if (!secret || secret.length < 16) {
    throw notConfigured(
      'NASHR_AGENT_PROPOSAL_SECRET (or JWT_SECRET) must be set to at least 16 characters'
    );
  }
  return secret;
}

export interface ProposalClaims {
  proposalId: string;
  organizationId: string;
  toolId: string;
  argsHash: string;
  approvedByUserId: string;
  expiresAt: number;
}

const b64url = (input: string | Buffer): string =>
  Buffer.from(input).toString('base64url');

export function hashArgs(args: unknown): string {
  let raw: string;
  try {
    raw = stableStringify(args);
  } catch {
    raw = String(args);
  }
  return sha256(raw);
}

/** Deterministic JSON so `{a,b}` and `{b,a}` hash identically. */
export function stableStringify(value: unknown): string {
  const walk = (v: unknown): unknown => {
    if (v === null || typeof v !== 'object') return v;
    if (Array.isArray(v)) return v.map(walk);
    return Object.keys(v as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((acc, k) => {
        acc[k] = walk((v as Record<string, unknown>)[k]);
        return acc;
      }, {});
  };
  return JSON.stringify(walk(value));
}

/** Mint an opaque, signed confirmation token. Called ONLY from the HTTP
 *  approval endpoint, after a human has been authenticated. */
export function signConfirmation(
  claims: ProposalClaims,
  secret: string = resolveProposalSecret()
): string {
  const payload = b64url(JSON.stringify(claims));
  const signature = createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

/** Verify signature + expiry. Does NOT consume — that is the store's job. */
export function verifyConfirmation(
  token: string,
  now: Date,
  secret: string = resolveProposalSecret()
): ProposalClaims {
  if (typeof token !== 'string' || !token.includes('.')) {
    throw approvalInvalid('malformed confirmation token');
  }
  const idx = token.lastIndexOf('.');
  const payload = token.slice(0, idx);
  const signature = token.slice(idx + 1);

  const expected = createHmac('sha256', secret).update(payload).digest('base64url');
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw approvalInvalid('confirmation signature mismatch');
  }

  let claims: ProposalClaims;
  try {
    claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    throw approvalInvalid('confirmation payload not decodable');
  }
  if (!claims?.proposalId || !claims?.organizationId || !claims?.toolId) {
    throw approvalInvalid('confirmation payload incomplete');
  }
  if (typeof claims.expiresAt !== 'number' || claims.expiresAt <= now.getTime()) {
    throw approvalInvalid('confirmation expired');
  }
  return claims;
}

export function newProposalId(): string {
  return `prop_${randomUUID()}`;
}

/**
 * Default store. Correct for a single backend process; a multi-instance
 * deployment must swap in a Redis-backed implementation of
 * `ProposalStorePort` (see README → "Deploying with more than one backend").
 */
export class InMemoryProposalStore implements ProposalStorePort {
  private readonly map = new Map<string, StoredProposal>();

  private key(organizationId: string, proposalId: string) {
    return `${organizationId}::${proposalId}`;
  }

  async save(proposal: StoredProposal): Promise<void> {
    this.map.set(this.key(proposal.organizationId, proposal.proposalId), {
      ...proposal,
    });
  }

  async get(organizationId: string, proposalId: string): Promise<StoredProposal | null> {
    const found = this.map.get(this.key(organizationId, proposalId));
    return found ? { ...found } : null;
  }

  async update(
    organizationId: string,
    proposalId: string,
    patch: Partial<StoredProposal>
  ): Promise<StoredProposal | null> {
    const k = this.key(organizationId, proposalId);
    const current = this.map.get(k);
    if (!current) return null;
    const next = { ...current, ...patch };
    this.map.set(k, next);
    return { ...next };
  }

  /** Test/ops helper. Not part of the port. */
  all(): StoredProposal[] {
    return [...this.map.values()];
  }
}
