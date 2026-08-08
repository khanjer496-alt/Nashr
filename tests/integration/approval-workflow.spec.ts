/**
 * Nashr (نشر) — approval workflow, end to end against real PostgreSQL.
 *
 * Draft → Internal review → Client approval → Schedule → Publish.
 *
 * The load-bearing claim under test is RISK-P4: a post with no APPROVED record
 * cannot publish, and that holds for EVERY CreationMethod — WEB, API, MCP,
 * AUTOPOST, CLI — because the gate lives in the Temporal publish activity
 * (`postSocialInternal`), the one chokepoint all five traverse. A UI-only check
 * would be bypassed by the public API and the MCP tools.
 *
 * The service and the gate here are the real ones, writing real rows.
 */
import { CreationMethod, PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import { prisma, repo, disconnect } from '../fixtures/db';
import { seedTwoTenants, SeededTenant } from '../fixtures/seed';
import {
  NashrApprovalError,
  NashrApprovalService,
} from '@gitroom/nashr-approval/approval.service';
import {
  PrismaApprovalGate,
  evaluatePublishGate,
  assertPublishAllowed,
  NashrApprovalRequiredError,
} from '@gitroom/nashr-approval/publish.gate';

let db: PrismaClient;
let org: SeededTenant;
let service: NashrApprovalService;
let gate: PrismaApprovalGate;

/** Env with no autonomy opt-in — the production default. */
const STRICT_ENV = {} as Record<string, string | undefined>;

beforeAll(async () => {
  db = prisma();
  const tenants = await seedTwoTenants(db);
  org = tenants.victim;
  service = new NashrApprovalService(repo() as any);
  gate = new PrismaApprovalGate(db as any);
});

afterAll(async () => {
  await disconnect();
});

/** A brand-new DRAFT post with no approval rows at all. */
async function freshPost(
  creationMethod: CreationMethod = 'WEB',
  integrationId = org.integrationAId
) {
  return db.post.create({
    data: {
      state: 'DRAFT',
      publishDate: new Date('2026-12-01T09:00:00.000Z'),
      organizationId: org.orgId,
      integrationId,
      content: `<p>copy ${randomUUID()}</p>`,
      group: randomUUID(),
      creationMethod,
    },
  });
}

async function stageOf(postId: string) {
  return service.getCurrentStage(org.orgId, postId);
}

async function allowed(postId: string) {
  return evaluatePublishGate(
    gate,
    { organizationId: org.orgId, postId },
    STRICT_ENV as any
  );
}

// ───────────────────────────────────────────────────────────────────────────
describe('the happy path: Draft → Internal review → Client approval → Approved', () => {
  it('walks every stage and only then permits publishing', async () => {
    const post = await freshPost();

    // 1. A post that was never submitted is DRAFT and cannot publish.
    expect(await stageOf(post.id)).toBe('DRAFT');
    expect((await allowed(post.id)).allowed).toBe(false);

    // 2. The editor submits it.
    const submitted = await service.decide({
      organizationId: org.orgId,
      postId: post.id,
      actorId: org.members.EDITOR.userId,
      actorRole: 'EDITOR',
      decision: 'SUBMITTED',
      note: 'ready for review',
    });
    expect(submitted.stage).toBe('INTERNAL_REVIEW');
    expect((await allowed(post.id)).allowed).toBe(false);

    // 3. Internal review passes → the CLIENT still has to sign off.
    const internal = await service.decide({
      organizationId: org.orgId,
      postId: post.id,
      actorId: org.members.APPROVER.userId,
      actorRole: 'APPROVER',
      decision: 'APPROVED',
    });
    expect(internal.stage).toBe('CLIENT_APPROVAL');
    expect((await allowed(post.id)).allowed).toBe(false);

    // 4. The client signs off → APPROVED.
    const client = await service.decide({
      organizationId: org.orgId,
      postId: post.id,
      actorId: org.members.CLIENT.userId,
      actorRole: 'CLIENT',
      decision: 'APPROVED',
      allowedCustomerIds: [org.brandAId],
    });
    expect(client.stage).toBe('APPROVED');

    // 5. Only now may it be scheduled and published.
    const decision = await allowed(post.id);
    expect(decision.allowed).toBe(true);
    expect(decision.via).toBe('approved');
    await expect(service.assertSchedulable(org.orgId, post.id)).resolves.toBe(
      'APPROVED'
    );
  });

  it('records an append-only trail — no row is ever updated or deleted', async () => {
    const post = await freshPost();
    for (const step of [
      { role: 'EDITOR', decision: 'SUBMITTED' },
      { role: 'APPROVER', decision: 'APPROVED' },
      { role: 'CLIENT', decision: 'APPROVED' },
    ] as const) {
      await service.decide({
        organizationId: org.orgId,
        postId: post.id,
        actorId: org.members[step.role].userId,
        actorRole: step.role,
        decision: step.decision,
        allowedCustomerIds: step.role === 'CLIENT' ? [org.brandAId] : null,
      });
    }

    const history = await service.getHistory(org.orgId, post.id);
    expect(history.map((h) => h.stage)).toEqual([
      'INTERNAL_REVIEW',
      'CLIENT_APPROVAL',
      'APPROVED',
    ]);
    expect(history.map((h) => h.actorRole)).toEqual([
      'EDITOR',
      'APPROVER',
      'CLIENT',
    ]);
    // Three decisions ⇒ exactly three rows. Nothing was mutated in place.
    const rows = await db.nashrPostApproval.count({ where: { postId: post.id } });
    expect(rows).toBe(3);
  });
});

describe('the gate refuses every non-APPROVED stage', () => {
  const stages: Array<[string, Array<{ role: any; decision: any }>]> = [
    ['DRAFT (never submitted)', []],
    ['INTERNAL_REVIEW', [{ role: 'EDITOR', decision: 'SUBMITTED' }]],
    [
      'CLIENT_APPROVAL',
      [
        { role: 'EDITOR', decision: 'SUBMITTED' },
        { role: 'APPROVER', decision: 'APPROVED' },
      ],
    ],
    [
      'CHANGES_REQUESTED',
      [
        { role: 'EDITOR', decision: 'SUBMITTED' },
        { role: 'APPROVER', decision: 'CHANGES_REQUESTED' },
      ],
    ],
    [
      'REJECTED',
      [
        { role: 'EDITOR', decision: 'SUBMITTED' },
        { role: 'APPROVER', decision: 'REJECTED' },
      ],
    ],
  ];

  it.each(stages)('refuses to publish at stage %s', async (_label, steps) => {
    const post = await freshPost();
    for (const s of steps) {
      await service.decide({
        organizationId: org.orgId,
        postId: post.id,
        actorId: org.members[s.role as keyof typeof org.members].userId,
        actorRole: s.role,
        decision: s.decision,
      });
    }
    const decision = await allowed(post.id);
    expect(decision.allowed).toBe(false);
    expect(decision.via).toBe('denied');
    await expect(
      assertPublishAllowed(
        gate,
        { organizationId: org.orgId, postId: post.id },
        STRICT_ENV as any
      )
    ).rejects.toBeInstanceOf(NashrApprovalRequiredError);
  });

  it('withdrawing an APPROVED post un-approves it and re-closes the gate', async () => {
    const post = await freshPost();
    for (const s of [
      { role: 'EDITOR', decision: 'SUBMITTED' },
      { role: 'APPROVER', decision: 'APPROVED' },
      { role: 'CLIENT', decision: 'APPROVED' },
    ] as const) {
      await service.decide({
        organizationId: org.orgId,
        postId: post.id,
        actorId: org.members[s.role].userId,
        actorRole: s.role,
        decision: s.decision,
        allowedCustomerIds: s.role === 'CLIENT' ? [org.brandAId] : null,
      });
    }
    expect((await allowed(post.id)).allowed).toBe(true);

    await service.decide({
      organizationId: org.orgId,
      postId: post.id,
      actorId: org.members.ADMIN.userId,
      actorRole: 'ADMIN',
      decision: 'WITHDRAWN',
    });

    expect(await stageOf(post.id)).toBe('DRAFT');
    expect((await allowed(post.id)).allowed).toBe(false);
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('RISK-P4 — the gate holds for EVERY CreationMethod', () => {
  const METHODS: CreationMethod[] = ['WEB', 'API', 'MCP', 'AUTOPOST', 'CLI'];

  it.each(METHODS)(
    'a %s-created post with no APPROVED record cannot publish',
    async (method) => {
      const post = await freshPost(method);
      expect(post.creationMethod).toBe(method);

      const decision = await allowed(post.id);
      expect(decision.allowed).toBe(false);
      expect(decision.stage).toBe('DRAFT');

      await expect(
        assertPublishAllowed(
          gate,
          { organizationId: org.orgId, postId: post.id },
          STRICT_ENV as any
        )
      ).rejects.toBeInstanceOf(NashrApprovalRequiredError);
    }
  );

  it.each(METHODS)(
    'a %s-created post CAN publish once it carries an APPROVED record',
    async (method) => {
      const post = await freshPost(method);
      for (const s of [
        { role: 'EDITOR', decision: 'SUBMITTED' },
        { role: 'APPROVER', decision: 'APPROVED' },
        { role: 'CLIENT', decision: 'APPROVED' },
      ] as const) {
        await service.decide({
          organizationId: org.orgId,
          postId: post.id,
          actorId: org.members[s.role].userId,
          actorRole: s.role,
          decision: s.decision,
          allowedCustomerIds: s.role === 'CLIENT' ? [org.brandAId] : null,
        });
      }
      const decision = await allowed(post.id);
      expect(decision.allowed).toBe(true);
      expect(decision.via).toBe('approved');
    }
  );

  it('the CreationMethod is irrelevant to the decision — the gate never reads it', async () => {
    // All five methods, same stage, same answer. This is the property that
    // makes a single chokepoint sufficient.
    const results: Record<string, boolean> = {};
    for (const method of METHODS) {
      const post = await freshPost(method);
      results[method] = (await allowed(post.id)).allowed;
    }
    expect(results).toEqual({
      WEB: false,
      API: false,
      MCP: false,
      AUTOPOST: false,
      CLI: false,
    });
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('threads: approval is recorded against the thread root', () => {
  it('approving the root also clears a child comment for publishing', async () => {
    const root = await freshPost();
    const child = await db.post.create({
      data: {
        state: 'DRAFT',
        publishDate: root.publishDate,
        organizationId: org.orgId,
        integrationId: org.integrationAId,
        content: '<p>thread reply</p>',
        group: root.group,
        parentPostId: root.id,
        creationMethod: 'WEB',
      },
    });

    expect((await allowed(child.id)).allowed).toBe(false);

    for (const s of [
      { role: 'EDITOR', decision: 'SUBMITTED' },
      { role: 'APPROVER', decision: 'APPROVED' },
      { role: 'CLIENT', decision: 'APPROVED' },
    ] as const) {
      await service.decide({
        organizationId: org.orgId,
        // Deciding on the CHILD must resolve to the root.
        postId: child.id,
        actorId: org.members[s.role].userId,
        actorRole: s.role,
        decision: s.decision,
        allowedCustomerIds: s.role === 'CLIENT' ? [org.brandAId] : null,
      });
    }

    // The rows were written against the ROOT, not the child.
    const onRoot = await db.nashrPostApproval.count({
      where: { postId: root.id },
    });
    const onChild = await db.nashrPostApproval.count({
      where: { postId: child.id },
    });
    expect(onRoot).toBe(3);
    expect(onChild).toBe(0);

    expect((await allowed(child.id)).allowed).toBe(true);
    expect((await allowed(root.id)).allowed).toBe(true);
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('autonomy kill switch', () => {
  it('is OFF by default — an unapproved post is refused with an empty env', async () => {
    const post = await freshPost();
    const decision = await evaluatePublishGate(
      gate,
      { organizationId: org.orgId, postId: post.id },
      {} as any
    );
    expect(decision.allowed).toBe(false);
  });

  it('only an exact org id in the allowlist opts an org out', async () => {
    const post = await freshPost();
    const opted = await evaluatePublishGate(
      gate,
      { organizationId: org.orgId, postId: post.id },
      { NASHR_AUTONOMOUS_PUBLISH_ORG_IDS: org.orgId } as any
    );
    expect(opted.allowed).toBe(true);
    expect(opted.via).toBe('autonomous');

    const other = await evaluatePublishGate(
      gate,
      { organizationId: org.orgId, postId: post.id },
      { NASHR_AUTONOMOUS_PUBLISH_ORG_IDS: 'some-other-org' } as any
    );
    expect(other.allowed).toBe(false);
  });

  it('a typo in the global kill switch fails CLOSED', async () => {
    const post = await freshPost();
    for (const typo of ['False', 'FALSE', '0', 'no', 'off', '', 'true']) {
      const decision = await evaluatePublishGate(
        gate,
        { organizationId: org.orgId, postId: post.id },
        { NASHR_APPROVAL_GATE_ENABLED: typo } as any
      );
      expect(`${typo}=${decision.allowed}`).toEqual(`${typo}=false`);
    }
  });

  /**
   * REPORTED GAP (not fixed here — production behaviour change, and it fails
   * closed either way).
   *
   * Migration 20260808000200 added `NashrBrandProfile.autonomousPublishing`
   * and `.clientApprovalRequired` to the schema, but no production code reads
   * them: `autonomy.policy.ts` still resolves both from environment variables
   * only, and its trailing comment still describes the columns as "not
   * applied". So a per-brand setting made in the database (or a UI writing to
   * it) is SILENTLY IGNORED.
   *
   * Both directions fail closed, so this is a correctness/UX defect rather
   * than a security hole:
   *   - autonomousPublishing=true in the DB does NOT enable autonomy;
   *   - clientApprovalRequired=false in the DB does NOT skip client sign-off.
   *
   * This test pins the current behaviour so that wiring the columns up is a
   * deliberate, visible change. See TEST_PLAN.md.
   */
  it('DOCUMENTS: the per-brand autonomy columns are not wired to the gate', async () => {
    await db.nashrBrandProfile.update({
      where: { id: org.brandProfileId },
      data: { autonomousPublishing: true },
    });

    const post = await freshPost();
    const decision = await evaluatePublishGate(
      gate,
      { organizationId: org.orgId, postId: post.id },
      {} as any
    );
    // Still denied: the column had no effect.
    expect(decision.allowed).toBe(false);

    await db.nashrBrandProfile.update({
      where: { id: org.brandProfileId },
      data: { autonomousPublishing: false },
    });
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('gate failure modes fail closed', () => {
  it('a post id that does not exist is refused, not allowed', async () => {
    const decision = await evaluatePublishGate(
      gate,
      { organizationId: org.orgId, postId: 'no-such-post-id' },
      STRICT_ENV as any
    );
    expect(decision.allowed).toBe(false);
    expect(decision.via).toBe('not-found');
  });

  it('an undefined post id is refused', async () => {
    const decision = await evaluatePublishGate(
      gate,
      { organizationId: org.orgId, postId: undefined as any },
      STRICT_ENV as any
    );
    expect(decision.allowed).toBe(false);
  });

  it('a corrupted stage value in the database does not open the gate', async () => {
    const post = await freshPost();
    // Write a stage the state machine does not treat as publishable, directly.
    await db.nashrPostApproval.create({
      data: {
        postId: post.id,
        organizationId: org.orgId,
        stage: 'CHANGES_REQUESTED',
        decision: 'CHANGES_REQUESTED',
        actorRole: 'APPROVER',
      },
    });
    expect((await allowed(post.id)).allowed).toBe(false);
  });

  it('assertSchedulable refuses anything that is not APPROVED', async () => {
    const post = await freshPost();
    await expect(
      service.assertSchedulable(org.orgId, post.id)
    ).rejects.toBeInstanceOf(NashrApprovalError);
  });
});
