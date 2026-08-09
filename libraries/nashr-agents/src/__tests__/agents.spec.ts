import {
  buildSystemPrompt,
  estimateTokens,
  findProhibitedClaims,
  GroundedModel,
  parseProhibitedClaims,
  toBrandGrounding,
} from '../grounding';
import { collectFigures } from '../agents/analytics-summary.agent';
import { assertHumanActor } from '../agents/approval.agent';
import { buildNashrAgentRegistry } from '../agents';
import { NashrAgentError } from '../errors';
import { IntlHijriAdapter } from '../hijri';
import type { BrandProfileRecord, ChannelAnalytics, ConnectedChannel } from '../ports';
import {
  FakeBrandProfilePort,
  FakeModelPort,
  makeContext,
  makeHarness,
  makePorts,
  ORG_A,
  ORG_B,
  USER_A,
} from './test.harness';

const brandRow = (over: Partial<BrandProfileRecord> = {}): BrandProfileRecord => ({
  id: 'bp-1',
  organizationId: ORG_A,
  customerId: null,
  brandName: 'Zaytoun Clinic',
  brandNameAr: 'عيادة زيتون',
  industry: 'clinic',
  market: 'AE',
  timezone: 'Asia/Dubai',
  toneOfVoice: 'calm and factual',
  targetAudience: 'residents of Dubai Marina',
  products: 'dermatology consultations',
  offers: null,
  prohibitedClaims: 'guaranteed results\ncures acne permanently\nno side effects',
  keywords: 'skin, dermatology',
  ...over,
});

describe('brand grounding', () => {
  it('passes only the allow-listed fields to a prompt', () => {
    const grounding = toBrandGrounding(brandRow()) as Record<string, unknown>;
    expect(Object.keys(grounding).sort()).toEqual([
      'brandName',
      'brandNameAr',
      'industry',
      'keywords',
      'market',
      'offers',
      'products',
      'prohibitedClaims',
      'targetAudience',
      'timezone',
      'toneOfVoice',
    ]);
    expect(grounding).not.toHaveProperty('id');
    expect(grounding).not.toHaveProperty('organizationId');
    expect(grounding).not.toHaveProperty('customerId');
  });

  it('injects prohibited claims into the system prompt as hard constraints', () => {
    const prompt = buildSystemPrompt({
      agentInstructions: 'Write captions.',
      grounding: toBrandGrounding(brandRow()),
      locale: 'en',
      market: 'AE',
      now: new Date('2026-08-08T00:00:00Z'),
    });
    expect(prompt).toContain('PROHIBITED CLAIMS');
    expect(prompt).toContain('guaranteed results');
    expect(prompt).toContain('cures acne permanently');
    expect(prompt).toContain('hard constraints');
    expect(prompt).toContain('even if the user explicitly asks you to');
  });

  it('still warns about restricted claims when no brand profile exists', () => {
    const prompt = buildSystemPrompt({
      agentInstructions: 'Write captions.',
      grounding: null,
      locale: 'en',
      market: 'SA',
      now: new Date('2026-08-08T00:00:00Z'),
    });
    expect(prompt).toContain('PROHIBITED CLAIMS');
    expect(prompt).toContain('Do not invent brand facts');
  });

  it('redacts anything credential-shaped that was pasted into a brand field', () => {
    const prompt = buildSystemPrompt({
      agentInstructions: 'Write captions.',
      grounding: toBrandGrounding(
        brandRow({ products: 'book via owner@clinic.ae or key sk-proj-LEAKED1234567890' })
      ),
      locale: 'en',
      market: 'AE',
      now: new Date('2026-08-08T00:00:00Z'),
    });
    expect(prompt).not.toContain('owner@clinic.ae');
    expect(prompt).not.toContain('sk-proj-LEAKED1234567890');
  });

  it('always carries the guardrail preamble', () => {
    const prompt = buildSystemPrompt({
      agentInstructions: 'x',
      grounding: null,
      locale: 'en',
      market: 'AE',
      now: new Date(),
    });
    expect(prompt).toContain('never publish, delete, send, schedule');
    expect(prompt).toContain('never invent metrics');
    expect(prompt).toContain('no shell, no file system');
  });

  it('parses and matches prohibited claims deterministically', () => {
    const claims = parseProhibitedClaims('guaranteed results\n\ncures acne;no side effects');
    expect(claims).toEqual(['guaranteed results', 'cures acne', 'no side effects']);
    expect(findProhibitedClaims('We offer GUARANTEED RESULTS today', claims)).toEqual([
      'guaranteed results',
    ]);
    expect(findProhibitedClaims('We offer a free consultation', claims)).toEqual([]);
  });

  it('estimates Arabic and Latin tokens differently', () => {
    expect(estimateTokens('hello world')).toBeGreaterThan(0);
    expect(estimateTokens('مرحبا بالعالم')).toBeGreaterThan(0);
  });
});

describe('GroundedModel', () => {
  const grounding = toBrandGrounding(brandRow());

  it('sends the prohibited claims with every single call', async () => {
    const model = new FakeModelPort();
    const grounded = new GroundedModel(
      model,
      grounding,
      'Write captions.',
      'en',
      'AE',
      new Date('2026-08-08T00:00:00Z')
    );

    await grounded.generate({ prompt: 'a post about summer' });
    await grounded.generate({ prompt: 'a post about winter' });

    expect(model.requests).toHaveLength(2);
    for (const request of model.requests) {
      expect(request.system).toContain('guaranteed results');
    }
  });

  it('rejects output that breaks a prohibited claim', async () => {
    const model = new FakeModelPort();
    model.response = 'Book now for guaranteed results!';
    const grounded = new GroundedModel(model, grounding, 'x', 'en', 'AE', new Date());
    await expect(grounded.generate({ prompt: 'promote us' })).rejects.toMatchObject({
      code: 'PROHIBITED_CLAIM',
    });
  });

  it('turns a provider error into a safe upstream failure', async () => {
    const model = new FakeModelPort();
    model.shouldFail = true;
    const grounded = new GroundedModel(model, grounding, 'x', 'en', 'AE', new Date());
    await expect(grounded.generate({ prompt: 'x' })).rejects.toMatchObject({
      code: 'UPSTREAM_UNAVAILABLE',
    });

    const error = await grounded.generate({ prompt: 'x' }).catch((e) => e as NashrAgentError);
    expect(error.toSafe().message).not.toContain('sk-proj-');
  });

  it('redacts the user prompt before transmission', async () => {
    const model = new FakeModelPort();
    const grounded = new GroundedModel(model, grounding, 'x', 'en', 'AE', new Date());
    await grounded.generate({ prompt: 'contact the owner at owner@clinic.ae' });
    expect(model.requests[0].prompt).not.toContain('owner@clinic.ae');
  });
});

describe('brand profile agent', () => {
  it('reads only within the caller organisation', async () => {
    const brand = new FakeBrandProfilePort()
      .seed(brandRow())
      .seed(brandRow({ id: 'bp-2', organizationId: ORG_B, brandName: 'Other Org Brand' }));

    const registry = buildNashrAgentRegistry({ ports: makePorts({ brand }) });
    const h = makeHarness();
    const tool = registry.tool('getBrandProfile').tool;

    const asA = await h.runtime.execute('nashrBrandProfile', tool, {}, makeContext());
    expect(asA.status).toBe('ok');
    if (asA.status !== 'ok') throw new Error('unreachable');
    expect((asA.data as any).profile.brandName).toBe('Zaytoun Clinic');

    const asB = await h.runtime.execute(
      'nashrBrandProfile',
      tool,
      {},
      makeContext({ organizationId: ORG_B })
    );
    if (asB.status !== 'ok') throw new Error('unreachable');
    expect((asB.data as any).profile.brandName).toBe('Other Org Brand');

    // Every query carried an organizationId, and never a foreign one.
    expect(brand.seenOrgIds).toEqual([ORG_A, ORG_B]);
  });

  it('reports prohibited claims as a parsed list', async () => {
    const brand = new FakeBrandProfilePort().seed(brandRow());
    const registry = buildNashrAgentRegistry({ ports: makePorts({ brand }) });
    const h = makeHarness();

    const result = await h.runtime.execute(
      'nashrBrandProfile',
      registry.tool('getBrandProfile').tool,
      {},
      makeContext()
    );
    if (result.status !== 'ok') throw new Error('unreachable');
    expect((result.data as any).profile.prohibitedClaims).toEqual([
      'guaranteed results',
      'cures acne permanently',
      'no side effects',
    ]);
  });

  it('will not save without a human approving', async () => {
    const brand = new FakeBrandProfilePort();
    const registry = buildNashrAgentRegistry({ ports: makePorts({ brand }) });
    const h = makeHarness();

    const result = await h.runtime.execute(
      'nashrBrandProfile',
      registry.tool('saveBrandProfile').tool,
      { brandName: 'New', industry: 'salon' },
      makeContext()
    );

    expect(result.status).toBe('awaiting_approval');
    expect(brand.rows).toHaveLength(0);
  });

  it('checkProhibitedClaims flags a violating draft without calling a model', async () => {
    const brand = new FakeBrandProfilePort().seed(brandRow());
    const model = new FakeModelPort();
    const registry = buildNashrAgentRegistry({ ports: makePorts({ brand, model }) });
    const h = makeHarness();

    const result = await h.runtime.execute(
      'nashrContent',
      registry.tool('checkProhibitedClaims').tool,
      { text: 'Our treatment cures acne permanently.' },
      makeContext()
    );

    if (result.status !== 'ok') throw new Error('unreachable');
    expect(result.data).toMatchObject({
      passed: false,
      violations: ['cures acne permanently'],
      claimsChecked: 3,
    });
    expect(model.requests).toHaveLength(0);
  });
});

describe('content agent', () => {
  it('produces English and Arabic and reports its grounding', async () => {
    const brand = new FakeBrandProfilePort().seed(brandRow());
    const model = new FakeModelPort();
    model.response = JSON.stringify({
      captions: [{ en: 'Book a consultation', ar: 'احجز استشارتك', note: 'direct' }],
    });

    const registry = buildNashrAgentRegistry({ ports: makePorts({ brand, model }) });
    const h = makeHarness();

    const result = await h.runtime.execute(
      'nashrContent',
      registry.tool('generateCaptions').tool,
      { topic: 'new dermatology clinic opening', count: 1 },
      makeContext()
    );

    if (result.status !== 'ok') throw new Error('unreachable');
    expect(result.data).toMatchObject({
      captions: [{ en: 'Book a consultation', ar: 'احجز استشارتك' }],
      groundedInBrandProfile: true,
      prohibitedClaimsApplied: 3,
    });
  });

  it('fails safely when the model returns prose instead of JSON', async () => {
    const model = new FakeModelPort();
    model.response = 'Sorry, I cannot do that.';
    const registry = buildNashrAgentRegistry({ ports: makePorts({ model }) });
    const h = makeHarness();

    const result = await h.runtime.execute(
      'nashrContent',
      registry.tool('generateCaptions').tool,
      { topic: 'anything', count: 1 },
      makeContext()
    );
    if (result.status !== 'ok') throw new Error('unreachable');
    expect((result.data as any).captions).toEqual([]);
  });
});

describe('localization agent', () => {
  it('defaults to cultural adaptation, not literal translation', async () => {
    const model = new FakeModelPort();
    model.response = JSON.stringify({
      text: 'نص متكيف',
      changes: [{ from: 'break a leg', to: 'بالتوفيق', reason: 'idiom does not travel' }],
      literalWouldHaveBeen: 'اكسر ساقك',
    });
    const registry = buildNashrAgentRegistry({ ports: makePorts({ model }) });
    const h = makeHarness();

    const result = await h.runtime.execute(
      'nashrLocalization',
      registry.tool('adaptContent').tool,
      { text: 'break a leg', direction: 'en_to_ar', market: 'SA' },
      makeContext()
    );

    if (result.status !== 'ok') throw new Error('unreachable');
    expect((result.data as any).mode).toBe('cultural');
    expect((result.data as any).literalWouldHaveBeen).toBe('اكسر ساقك');
    expect(model.requests[0].prompt).toContain('Mode: CULTURAL');
    expect(model.requests[0].prompt).toContain('Do not translate word for word');
  });

  it('honours an explicit literal request', async () => {
    const model = new FakeModelPort();
    model.response = JSON.stringify({ text: 'literal', changes: [] });
    const registry = buildNashrAgentRegistry({ ports: makePorts({ model }) });
    const h = makeHarness();

    await h.runtime.execute(
      'nashrLocalization',
      registry.tool('adaptContent').tool,
      { text: 'Terms apply', direction: 'en_to_ar', market: 'AE', mode: 'literal' },
      makeContext()
    );
    expect(model.requests[0].prompt).toContain('Mode: LITERAL');
  });

  it('carries the market note into the prompt so AE and SA differ', async () => {
    const model = new FakeModelPort();
    model.response = JSON.stringify({ text: 'x', changes: [] });
    const registry = buildNashrAgentRegistry({ ports: makePorts({ model }) });
    const h = makeHarness();

    await h.runtime.execute(
      'nashrLocalization',
      registry.tool('adaptContent').tool,
      { text: 'hello', direction: 'en_to_ar', market: 'SA' },
      makeContext()
    );
    expect(model.requests[0].prompt).toContain('Najdi/Hijazi');
  });
});

describe('campaign calendar agent', () => {
  it('finds Ramadan and Eid and marks them approximate', () => {
    const hijri = new IntlHijriAdapter();
    const found = hijri.observancesBetween(
      new Date('2027-01-01T00:00:00Z'),
      new Date('2027-12-31T00:00:00Z'),
      'AE'
    );
    const ramadan = found.find((o) => o.key === 'ramadan_start');
    const eid = found.find((o) => o.key === 'eid_al_fitr');
    expect(ramadan?.approximate).toBe(true);
    expect(eid?.approximate).toBe(true);
    expect(found.find((o) => o.key === 'uae_national_day')?.approximate).toBe(false);
  });

  it('converts to the Umm al-Qura calendar', () => {
    const hijri = new IntlHijriAdapter();
    const h = hijri.toHijri(new Date('2026-08-08T00:00:00Z'));
    expect(h.year).toBeGreaterThan(1400);
    expect(h.month).toBeGreaterThanOrEqual(1);
    expect(h.month).toBeLessThanOrEqual(12);
  });

  it('proposes only — nothing is scheduled', async () => {
    const model = new FakeModelPort();
    model.response = JSON.stringify({
      items: [
        {
          date: '2026-08-10',
          timeLocal: '19:00',
          titleEn: 'Behind the counter',
          titleAr: 'خلف الكواليس',
          format: 'reel',
          pillar: 'brand',
          rationale: 'humanises the team',
          tiedToObservance: null,
          needsInputFromBusiness: false,
        },
      ],
    });
    const ports = makePorts({ model });
    const registry = buildNashrAgentRegistry({ ports });
    const h = makeHarness();

    const result = await h.runtime.execute(
      'nashrCampaignCalendar',
      registry.tool('proposeCalendar').tool,
      { period: 'week', startDate: '2026-08-09', postsPerWeek: 1 },
      makeContext()
    );

    if (result.status !== 'ok') throw new Error('unreachable');
    expect((result.data as any).isProposalOnly).toBe(true);
    expect((result.data as any).nextStep).toContain('Nothing has been scheduled');
    expect((ports.posts as any).scheduled).toHaveLength(0);
  });

  it('scheduling is gated behind human approval', async () => {
    const ports = makePorts();
    const registry = buildNashrAgentRegistry({ ports });
    const h = makeHarness();

    const result = await h.runtime.execute(
      'nashrCampaignCalendar',
      registry.tool('scheduleCalendar').tool,
      { postIds: ['p1', 'p2'], timezone: 'Asia/Dubai' },
      makeContext()
    );

    expect(result.status).toBe('awaiting_approval');
    expect((ports.posts as any).scheduled).toHaveLength(0);
  });
});

describe('approval agent', () => {
  it('refuses to record a decision attributed to somebody else', () => {
    expect(() => assertHumanActor('someone-else', makeContext())).toThrow(NashrAgentError);
    expect(() => assertHumanActor('someone-else', makeContext())).toThrow(
      /cannot record an approval on a person/
    );
  });

  it('refuses to record a decision when no human is in session', () => {
    expect(() => assertHumanActor(USER_A, makeContext({ userId: undefined }))).toThrow(
      /permission/
    );
  });

  it('accepts the signed-in human as the actor', () => {
    expect(() => assertHumanActor(USER_A, makeContext())).not.toThrow();
  });

  it('the whole decision path is gated: proposal first, then a human, then the record', async () => {
    const ports = makePorts();
    const registry = buildNashrAgentRegistry({ ports });
    const h = makeHarness();
    const tool = registry.tool('recordHumanDecision').tool;
    const args = { postId: 'post-1', decision: 'APPROVED' as const, actorId: USER_A };

    const proposed = await h.runtime.execute('nashrApproval', tool, args, makeContext());
    expect(proposed.status).toBe('awaiting_approval');
    expect((ports.approval as any).records).toHaveLength(0);

    if (proposed.status !== 'awaiting_approval') throw new Error('unreachable');
    const token = await h.humanApproves(proposed.proposal.proposalId, ORG_A, USER_A);
    const done = await h.runtime.execute(
      'nashrApproval',
      tool,
      { ...args, confirmationToken: token },
      makeContext()
    );

    expect(done.status).toBe('ok');
    expect((ports.approval as any).records).toHaveLength(1);
    expect((ports.approval as any).records[0].actorId).toBe(USER_A);
  });

  it('an approved proposal still cannot launder a foreign actorId', async () => {
    const ports = makePorts();
    const registry = buildNashrAgentRegistry({ ports });
    const h = makeHarness();
    const tool = registry.tool('recordHumanDecision').tool;
    const args = { postId: 'post-1', decision: 'APPROVED' as const, actorId: 'the-client' };

    const proposed = await h.runtime.execute('nashrApproval', tool, args, makeContext());
    if (proposed.status !== 'awaiting_approval') throw new Error('unreachable');
    const token = await h.humanApproves(proposed.proposal.proposalId, ORG_A, USER_A);

    const result = await h.runtime.execute(
      'nashrApproval',
      tool,
      { ...args, confirmationToken: token },
      makeContext()
    );

    expect(result.status).toBe('error');
    if (result.status !== 'error') throw new Error('unreachable');
    expect(result.error.code).toBe('SELF_APPROVAL_BLOCKED');
    expect((ports.approval as any).records).toHaveLength(0);
  });
});

describe('analytics summary agent', () => {
  const channels: ConnectedChannel[] = [
    { integrationId: 'i1', providerIdentifier: 'instagram', name: 'Zaytoun IG', supportsAnalytics: true },
    { integrationId: 'i2', providerIdentifier: 'telegram', name: 'Zaytoun TG', supportsAnalytics: false },
    { integrationId: 'i3', providerIdentifier: 'tiktok', name: 'Zaytoun TT', supportsAnalytics: true },
  ];

  const igData: ChannelAnalytics = {
    integrationId: 'i1',
    providerIdentifier: 'instagram',
    name: 'Zaytoun IG',
    metrics: [
      {
        label: 'Impressions',
        points: [
          { date: '2026-08-01', total: 100 },
          { date: '2026-08-02', total: 150 },
        ],
        percentageChange: 12,
      },
    ],
  };

  it('aggregates only real points and names every gap', () => {
    const { figures, coverage } = collectFigures(
      channels,
      [
        { channel: channels[0], data: igData },
        { channel: channels[2], failed: true },
      ],
      '2026-08-01',
      '2026-08-08'
    );

    expect(figures).toEqual([
      {
        channel: 'Zaytoun IG',
        providerIdentifier: 'instagram',
        metric: 'Impressions',
        total: 250,
        periodStart: '2026-08-01',
        periodEnd: '2026-08-08',
        percentageChange: 12,
      },
    ]);
    expect(coverage.channelsConnected).toBe(3);
    expect(coverage.channelsWithAnalyticsSupport).toBe(2);
    expect(coverage.channelsReportingData).toBe(1);
    expect(coverage.unsupportedChannels.map((c) => c.name)).toEqual(['Zaytoun TG']);
    expect(coverage.failedChannels.map((c) => c.name)).toEqual(['Zaytoun TT']);
  });

  it('treats an empty metric series as no data, not as zero', () => {
    const { figures, coverage } = collectFigures(
      [channels[0]],
      [
        {
          channel: channels[0],
          data: { ...igData, metrics: [{ label: 'Impressions', points: [] }] },
        },
      ],
      '2026-08-01',
      '2026-08-08'
    );
    expect(figures).toEqual([]);
    expect(coverage.emptyChannels).toHaveLength(1);
  });

  it('does not call the model when there is nothing to report', async () => {
    const analytics = makePorts().analytics as any;
    analytics.channels = [channels[1]];
    const model = new FakeModelPort();

    const registry = buildNashrAgentRegistry({ ports: makePorts({ analytics, model }) });
    const h = makeHarness();

    const result = await h.runtime.execute(
      'nashrAnalyticsSummary',
      registry.tool('summarizeWeek').tool,
      {},
      makeContext()
    );

    if (result.status !== 'ok') throw new Error('unreachable');
    expect((result.data as any).hasData).toBe(false);
    expect((result.data as any).figures).toEqual([]);
    expect((result.data as any).summary).toContain('no performance data');
    expect((result.data as any).caveats[0]).toContain('does not expose them');
    expect(model.requests).toHaveLength(0);
  });

  it('hands the model only the figures that exist, and the gaps', async () => {
    const analytics = makePorts().analytics as any;
    analytics.channels = channels;
    analytics.data.set('i1', igData);
    analytics.failing.add('i3');

    const model = new FakeModelPort();
    model.response = 'Impressions reached 250 on Instagram.';

    const registry = buildNashrAgentRegistry({ ports: makePorts({ analytics, model }) });
    const h = makeHarness();

    const result = await h.runtime.execute(
      'nashrAnalyticsSummary',
      registry.tool('summarizeWeek').tool,
      { days: 7 },
      makeContext()
    );

    if (result.status !== 'ok') throw new Error('unreachable');
    const prompt = model.requests[0].prompt;
    expect(prompt).toContain('ONLY figures that exist');
    expect(prompt).toContain('Impressions: 250');
    expect(prompt).toContain('Zaytoun TG');
    expect((result.data as any).coverage.failedChannels).toHaveLength(1);
  });

  it('does not leak a provider error message into the result', async () => {
    const analytics = makePorts().analytics as any;
    analytics.channels = [channels[2]];
    analytics.failing.add('i3');

    const registry = buildNashrAgentRegistry({ ports: makePorts({ analytics }) });
    const h = makeHarness();

    const result = await h.runtime.execute(
      'nashrAnalyticsSummary',
      registry.tool('getChannelMetrics').tool,
      {},
      makeContext()
    );

    if (result.status !== 'ok') throw new Error('unreachable');
    expect(JSON.stringify(result.data)).not.toContain('sk-proj-');
    expect(JSON.stringify(result.data)).not.toContain('exploded');
  });
});
