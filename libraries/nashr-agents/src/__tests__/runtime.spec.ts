import { NashrAgentRuntime } from '../runtime';
import { NASHR_AGENT_LIMITS } from '../guardrails';
import { buildNashrAgentRegistry } from '../agents';
import {
  FakeBrandProfilePort,
  makeContext,
  makeHarness,
  makePorts,
  ORG_A,
  ORG_B,
  USER_A,
} from './test.harness';
import type { BrandProfileRecord } from '../ports';

const seedRow = (organizationId: string, brandName: string): BrandProfileRecord => ({
  id: `bp-${organizationId}`,
  organizationId,
  customerId: null,
  brandName,
  brandNameAr: null,
  industry: 'restaurant',
  market: 'AE',
  timezone: 'Asia/Dubai',
  toneOfVoice: null,
  targetAudience: null,
  products: null,
  offers: null,
  prohibitedClaims: null,
  keywords: null,
});

function makeRuntime() {
  const brand = new FakeBrandProfilePort()
    .seed(seedRow(ORG_A, 'Zaytoun'))
    .seed(seedRow(ORG_B, 'Rival Co'));
  const ports = makePorts({ brand });
  const registry = buildNashrAgentRegistry({ ports });
  const harness = makeHarness();
  return {
    brand,
    ports,
    registry,
    harness,
    runtime: new NashrAgentRuntime(registry, harness.runtime, NASHR_AGENT_LIMITS),
  };
}

describe('NashrAgentRuntime', () => {
  it('invokes a tool by id and scopes it to the caller organisation', async () => {
    const { runtime } = makeRuntime();

    const result = await runtime.invoke('getBrandProfile', {}, {
      organizationId: ORG_A,
      userId: USER_A,
      requestId: 'req-1',
    });

    expect(result.status).toBe('ok');
    if (result.status !== 'ok') throw new Error('unreachable');
    expect((result.data as any).profile.brandName).toBe('Zaytoun');
  });

  it('never returns another tenant’s data for the same tool', async () => {
    const { runtime } = makeRuntime();

    const asB = await runtime.invoke('getBrandProfile', {}, {
      organizationId: ORG_B,
      userId: 'user-b',
      requestId: 'req-2',
    });

    if (asB.status !== 'ok') throw new Error('unreachable');
    expect((asB.data as any).profile.brandName).toBe('Rival Co');
  });

  it('refuses a tool that does not belong to the named agent', async () => {
    const { runtime } = makeRuntime();

    const result = await runtime.invokeOnAgent('nashrContent', 'getBrandProfile', {}, {
      organizationId: ORG_A,
      requestId: 'req-3',
    });

    expect(result.status).toBe('error');
    if (result.status !== 'error') throw new Error('unreachable');
    expect(result.error.code).toBe('NOT_FOUND');
  });

  it('turns an unknown tool id into a typed error, not an exception', async () => {
    const { runtime } = makeRuntime();
    const result = await runtime.invoke('notARealTool', {}, {
      organizationId: ORG_A,
      requestId: 'r',
    });
    expect(result.status).toBe('error');
    if (result.status !== 'error') throw new Error('unreachable');
    expect(result.error.code).toBe('NOT_FOUND');
    // The registry's internal message must not leak through.
    expect(result.error.message).not.toContain('notARealTool');
  });

  it('shares one budget across the tool calls of a single turn', async () => {
    const { runtime } = makeRuntime();
    const first = runtime.budgetFor('turn-1');
    const second = runtime.budgetFor('turn-1');
    expect(first).toBe(second);
    expect(runtime.budgetFor('turn-2')).not.toBe(first);
  });

  it('releases a turn budget', () => {
    const { runtime } = makeRuntime();
    const budget = runtime.budgetFor('turn-1');
    runtime.releaseTurn('turn-1');
    expect(runtime.budgetFor('turn-1')).not.toBe(budget);
  });

  it('counts every tool call of a turn against the same ceiling', async () => {
    const { runtime } = makeRuntime();
    const request = { organizationId: ORG_A, requestId: 'turn-x' };

    for (let i = 0; i < NASHR_AGENT_LIMITS.maxToolCallsPerTurn; i++) {
      const ok = await runtime.invoke('getBrandProfile', {}, request);
      expect(ok.status).toBe('ok');
    }

    const overflow = await runtime.invoke('getBrandProfile', {}, request);
    expect(overflow.status).toBe('error');
  });

  it('defaults locale and market, and stamps the clock', () => {
    const { runtime } = makeRuntime();
    const ctx = runtime.toContext({ organizationId: ORG_A, requestId: 'r' });
    expect(ctx.locale).toBe('en');
    expect(ctx.market).toBe('AE');
    expect(ctx.now).toBeInstanceOf(Date);
  });

  it('writes an audit row for every invocation made through it', async () => {
    const { runtime, harness } = makeRuntime();
    await runtime.invoke('getBrandProfile', {}, {
      organizationId: ORG_A,
      userOrgId: 'uo-1',
      requestId: 'req-audit',
    });

    expect(harness.log.entries).toHaveLength(1);
    expect(harness.log.entries[0]).toMatchObject({
      organizationId: ORG_A,
      agentKey: 'nashrBrandProfile',
      toolName: 'getBrandProfile',
      status: 'EXECUTED',
    });
  });

  it('a sensitive tool reached through the runtime still returns a proposal', async () => {
    const { runtime, brand } = makeRuntime();
    const before = brand.rows.length;

    const result = await runtime.invoke(
      'setProhibitedClaims',
      { claims: ['guaranteed results'] },
      { organizationId: ORG_A, userId: USER_A, requestId: 'req-sensitive' }
    );

    expect(result.status).toBe('awaiting_approval');
    expect(brand.rows).toHaveLength(before);
  });
});

describe('context defaults', () => {
  it('makeContext supplies a complete tool context', () => {
    const ctx = makeContext();
    expect(ctx.organizationId).toBe(ORG_A);
    expect(ctx.userId).toBe(USER_A);
  });
});
