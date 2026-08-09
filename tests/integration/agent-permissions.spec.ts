/**
 * Nashr (نشر) — AI agent permissions (RISK-S3).
 *
 * The two claims that matter:
 *   1. A sensitive tool does not execute without a valid, human-minted,
 *      single-use confirmation.
 *   2. A model cannot approve its own proposal — it never receives anything
 *      that authorises anything.
 *
 * The unit suite in libraries/nashr-agents proves the guardrail logic with
 * in-memory fakes. This suite adds what a fake cannot: the real
 * GuardrailRuntime writing real `NashrAgentActionLog` rows to real PostgreSQL,
 * with tenant scoping and redaction verified on the persisted rows, and the
 * real HTTP approve-endpoint logic reproduced faithfully (it is the sole
 * caller of signConfirmation).
 */
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { prisma, disconnect } from '../fixtures/db';
import { seedTwoTenants, SeededTenant } from '../fixtures/seed';

import {
  AuditLogger,
  GuardrailRuntime,
  InMemoryProposalStore,
  NASHR_AGENT_LIMITS,
  hashArgs,
  signConfirmation,
} from '@gitroom/nashr-agents';
import type {
  ActionLogEntry,
  ActionLogPort,
} from '@gitroom/nashr-agents/ports';
import type {
  NashrToolContext,
  NashrToolDefinition,
} from '@gitroom/nashr-agents/types';
import { INHERENTLY_SENSITIVE_CATEGORIES } from '@gitroom/nashr-agents/types';
import { buildNashrAgentRegistry } from '@gitroom/nashr-agents/agents';
import { makePorts } from '@gitroom/nashr-agents/__tests__/test.harness';

// Obviously fake, local-only.
const TEST_SECRET = 'nashr-local-test-proposal-secret-0123456789';

let db: PrismaClient;
let victim: SeededTenant;
let attacker: SeededTenant;
let runtime: GuardrailRuntime;
let proposals: InMemoryProposalStore;

/** Real Prisma-backed audit port — rows land in the test database. */
class RealActionLogPort implements ActionLogPort {
  constructor(private readonly client: PrismaClient) {}
  async record(entry: ActionLogEntry): Promise<{ id: string }> {
    return this.client.nashrAgentActionLog.create({
      data: {
        organizationId: entry.organizationId,
        userOrgId: entry.userOrgId ?? null,
        agentKey: entry.agentKey,
        toolName: entry.toolName,
        sensitive: entry.sensitive,
        status: entry.status as any,
        argsDigest: entry.argsDigest ?? null,
        resultSummary: entry.resultSummary ?? null,
        errorMessage: entry.errorMessage ?? null,
        attempts: entry.attempts,
        durationMs: entry.durationMs ?? null,
      },
      select: { id: true },
    });
  }
}

/** How many times the handler actually ran — the only thing that matters. */
let sideEffects: string[] = [];

const sensitiveTool: NashrToolDefinition<{ caption: string }, { ok: boolean }> = {
  id: 'publish_caption',
  title: 'Publish a caption',
  description: 'Publishes a caption to a connected channel.',
  // 'publish' is inherently sensitive, so it MUST be declared sensitive.
  category: 'publish',
  sensitive: true,
  inputSchema: z.object({ caption: z.string().min(1) }),
  outputSchema: z.object({ ok: z.boolean() }),
  handler: async (input) => {
    sideEffects.push(input.caption);
    return { ok: true };
  },
  describeProposal: (input) => ({
    title: 'Publish a caption',
    summary: `Publish: ${input.caption}`,
    details: [{ label: 'Caption', value: input.caption }],
    effect: 'The caption becomes publicly visible.',
    reversible: false,
  }),
};

const readTool: NashrToolDefinition<{ q: string }, { hits: number }> = {
  id: 'search_brand',
  title: 'Search the brand profile',
  description: 'Read-only lookup.',
  category: 'read',
  sensitive: false,
  inputSchema: z.object({ q: z.string() }),
  outputSchema: z.object({ hits: z.number() }),
  handler: async () => ({ hits: 1 }),
};

function ctxFor(tenant: SeededTenant): NashrToolContext {
  return {
    organizationId: tenant.orgId,
    userOrgId: tenant.members.ADMIN.userOrgId,
    userId: tenant.members.ADMIN.userId,
    locale: 'en',
    market: 'AE',
    requestId: 'req-integration',
    now: new Date(),
  };
}

/**
 * Faithful reproduction of the ONLY production path that mints a confirmation:
 * nashr-agents.controller.ts POST /proposals/:id/approve, which runs behind
 * the authenticated middleware. Reproduced (rather than imported) because the
 * controller needs the full Nest request pipeline; the logic under test is the
 * state transition plus signConfirmation, both of which are the real ones.
 */
async function humanApproves(
  organizationId: string,
  proposalId: string,
  approverUserId: string
): Promise<string> {
  const stored = await proposals.get(organizationId, proposalId);
  if (!stored) throw new Error('proposal not found');
  if (stored.state !== 'PROPOSED') throw new Error('not approvable');
  await proposals.update(organizationId, proposalId, {
    state: 'APPROVED',
    approvedByUserId: approverUserId,
    approvedAt: new Date().toISOString(),
  });
  return signConfirmation(
    {
      proposalId: stored.proposalId,
      organizationId,
      toolId: stored.toolId,
      argsHash: stored.argsHash,
      approvedByUserId: approverUserId,
      expiresAt: new Date(stored.expiresAt).getTime(),
    },
    TEST_SECRET
  );
}

beforeAll(async () => {
  db = prisma();
  const tenants = await seedTwoTenants(db);
  victim = tenants.victim;
  attacker = tenants.attacker;
});

beforeEach(() => {
  sideEffects = [];
  proposals = new InMemoryProposalStore();
  runtime = new GuardrailRuntime({
    audit: new AuditLogger(new RealActionLogPort(db)),
    proposals,
    secret: () => TEST_SECRET,
    // Deterministic and fast — no real backoff sleeping.
    sleep: async () => undefined,
    random: () => 0.5,
  });
});

afterAll(async () => {
  await disconnect();
});

// ───────────────────────────────────────────────────────────────────────────
describe('a sensitive tool does not execute without a confirmation', () => {
  it('returns a proposal and runs NOTHING', async () => {
    const result = await runtime.execute(
      'content',
      sensitiveTool,
      { caption: 'Ramadan Kareem from Gulf Eats' },
      ctxFor(victim)
    );

    expect(result.status).toBe('awaiting_approval');
    expect(sideEffects).toEqual([]);
  });

  it('the object handed back to the model carries NO authorising material', async () => {
    const result: any = await runtime.execute(
      'content',
      sensitiveTool,
      { caption: 'hello' },
      ctxFor(victim)
    );
    const proposal = result.proposal;

    // An opaque id and human-readable preview text. Nothing else.
    expect(typeof proposal.proposalId).toBe('string');
    expect(proposal.requiresHumanApproval).toBe(true);

    const serialised = JSON.stringify(proposal);
    expect(serialised).not.toContain(TEST_SECRET);
    // A confirmation token is `payload.signature`; the proposal must contain
    // no such structure and no field that looks like one.
    for (const key of ['confirmationToken', 'token', 'signature', 'hmac', 'secret']) {
      expect(`${key}:${key in proposal}`).toEqual(`${key}:false`);
    }
    // And the stored argsHash — the thing a token is bound to — is not leaked.
    const stored = await proposals.get(victim.orgId, proposal.proposalId);
    expect(serialised).not.toContain(stored!.argsHash);
  });

  it('a model replaying the proposalId as if it were a token does not execute', async () => {
    const first: any = await runtime.execute(
      'content',
      sensitiveTool,
      { caption: 'attempt' },
      ctxFor(victim)
    );
    const proposalId = first.proposal.proposalId;

    const replay = await runtime.execute(
      'content',
      sensitiveTool,
      { caption: 'attempt', proposalId, confirmationToken: proposalId },
      ctxFor(victim)
    );

    expect(replay.status).toBe('error');
    expect(sideEffects).toEqual([]);
  });

  it('a proposal that is merely PROPOSED (never approved by a human) is refused', async () => {
    const first: any = await runtime.execute(
      'content',
      sensitiveTool,
      { caption: 'no human here' },
      ctxFor(victim)
    );
    const stored = await proposals.get(victim.orgId, first.proposal.proposalId);

    // Forge a perfectly-signed token WITHOUT going through the approve
    // endpoint. The signature verifies; the store still says PROPOSED.
    const forged = signConfirmation(
      {
        proposalId: stored!.proposalId,
        organizationId: victim.orgId,
        toolId: stored!.toolId,
        argsHash: stored!.argsHash,
        approvedByUserId: 'the-model-itself',
        expiresAt: new Date(stored!.expiresAt).getTime(),
      },
      TEST_SECRET
    );

    const result = await runtime.execute(
      'content',
      sensitiveTool,
      { caption: 'no human here', confirmationToken: forged },
      ctxFor(victim)
    );

    expect(result.status).toBe('error');
    expect(sideEffects).toEqual([]);
  });

  it('a token signed with the wrong secret is refused', async () => {
    const first: any = await runtime.execute(
      'content',
      sensitiveTool,
      { caption: 'wrong key' },
      ctxFor(victim)
    );
    const stored = await proposals.get(victim.orgId, first.proposal.proposalId);
    await proposals.update(victim.orgId, stored!.proposalId, {
      state: 'APPROVED',
      approvedByUserId: victim.members.ADMIN.userId,
    });

    const badToken = signConfirmation(
      {
        proposalId: stored!.proposalId,
        organizationId: victim.orgId,
        toolId: stored!.toolId,
        argsHash: stored!.argsHash,
        approvedByUserId: victim.members.ADMIN.userId,
        expiresAt: new Date(stored!.expiresAt).getTime(),
      },
      'a-different-local-test-secret-000000'
    );

    const result = await runtime.execute(
      'content',
      sensitiveTool,
      { caption: 'wrong key', confirmationToken: badToken },
      ctxFor(victim)
    );
    expect(result.status).toBe('error');
    expect(sideEffects).toEqual([]);
  });
});

describe('a human-approved confirmation executes exactly once', () => {
  it('executes after the approve endpoint mints a token', async () => {
    const first: any = await runtime.execute(
      'content',
      sensitiveTool,
      { caption: 'approved copy' },
      ctxFor(victim)
    );
    const token = await humanApproves(
      victim.orgId,
      first.proposal.proposalId,
      victim.members.ADMIN.userId
    );

    const result = await runtime.execute(
      'content',
      sensitiveTool,
      { caption: 'approved copy', confirmationToken: token },
      ctxFor(victim)
    );

    expect(result.status).toBe('ok');
    expect(sideEffects).toEqual(['approved copy']);
  });

  it('the same token cannot be used twice', async () => {
    const first: any = await runtime.execute(
      'content',
      sensitiveTool,
      { caption: 'once only' },
      ctxFor(victim)
    );
    const token = await humanApproves(
      victim.orgId,
      first.proposal.proposalId,
      victim.members.ADMIN.userId
    );

    const one = await runtime.execute(
      'content',
      sensitiveTool,
      { caption: 'once only', confirmationToken: token },
      ctxFor(victim)
    );
    const two = await runtime.execute(
      'content',
      sensitiveTool,
      { caption: 'once only', confirmationToken: token },
      ctxFor(victim)
    );

    expect(one.status).toBe('ok');
    expect(two.status).toBe('error');
    expect(sideEffects).toEqual(['once only']);
  });

  it('changing the arguments after approval invalidates the token', async () => {
    const first: any = await runtime.execute(
      'content',
      sensitiveTool,
      { caption: 'harmless caption' },
      ctxFor(victim)
    );
    const token = await humanApproves(
      victim.orgId,
      first.proposal.proposalId,
      victim.members.ADMIN.userId
    );

    // The classic bait-and-switch: approve something benign, execute something
    // else with the same token.
    const result = await runtime.execute(
      'content',
      sensitiveTool,
      { caption: 'BUY NOW, guaranteed cure', confirmationToken: token },
      ctxFor(victim)
    );

    expect(result.status).toBe('error');
    expect(sideEffects).toEqual([]);
  });

  it('an expired approval is refused', async () => {
    const first: any = await runtime.execute(
      'content',
      sensitiveTool,
      { caption: 'stale' },
      ctxFor(victim)
    );
    const token = await humanApproves(
      victim.orgId,
      first.proposal.proposalId,
      victim.members.ADMIN.userId
    );

    const future = {
      ...ctxFor(victim),
      now: new Date(Date.now() + NASHR_AGENT_LIMITS.proposalTtlMs + 60_000),
    };
    const result = await runtime.execute(
      'content',
      sensitiveTool,
      { caption: 'stale', confirmationToken: token },
      future
    );
    expect(result.status).toBe('error');
    expect(sideEffects).toEqual([]);
  });
});

describe('agent tenancy', () => {
  it('a confirmation approved in one organization cannot execute in another', async () => {
    const first: any = await runtime.execute(
      'content',
      sensitiveTool,
      { caption: 'victim copy' },
      ctxFor(victim)
    );
    const token = await humanApproves(
      victim.orgId,
      first.proposal.proposalId,
      victim.members.ADMIN.userId
    );

    const result = await runtime.execute(
      'content',
      sensitiveTool,
      { caption: 'victim copy', confirmationToken: token },
      ctxFor(attacker)
    );

    expect(result.status).toBe('error');
    expect(sideEffects).toEqual([]);
  });

  /**
   * Two layers stop a model widening its own scope. The Zod schema strips any
   * key the tool did not declare, so a smuggled `organizationId` never reaches
   * the handler at all; and for a tool that DOES declare an org field,
   * assertOrgScope rejects a value that is not the caller's.
   */
  it('an undeclared organizationId is stripped and never reaches the handler', async () => {
    let seen: any = null;
    const spy: NashrToolDefinition<{ q: string }, { hits: number }> = {
      ...readTool,
      id: 'spy_read',
      handler: async (input) => {
        seen = input;
        return { hits: 1 };
      },
    };

    const result = await runtime.execute(
      'analytics',
      spy,
      { q: 'x', organizationId: victim.orgId } as any,
      ctxFor(attacker)
    );

    expect(result.status).toBe('ok');
    expect(seen).toEqual({ q: 'x' });
    expect(JSON.stringify(seen)).not.toContain(victim.orgId);
  });

  it('a DECLARED organizationId naming a foreign tenant is refused', async () => {
    let ran = false;
    const scoped: NashrToolDefinition<
      { q: string; organizationId?: string },
      { hits: number }
    > = {
      ...readTool,
      id: 'scoped_read',
      inputSchema: z.object({ q: z.string(), organizationId: z.string().optional() }),
      handler: async () => {
        ran = true;
        return { hits: 1 };
      },
    };

    const result = await runtime.execute(
      'analytics',
      scoped,
      { q: 'x', organizationId: victim.orgId },
      ctxFor(attacker)
    );

    expect(result.status).toBe('error');
    expect(ran).toBe(false);
  });

  it('a foreign organizationId buried deep in a declared object is still caught', async () => {
    let ran = false;
    const nested: NashrToolDefinition<any, { hits: number }> = {
      ...readTool,
      id: 'nested_read',
      inputSchema: z.object({
        q: z.string(),
        filter: z.object({ nested: z.array(z.object({ orgId: z.string() })) }),
      }),
      handler: async () => {
        ran = true;
        return { hits: 1 };
      },
    };

    const result = await runtime.execute(
      'analytics',
      nested,
      { q: 'x', filter: { nested: [{ orgId: victim.orgId }] } },
      ctxFor(attacker)
    );

    expect(result.status).toBe('error');
    expect(ran).toBe(false);
  });
});

describe('the audit trail lands in PostgreSQL and is tenant-scoped', () => {
  it('a proposal writes an AWAITING_APPROVAL row for the calling org only', async () => {
    const before = await db.nashrAgentActionLog.count({
      where: { organizationId: victim.orgId },
    });
    const foreignBefore = await db.nashrAgentActionLog.count({
      where: { organizationId: attacker.orgId, toolName: 'publish_caption' },
    });

    await runtime.execute(
      'content',
      sensitiveTool,
      { caption: 'audited' },
      ctxFor(victim)
    );

    const rows = await db.nashrAgentActionLog.findMany({
      where: { organizationId: victim.orgId, toolName: 'publish_caption' },
      orderBy: { createdAt: 'desc' },
      take: 1,
    });
    expect(rows[0].status).toBe('AWAITING_APPROVAL');
    expect(rows[0].sensitive).toBe(true);
    expect(rows[0].organizationId).toBe(victim.orgId);

    const after = await db.nashrAgentActionLog.count({
      where: { organizationId: victim.orgId },
    });
    expect(after).toBe(before + 1);

    // Nothing new was written under the other tenant by THIS call.
    const foreignAfter = await db.nashrAgentActionLog.count({
      where: { organizationId: attacker.orgId, toolName: 'publish_caption' },
    });
    expect(foreignAfter).toBe(foreignBefore);
  });

  it('the persisted args digest is redacted — no raw secrets reach the log', async () => {
    await runtime.execute(
      'content',
      sensitiveTool,
      {
        caption:
          'contact ceo@gulfeats.example or +971501234567, key sk-proj-abcdef1234567890abcdef',
      },
      ctxFor(victim)
    );

    const row = await db.nashrAgentActionLog.findFirst({
      where: { organizationId: victim.orgId, toolName: 'publish_caption' },
      orderBy: { createdAt: 'desc' },
    });

    const blob = `${row!.argsDigest ?? ''} ${row!.resultSummary ?? ''} ${
      row!.errorMessage ?? ''
    }`;
    expect(blob).not.toContain('ceo@gulfeats.example');
    expect(blob).not.toContain('+971501234567');
    expect(blob).not.toContain('sk-proj-abcdef1234567890abcdef');
  });

  it('a rejected execution is audited as an error, not silently dropped', async () => {
    const before = await db.nashrAgentActionLog.count({
      where: { organizationId: victim.orgId },
    });
    await runtime.execute(
      'content',
      sensitiveTool,
      { caption: 'x', confirmationToken: 'not-a-real-token' },
      ctxFor(victim)
    );
    const after = await db.nashrAgentActionLog.count({
      where: { organizationId: victim.orgId },
    });
    expect(after).toBeGreaterThan(before);
  });
});

describe('registration-time guarantees', () => {
  /**
   * The REAL six agents and their REAL tool definitions. Only the data ports
   * are fakes — the tool metadata under inspection here is production code.
   */
  function realTools() {
    const registry = buildNashrAgentRegistry({ ports: makePorts() });
    return registry.list().flatMap((agent) => agent.tools);
  }

  it('every inherently-sensitive category in the real registry is declared sensitive', () => {
    const tools = realTools();
    expect(tools.length).toBeGreaterThan(0);
    for (const tool of tools) {
      if (INHERENTLY_SENSITIVE_CATEGORIES.includes(tool.category)) {
        expect(`${tool.id}.sensitive=${tool.sensitive}`).toEqual(
          `${tool.id}.sensitive=true`
        );
      }
    }
  });

  it('the real registry declares several sensitive tools across six agents', () => {
    const registry = buildNashrAgentRegistry({ ports: makePorts() });
    expect(registry.list()).toHaveLength(6);
    const sensitive = realTools().filter((t) => t.sensitive);
    expect(sensitive.length).toBeGreaterThan(0);
  });

  it('every sensitive real tool refuses to run without a confirmation', async () => {
    const registry = buildNashrAgentRegistry({ ports: makePorts() });
    const sensitive = registry
      .list()
      .flatMap((a) => a.tools.map((t) => ({ agentKey: a.key, tool: t })))
      .filter((e) => e.tool.sensitive);

    expect(sensitive.length).toBeGreaterThan(0);

    for (const { agentKey, tool } of sensitive) {
      // Deliberately empty input: whatever the schema is, the call must never
      // reach the handler without a confirmation. Either the guardrail returns
      // a proposal, or it errors on schema — never 'ok'.
      const result = await runtime.execute(
        agentKey,
        tool as any,
        {},
        ctxFor(victim)
      );
      expect(`${tool.id}:${result.status}`).not.toEqual(`${tool.id}:ok`);
    }
  });

  it('a sensitive write tool gets ZERO retries — a failed write is never replayed', async () => {
    let calls = 0;
    const flaky: NashrToolDefinition<{ v: string }, { ok: boolean }> = {
      ...sensitiveTool,
      id: 'flaky_write',
      category: 'write',
      idempotent: false,
      inputSchema: z.object({ v: z.string() }),
      outputSchema: z.object({ ok: z.boolean() }),
      handler: async () => {
        calls += 1;
        throw new Error('transient upstream failure');
      },
    } as any;

    const first: any = await runtime.execute('content', flaky, { v: 'a' }, ctxFor(victim));
    const token = await humanApproves(
      victim.orgId,
      first.proposal.proposalId,
      victim.members.ADMIN.userId
    );
    const result = await runtime.execute(
      'content',
      flaky,
      { v: 'a', confirmationToken: token },
      ctxFor(victim)
    );

    expect(result.status).toBe('error');
    expect(calls).toBe(1);
  });
});
