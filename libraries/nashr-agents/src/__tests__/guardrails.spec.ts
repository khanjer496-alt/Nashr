import { z } from 'zod';
import {
  assertOrgScope,
  backoffDelay,
  GuardrailRuntime,
  NASHR_AGENT_LIMITS,
  splitGuardrailInput,
  TurnBudget,
  withTimeout,
} from '../guardrails';
import { AuditLogger, InMemoryActionLog } from '../audit';
import { InMemoryProposalStore, signConfirmation, hashArgs } from '../proposals';
import { NashrAgentError, upstreamUnavailable } from '../errors';
import type { NashrToolDefinition } from '../types';
import {
  makeContext,
  makeHarness,
  ORG_A,
  ORG_B,
  readTool,
  sensitiveTool,
  TEST_SECRET,
  USER_A,
} from './test.harness';

describe('guardrails — sensitive tools never execute without confirmation', () => {
  it('returns a proposal and does NOT run the handler', async () => {
    const h = makeHarness();
    const handler = jest.fn(async () => ({ done: true }));
    const tool = sensitiveTool(handler);

    const result = await h.runtime.execute('nashrTest', tool, { target: 'instagram' }, makeContext());

    expect(handler).not.toHaveBeenCalled();
    expect(result.status).toBe('awaiting_approval');
    if (result.status !== 'awaiting_approval') throw new Error('unreachable');
    expect(result.proposal.requiresHumanApproval).toBe(true);
    expect(result.proposal.proposalId).toMatch(/^prop_/);
    expect(result.proposal.summary).toContain('instagram');
  });

  it('the proposal carries no signature or token the model could replay', async () => {
    const h = makeHarness();
    const result = await h.runtime.execute(
      'nashrTest',
      sensitiveTool(async () => ({ done: true })),
      { target: 'x' },
      makeContext()
    );
    if (result.status !== 'awaiting_approval') throw new Error('expected a proposal');
    const serialised = JSON.stringify(result.proposal);
    expect(serialised).not.toContain(TEST_SECRET);
    expect(Object.keys(result.proposal)).not.toContain('confirmationToken');
    expect(serialised).not.toMatch(/[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/);
  });

  it('rejects a fabricated confirmation token', async () => {
    const h = makeHarness();
    const handler = jest.fn(async () => ({ done: true }));

    const result = await h.runtime.execute(
      'nashrTest',
      sensitiveTool(handler),
      { target: 'x', confirmationToken: 'not.a.real.token' },
      makeContext()
    );

    expect(handler).not.toHaveBeenCalled();
    expect(result.status).toBe('error');
    if (result.status !== 'error') throw new Error('unreachable');
    expect(result.error.code).toBe('APPROVAL_INVALID');
  });

  it('rejects a token that is signed but was never approved by a human', async () => {
    const h = makeHarness();
    const handler = jest.fn(async () => ({ done: true }));
    const tool = sensitiveTool(handler);
    const ctx = makeContext();
    const args = { target: 'x' };

    const proposed = await h.runtime.execute('nashrTest', tool, args, ctx);
    if (proposed.status !== 'awaiting_approval') throw new Error('expected a proposal');

    // Correctly signed, but the store still says PROPOSED.
    const token = signConfirmation(
      {
        proposalId: proposed.proposal.proposalId,
        organizationId: ORG_A,
        toolId: tool.id,
        argsHash: hashArgs(args),
        approvedByUserId: USER_A,
        expiresAt: Date.now() + 60_000,
      },
      TEST_SECRET
    );

    const result = await h.runtime.execute(
      'nashrTest',
      tool,
      { ...args, confirmationToken: token },
      ctx
    );
    expect(handler).not.toHaveBeenCalled();
    expect(result.status).toBe('error');
  });

  it('executes once a human approved, and only once', async () => {
    const h = makeHarness();
    const handler = jest.fn(async () => ({ done: true }));
    const tool = sensitiveTool(handler);
    const ctx = makeContext();
    const args = { target: 'instagram' };

    const proposed = await h.runtime.execute('nashrTest', tool, args, ctx);
    if (proposed.status !== 'awaiting_approval') throw new Error('expected a proposal');

    const token = await h.humanApproves(proposed.proposal.proposalId, ORG_A, USER_A);

    const first = await h.runtime.execute('nashrTest', tool, { ...args, confirmationToken: token }, ctx);
    expect(first.status).toBe('ok');
    expect(handler).toHaveBeenCalledTimes(1);

    // Replaying the same token must fail: the proposal is CONSUMED.
    const second = await h.runtime.execute('nashrTest', tool, { ...args, confirmationToken: token }, ctx);
    expect(second.status).toBe('error');
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('rejects an approval whose arguments were changed afterwards', async () => {
    const h = makeHarness();
    const handler = jest.fn(async () => ({ done: true }));
    const tool = sensitiveTool(handler);
    const ctx = makeContext();

    const proposed = await h.runtime.execute('nashrTest', tool, { target: 'instagram' }, ctx);
    if (proposed.status !== 'awaiting_approval') throw new Error('expected a proposal');
    const token = await h.humanApproves(proposed.proposal.proposalId, ORG_A, USER_A);

    const result = await h.runtime.execute(
      'nashrTest',
      tool,
      { target: 'facebook', confirmationToken: token },
      ctx
    );

    expect(handler).not.toHaveBeenCalled();
    expect(result.status).toBe('error');
    if (result.status !== 'error') throw new Error('unreachable');
    expect(result.error.code).toBe('APPROVAL_INVALID');
  });

  it('rejects an approval minted for a different organisation', async () => {
    const h = makeHarness();
    const handler = jest.fn(async () => ({ done: true }));
    const tool = sensitiveTool(handler);
    const args = { target: 'x' };

    const proposed = await h.runtime.execute('nashrTest', tool, args, makeContext());
    if (proposed.status !== 'awaiting_approval') throw new Error('expected a proposal');
    await h.humanApproves(proposed.proposal.proposalId, ORG_A, USER_A);

    const foreignToken = signConfirmation(
      {
        proposalId: proposed.proposal.proposalId,
        organizationId: ORG_B,
        toolId: tool.id,
        argsHash: hashArgs(args),
        approvedByUserId: 'user-b',
        expiresAt: Date.now() + 60_000,
      },
      TEST_SECRET
    );

    const result = await h.runtime.execute(
      'nashrTest',
      tool,
      { ...args, confirmationToken: foreignToken },
      makeContext()
    );
    expect(handler).not.toHaveBeenCalled();
    expect(result.status).toBe('error');
    if (result.status !== 'error') throw new Error('unreachable');
    expect(result.error.code).toBe('CROSS_TENANT');
  });

  it('rejects an expired approval', async () => {
    const h = makeHarness();
    const handler = jest.fn(async () => ({ done: true }));
    const tool = sensitiveTool(handler);
    const args = { target: 'x' };
    const ctx = makeContext();

    const proposed = await h.runtime.execute('nashrTest', tool, args, ctx);
    if (proposed.status !== 'awaiting_approval') throw new Error('expected a proposal');
    const token = await h.humanApproves(proposed.proposal.proposalId, ORG_A, USER_A);

    const later = makeContext({ now: new Date(ctx.now.getTime() + 60 * 60 * 1000) });
    const result = await h.runtime.execute('nashrTest', tool, { ...args, confirmationToken: token }, later);

    expect(handler).not.toHaveBeenCalled();
    expect(result.status).toBe('error');
  });
});

describe('guardrails — tenancy', () => {
  it('rejects input that names a foreign organisation', async () => {
    const h = makeHarness();
    const handler = jest.fn(async () => ({ ok: true }));
    const tool: NashrToolDefinition = {
      ...readTool(handler as never),
      inputSchema: z.object({ organizationId: z.string().optional() }),
    };

    const result = await h.runtime.execute('nashrTest', tool, { organizationId: ORG_B }, makeContext());

    expect(handler).not.toHaveBeenCalled();
    expect(result.status).toBe('error');
    if (result.status !== 'error') throw new Error('unreachable');
    expect(result.error.code).toBe('CROSS_TENANT');
  });

  it('finds a foreign organisation id nested inside the payload', () => {
    expect(() =>
      assertOrgScope({ filter: { nested: [{ orgId: ORG_B }] } }, ORG_A)
    ).toThrow(NashrAgentError);
  });

  it('allows the caller to restate its own organisation id', () => {
    expect(() => assertOrgScope({ organizationId: ORG_A }, ORG_A)).not.toThrow();
  });

  it('refuses a context with no organisation at all', () => {
    expect(() => assertOrgScope({}, '')).toThrow(NashrAgentError);
  });

  it('audits the denial', async () => {
    const h = makeHarness();
    const tool: NashrToolDefinition = {
      ...readTool(async () => ({ ok: true })),
      inputSchema: z.object({ organizationId: z.string().optional() }),
    };
    await h.runtime.execute('nashrTest', tool, { organizationId: ORG_B }, makeContext());

    const entry = h.log.entries.at(-1);
    expect(entry?.status).toBe('FAILED');
    expect(entry?.organizationId).toBe(ORG_A);
    expect(entry?.errorMessage).toContain('CROSS_TENANT');
  });
});

describe('guardrails — schema validation', () => {
  it('rejects input that does not match the Zod schema', async () => {
    const h = makeHarness();
    const handler = jest.fn(async () => ({ done: true }));
    const result = await h.runtime.execute(
      'nashrTest',
      sensitiveTool(handler),
      { target: 12345 },
      makeContext()
    );
    expect(handler).not.toHaveBeenCalled();
    expect(result.status).toBe('error');
    if (result.status !== 'error') throw new Error('unreachable');
    expect(result.error.code).toBe('INVALID_INPUT');
  });

  it('rejects a handler result that does not match the output schema', async () => {
    const h = makeHarness();
    const tool: NashrToolDefinition = {
      ...readTool(async () => ({ wrong: true })),
      outputSchema: z.object({ right: z.boolean() }),
    };
    const result = await h.runtime.execute('nashrTest', tool, {}, makeContext());
    expect(result.status).toBe('error');
    if (result.status !== 'error') throw new Error('unreachable');
    expect(result.error.code).toBe('INTERNAL');
  });

  it('strips guardrail fields before the tool schema is applied', () => {
    const { toolInput, confirmationToken } = splitGuardrailInput({
      target: 'x',
      confirmationToken: 'abc',
      proposalId: 'prop_1',
    });
    expect(toolInput).toEqual({ target: 'x' });
    expect(confirmationToken).toBe('abc');
  });
});

describe('guardrails — retries and timeouts', () => {
  it('retries a retriable failure at most twice (3 attempts)', async () => {
    const h = makeHarness();
    const handler = jest.fn(async () => {
      throw upstreamUnavailable('provider down');
    });
    const result = await h.runtime.execute('nashrTest', readTool(handler as never), {}, makeContext());

    expect(handler).toHaveBeenCalledTimes(3);
    expect(result.status).toBe('error');
    expect(h.sleeps).toHaveLength(2);
    expect(h.log.entries.at(-1)?.attempts).toBe(3);
  });

  it('backs off exponentially between attempts', async () => {
    const h = makeHarness();
    await h.runtime.execute(
      'nashrTest',
      readTool(async () => {
        throw upstreamUnavailable('down');
      }),
      {},
      makeContext()
    );
    expect(h.sleeps[1]).toBeGreaterThan(h.sleeps[0]);
  });

  it('does not retry a non-retriable failure', async () => {
    const h = makeHarness();
    const handler = jest.fn(async () => {
      throw new Error('boom');
    });
    await h.runtime.execute('nashrTest', readTool(handler as never), {}, makeContext());
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('never retries a sensitive write, even on a retriable failure', async () => {
    const h = makeHarness();
    const handler = jest.fn(async () => {
      throw upstreamUnavailable('down');
    });
    const tool = sensitiveTool(handler as never);
    const ctx = makeContext();
    const args = { target: 'x' };

    const proposed = await h.runtime.execute('nashrTest', tool, args, ctx);
    if (proposed.status !== 'awaiting_approval') throw new Error('expected a proposal');
    const token = await h.humanApproves(proposed.proposal.proposalId, ORG_A, USER_A);

    await h.runtime.execute('nashrTest', tool, { ...args, confirmationToken: token }, ctx);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('times a slow tool out and records TIMED_OUT', async () => {
    const h = makeHarness({ toolTimeoutMs: 40, maxRetries: 0 });
    const result = await h.runtime.execute(
      'nashrTest',
      readTool(
        () =>
          new Promise((resolve) => {
            const t = setTimeout(() => resolve({ ok: true }), 5_000);
            (t as unknown as { unref?: () => void }).unref?.();
          })
      ),
      {},
      makeContext()
    );

    expect(result.status).toBe('error');
    if (result.status !== 'error') throw new Error('unreachable');
    expect(result.error.code).toBe('TIMEOUT');
    expect(h.log.entries.at(-1)?.status).toBe('TIMED_OUT');
  });

  it('withTimeout aborts the signal it handed the worker', async () => {
    let aborted = false;
    await expect(
      withTimeout(
        (signal) =>
          new Promise((_resolve, reject) => {
            signal.addEventListener('abort', () => {
              aborted = true;
              reject(new Error('aborted'));
            });
          }),
        20,
        'unit'
      )
    ).rejects.toBeInstanceOf(NashrAgentError);
    expect(aborted).toBe(true);
  });

  it('the default limits are the documented ones', () => {
    expect(NASHR_AGENT_LIMITS.toolTimeoutMs).toBe(30_000);
    expect(NASHR_AGENT_LIMITS.turnTimeoutMs).toBe(120_000);
    expect(NASHR_AGENT_LIMITS.maxRetries).toBe(2);
  });

  it('backoffDelay is capped', () => {
    expect(backoffDelay(10, NASHR_AGENT_LIMITS, () => 1)).toBeLessThanOrEqual(
      NASHR_AGENT_LIMITS.retryMaxDelayMs
    );
  });
});

describe('guardrails — turn budget', () => {
  it('stops the turn once the deadline has passed', () => {
    const budget = new TurnBudget(NASHR_AGENT_LIMITS, Date.now() - 200_000);
    expect(() => budget.assertTimeRemaining()).toThrow(NashrAgentError);
  });

  it('enforces the token ceiling', () => {
    const budget = new TurnBudget({ ...NASHR_AGENT_LIMITS, maxTurnTokens: 100 });
    budget.consumeTokens(60);
    expect(() => budget.consumeTokens(60)).toThrow(/limit/i);
  });

  it('enforces the tool-call ceiling within one turn', () => {
    const budget = new TurnBudget({ ...NASHR_AGENT_LIMITS, maxToolCallsPerTurn: 2 });
    budget.registerToolCall();
    budget.registerToolCall();
    expect(() => budget.registerToolCall()).toThrow(NashrAgentError);
  });

  it('a turn that ran out of time fails the tool call and audits it', async () => {
    const h = makeHarness();
    const budget = new TurnBudget(NASHR_AGENT_LIMITS, Date.now() - 200_000);
    const handler = jest.fn(async () => ({ ok: true }));

    const result = await h.runtime.execute(
      'nashrTest',
      readTool(handler as never),
      {},
      makeContext(),
      { budget }
    );

    expect(handler).not.toHaveBeenCalled();
    expect(result.status).toBe('error');
    expect(h.log.entries.at(-1)?.status).toBe('TIMED_OUT');
  });
});

describe('guardrails — error safety', () => {
  it('never surfaces a provider message or a stack trace', async () => {
    const h = makeHarness();
    const result = await h.runtime.execute(
      'nashrTest',
      readTool(async () => {
        throw new Error(
          'OpenAI 401: Incorrect API key provided: sk-proj-LEAKED1234567890. at Object.<anonymous> (/app/x.js:1:1)'
        );
      }),
      {},
      makeContext()
    );

    if (result.status !== 'error') throw new Error('unreachable');
    const serialised = JSON.stringify(result.error);
    expect(serialised).not.toContain('sk-proj-LEAKED');
    expect(serialised).not.toContain('/app/x.js');
    expect(serialised).not.toContain('OpenAI');
    expect(result.error).toEqual({
      code: 'INTERNAL',
      message: 'Something went wrong. The action was not completed.',
    });
  });

  it('still redacts the secret in the audit row', async () => {
    const h = makeHarness();
    await h.runtime.execute(
      'nashrTest',
      readTool(async () => {
        throw new Error('failed with token sk-proj-LEAKED1234567890');
      }),
      {},
      makeContext()
    );
    const entry = h.log.entries.at(-1);
    expect(entry?.errorMessage).not.toContain('sk-proj-LEAKED');
    expect(entry?.errorMessage).toContain('REDACTED');
  });
});

describe('guardrails — audit trail', () => {
  it('writes one row per outcome with the fields the schema expects', async () => {
    const h = makeHarness();
    await h.runtime.execute(
      'nashrTest',
      readTool(async () => ({ ok: true })),
      { value: 'hello' },
      makeContext()
    );

    expect(h.log.entries).toHaveLength(1);
    const entry = h.log.entries[0];
    expect(entry).toMatchObject({
      organizationId: ORG_A,
      userOrgId: 'userorg-a',
      agentKey: 'nashrTest',
      toolName: 'testRead',
      sensitive: false,
      status: 'EXECUTED',
      attempts: 1,
    });
    expect(typeof entry.durationMs).toBe('number');
    expect(entry.argsDigest).toContain('"fp":"');
  });

  it('records AWAITING_APPROVAL then APPROVED then EXECUTED for a sensitive tool', async () => {
    const h = makeHarness();
    const tool = sensitiveTool(async () => ({ done: true }));
    const ctx = makeContext();
    const args = { target: 'instagram' };

    const proposed = await h.runtime.execute('nashrTest', tool, args, ctx);
    if (proposed.status !== 'awaiting_approval') throw new Error('expected a proposal');
    const token = await h.humanApproves(proposed.proposal.proposalId, ORG_A, USER_A);
    await h.runtime.execute('nashrTest', tool, { ...args, confirmationToken: token }, ctx);

    expect(h.log.entries.map((e) => e.status)).toEqual([
      'AWAITING_APPROVAL',
      'APPROVED',
      'EXECUTED',
    ]);
    expect(h.log.entries.every((e) => e.sensitive)).toBe(true);
  });

  it('a failing audit sink does not fail the tool call', async () => {
    const broken = {
      record: async () => {
        throw new Error('db down');
      },
    };
    const runtime = new GuardrailRuntime({
      audit: new AuditLogger(broken, { onAuditFailure: () => undefined }),
      proposals: new InMemoryProposalStore(),
      secret: () => TEST_SECRET,
    });

    const result = await runtime.execute(
      'nashrTest',
      readTool(async () => ({ ok: true })),
      {},
      makeContext()
    );
    expect(result.status).toBe('ok');
  });

  it('surfaces an audit failure to the configured handler', async () => {
    const onAuditFailure = jest.fn();
    const log = new InMemoryActionLog();
    jest.spyOn(log, 'record').mockRejectedValueOnce(new Error('db down'));

    const runtime = new GuardrailRuntime({
      audit: new AuditLogger(log, { onAuditFailure }),
      proposals: new InMemoryProposalStore(),
      secret: () => TEST_SECRET,
    });
    await runtime.execute('nashrTest', readTool(async () => ({ ok: true })), {}, makeContext());
    expect(onAuditFailure).toHaveBeenCalled();
  });
});
