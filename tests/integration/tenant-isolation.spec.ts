/**
 * Nashr (نشر) — RISK-02: cross-tenant data leakage.
 *
 * The audit's most severe unclosed risk. There is no row-level security in
 * Postgres; isolation rests entirely on every Prisma query carrying an
 * `organizationId` filter. One missing `where` clause exposes a competitor's
 * content and OAuth tokens.
 *
 * These tests are ADVERSARIAL and run against REAL PostgreSQL with two real
 * organizations. For each org-scoped path we call the genuine repository
 * method as the ATTACKER organization, passing the VICTIM's row id, and assert
 * nothing is read and nothing is mutated.
 *
 * A mocked Prisma client cannot do this job: a query with no organizationId
 * filter looks identical to a correct one when the client is a stub.
 */
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import { prisma, repo, disconnect } from '../fixtures/db';
import { seedTwoTenants, SeededTenant, TwoTenants } from '../fixtures/seed';

import { PostsRepository } from '@gitroom/nestjs-libraries/database/prisma/posts/posts.repository';
import { IntegrationRepository } from '@gitroom/nestjs-libraries/database/prisma/integrations/integration.repository';
import { MediaRepository } from '@gitroom/nestjs-libraries/database/prisma/media/media.repository';
import { WebhooksRepository } from '@gitroom/nestjs-libraries/database/prisma/webhooks/webhooks.repository';
import { NashrApprovalService } from '@gitroom/nashr-approval/approval.service';
import { NashrApprovalError } from '@gitroom/nashr-approval/approval.service';
import { PrismaApprovalGate, evaluatePublishGate } from '@gitroom/nashr-approval/publish.gate';

let db: PrismaClient;
let tenants: TwoTenants;
let victim: SeededTenant;
let attacker: SeededTenant;

let posts: PostsRepository;
let integrations: IntegrationRepository;
let media: MediaRepository;
let webhooks: WebhooksRepository;
let approvals: NashrApprovalService;

beforeAll(async () => {
  db = prisma();
  tenants = await seedTwoTenants(db);
  victim = tenants.victim;
  attacker = tenants.attacker;

  posts = new PostsRepository(
    repo(), repo(), repo(), repo(), repo(), repo()
  );
  integrations = new IntegrationRepository(
    repo(), repo(), repo(), repo(), repo(), repo()
  );
  media = new MediaRepository(repo());
  webhooks = new WebhooksRepository(repo());
  approvals = new NashrApprovalService(repo() as any);
});

afterAll(async () => {
  await disconnect();
});

/** Snapshot a victim row so a mutation attempt can be proven to be a no-op. */
async function victimPost() {
  return db.post.findUnique({ where: { id: victim.postId } });
}

// ───────────────────────────────────────────────────────────────────────────
describe('RISK-02 / posts — reads', () => {
  it('the seed really did create isolated data (sanity)', async () => {
    expect(victim.orgId).not.toEqual(attacker.orgId);
    const own = await db.post.findMany({ where: { organizationId: victim.orgId } });
    expect(own.length).toBeGreaterThanOrEqual(3);
  });

  it('getPost with the attacker org does not return the victim post', async () => {
    const leaked = await posts.getPost(victim.postId, true, attacker.orgId);
    expect(leaked).toBeNull();
  });

  it('getPostById with the attacker org does not return the victim post', async () => {
    const leaked = await posts.getPostById(victim.postId, attacker.orgId);
    expect(leaked).toBeNull();
  });

  it('getPostsByGroup does not return the victim thread to the attacker', async () => {
    const leaked = await posts.getPostsByGroup(attacker.orgId, victim.postGroup);
    expect(leaked).toEqual([]);
  });

  it('getPostUrls does not resolve victim post ids for the attacker', async () => {
    const leaked = await posts.getPostUrls(attacker.orgId, [
      victim.postId,
      victim.childPostId,
      victim.brandBPostId,
    ]);
    expect(leaked).toEqual([]);
  });

  it('getPosts (calendar range) never returns another org\'s posts', async () => {
    const list = await posts.getPosts(attacker.orgId, {
      startDate: '2026-01-01T00:00:00.000Z',
      endDate: '2027-01-01T00:00:00.000Z',
      customer: undefined,
    } as any);
    const ids = (list as any[]).map((p) => p.id);
    expect(ids).not.toContain(victim.postId);
    expect(ids).not.toContain(victim.childPostId);
    expect(ids).not.toContain(victim.brandBPostId);
  });

  it('getPostsSince never returns another org\'s posts', async () => {
    const list = await posts.getPostsSince(
      attacker.orgId,
      '2020-01-01T00:00:00.000Z'
    );
    const contents = list.map((p: any) => p.content).join(' ');
    expect(contents).not.toContain('Gulf Eats Agency confidential');
  });

  it('countPostsFromDay does not count the victim\'s posts', async () => {
    const attackerCount = await posts.countPostsFromDay(
      attacker.orgId,
      new Date('2020-01-01T00:00:00.000Z')
    );
    const totalRows = await db.post.count();
    expect(attackerCount).toBeLessThan(totalRows);
  });
});

describe('RISK-02 / posts — writes', () => {
  it('deletePost by group cannot soft-delete the victim thread', async () => {
    await posts.deletePost(attacker.orgId, victim.postGroup);
    const still = await victimPost();
    expect(still!.deletedAt).toBeNull();
    const child = await db.post.findUnique({ where: { id: victim.childPostId } });
    expect(child!.deletedAt).toBeNull();
  });

  it('changeDate cannot reschedule the victim post', async () => {
    const before = await victimPost();
    await expect(
      posts.changeDate(
        attacker.orgId,
        victim.postId,
        '2030-01-01T00:00:00.000Z',
        false
      )
    ).rejects.toBeDefined();
    const after = await victimPost();
    expect(after!.publishDate.toISOString()).toEqual(
      before!.publishDate.toISOString()
    );
  });

  it('updateReleaseId cannot mark the victim post as released', async () => {
    const before = await victimPost();
    await expect(
      posts.updateReleaseId(victim.postId, attacker.orgId, 'hijacked')
    ).rejects.toBeDefined();
    const after = await victimPost();
    expect(after!.releaseId).toEqual(before!.releaseId);
  });
});

describe('RISK-02 / posts — createOrUpdatePost (the worst leak found)', () => {
  /**
   * CRITICAL DEFECT FOUND AND FIXED — see posts.repository.ts.
   *
   * `createOrUpdatePost` upserted on `where: { id: value.id || uuidv4() }`,
   * and `value.id` comes straight from the request body with no ownership
   * check. Supplying another organization's post id took the UPDATE branch on
   * their row, overwriting its content — and because `updateData()` connects
   * `organization` to the caller, the row was MOVED into the attacker's
   * organization. A full cross-tenant post takeover.
   *
   * Empirically reproduced against real Postgres before the fix:
   *   content "Gulf Eats Agency confidential campaign copy" -> "HIJACKED"
   *   organizationId victim -> attacker, with no error raised.
   *
   * It is reachable from every CreationMethod, because they all funnel through
   * PostsService.createPost: the dashboard, the public API v1, the MCP tools,
   * autopost and the CLI.
   */
  it('createOrUpdatePost cannot hijack another org\'s post by id', async () => {
    const before = await victimPost();

    await posts.createOrUpdatePost(
      'update',
      attacker.orgId,
      '2026-10-01T09:00:00.000Z',
      {
        integration: { id: attacker.integrationAId },
        settings: {},
        value: [
          { id: victim.postId, content: '<p>HIJACKED</p>', image: [] },
        ],
      } as any,
      [],
      'API' as any
    );

    const after = await victimPost();
    expect(after!.content).toEqual(before!.content);
    expect(after!.content).not.toContain('HIJACKED');
    expect(after!.organizationId).toEqual(victim.orgId);
    expect(after!.integrationId).toEqual(before!.integrationId);
  });

  /**
   * DESTRUCTIVE DEFECT FOUND AND FIXED — the `group` sweeps.
   *
   * After writing the new rows, the method soft-deleted every post carrying
   * `body.group` with no organizationId filter. `group` is caller-supplied, so
   * passing the victim's group id soft-deleted the victim's thread.
   * Reproduced before the fix: the victim's child post gained a `deletedAt`.
   */
  it('createOrUpdatePost cannot sweep away another org\'s post group', async () => {
    await posts.createOrUpdatePost(
      'draft',
      attacker.orgId,
      '2026-10-01T09:00:00.000Z',
      {
        group: victim.postGroup,
        integration: { id: attacker.integrationAId },
        settings: {},
        value: [{ content: '<p>sweep attempt</p>', image: [] }],
      } as any,
      [],
      'API' as any
    );

    const root = await victimPost();
    const child = await db.post.findUnique({
      where: { id: victim.childPostId },
    });
    expect(root!.deletedAt).toBeNull();
    expect(child!.deletedAt).toBeNull();
  });

  /**
   * The fix must not break the legitimate case it protects: updating YOUR OWN
   * post by id must still UPDATE that row, not silently create a duplicate.
   * Without this test the org filter could be "fixed" into a behaviour change.
   */
  it('a legitimate same-org update still updates in place (no duplicate row)', async () => {
    const own = await db.post.create({
      data: {
        state: 'DRAFT',
        publishDate: new Date('2026-11-01T09:00:00.000Z'),
        organizationId: attacker.orgId,
        integrationId: attacker.integrationAId,
        content: '<p>original</p>',
        group: randomUUID(),
        creationMethod: 'WEB',
      },
    });

    const countBefore = await db.post.count({
      where: { organizationId: attacker.orgId },
    });

    const { posts: written } = await posts.createOrUpdatePost(
      'update',
      attacker.orgId,
      '2026-11-02T09:00:00.000Z',
      {
        integration: { id: attacker.integrationAId },
        settings: {},
        value: [{ id: own.id, content: '<p>edited in place</p>', image: [] }],
      } as any,
      [],
      'WEB' as any
    );

    const countAfter = await db.post.count({
      where: { organizationId: attacker.orgId },
    });

    expect(written[0].id).toEqual(own.id);
    expect(countAfter).toEqual(countBefore);

    const reloaded = await db.post.findUnique({ where: { id: own.id } });
    expect(reloaded!.content).toEqual('<p>edited in place</p>');

    await db.post.delete({ where: { id: own.id } });
  });

  /** The attacker's own group sweep must still work inside their own org. */
  it('a legitimate same-org group sweep still soft-deletes the caller\'s own rows', async () => {
    const group = randomUUID();
    const stale = await db.post.create({
      data: {
        state: 'DRAFT',
        publishDate: new Date('2026-11-03T09:00:00.000Z'),
        organizationId: attacker.orgId,
        integrationId: attacker.integrationAId,
        content: '<p>stale row in the group</p>',
        group,
        creationMethod: 'WEB',
      },
    });

    await posts.createOrUpdatePost(
      'draft',
      attacker.orgId,
      '2026-11-04T09:00:00.000Z',
      {
        group,
        integration: { id: attacker.integrationAId },
        settings: {},
        value: [{ content: '<p>replacement</p>', image: [] }],
      } as any,
      [],
      'WEB' as any
    );

    const reloaded = await db.post.findUnique({ where: { id: stale.id } });
    expect(reloaded!.deletedAt).not.toBeNull();
  });
});

describe('RISK-02 / tags', () => {
  it('getTags does not return the victim tags', async () => {
    const tags = await posts.getTags(attacker.orgId);
    expect(tags.map((t: any) => t.id)).not.toContain(victim.tagId);
  });

  it('deleteTag cannot soft-delete the victim tag', async () => {
    await expect(
      posts.deleteTag(victim.tagId, attacker.orgId)
    ).rejects.toBeDefined();
    const tag = await db.tags.findUnique({ where: { id: victim.tagId } });
    expect(tag!.deletedAt).toBeNull();
  });

  /**
   * DEFECT FOUND — see the fix in posts.repository.ts.
   *
   * `editTag(id, orgId, body)` accepted `orgId` and then dropped it:
   *     update({ where: { id }, ... })
   * Reachable from `PUT /posts/tags/:id` (posts.controller.ts), so any
   * authenticated member of ANY organization could rename and recolour
   * another organization's tags by id. The adjacent `deleteTag` already
   * scoped correctly, which is what makes this an oversight rather than a
   * design choice.
   */
  it('editTag cannot rewrite the victim tag (regression for the fixed leak)', async () => {
    const before = await db.tags.findUnique({ where: { id: victim.tagId } });
    await expect(
      posts.editTag(victim.tagId, attacker.orgId, {
        name: 'PWNED',
        color: '#ff0000',
      } as any)
    ).rejects.toBeDefined();
    const after = await db.tags.findUnique({ where: { id: victim.tagId } });
    expect(after!.name).toEqual(before!.name);
    expect(after!.color).toEqual(before!.color);
    expect(after!.name).not.toEqual('PWNED');
  });
});

describe('RISK-02 / integrations and OAuth tokens', () => {
  it('getIntegrationById does not hand over the victim integration or its token', async () => {
    const leaked = await integrations.getIntegrationById(
      attacker.orgId,
      victim.integrationAId
    );
    expect(leaked).toBeNull();
  });

  it('getIntegrationsList only ever contains the caller\'s integrations', async () => {
    const list = await integrations.getIntegrationsList(attacker.orgId);
    const ids = list.map((i: any) => i.id);
    expect(ids).not.toContain(victim.integrationAId);
    expect(ids).not.toContain(victim.integrationBId);
    const tokens = list.map((i: any) => i.token).join(' ');
    expect(tokens).not.toContain('FAKE-TOKEN-victim');
  });

  it('disableChannel cannot disable the victim integration', async () => {
    await expect(
      integrations.disableChannel(attacker.orgId, victim.integrationAId)
    ).rejects.toBeDefined();
    const row = await db.integration.findUnique({
      where: { id: victim.integrationAId },
    });
    expect(row!.disabled).toBe(false);
  });

  it('updateOnCustomerName cannot re-brand the victim integration', async () => {
    await expect(
      integrations.updateOnCustomerName(
        attacker.orgId,
        victim.integrationAId,
        'stolen-brand'
      )
    ).rejects.toBeDefined();
    const row = await db.integration.findUnique({
      where: { id: victim.integrationAId },
    });
    expect(row!.customerId).toEqual(victim.brandAId);
  });
});

describe('RISK-02 / customers (brands)', () => {
  it('customers() only lists the caller org\'s brands', async () => {
    const list = await integrations.customers(attacker.orgId);
    const ids = list.map((c: any) => c.id);
    expect(ids).not.toContain(victim.brandAId);
    expect(ids).not.toContain(victim.brandBId);
    expect(ids).toContain(attacker.brandAId);
  });

  /**
   * `updateIntegrationGroup` scopes the integration by org but connects the
   * Customer by bare id. Attaching one's OWN integration to ANOTHER org's
   * Customer would create a cross-tenant reference.
   */
  it('updateIntegrationGroup cannot attach an attacker integration to a victim brand', async () => {
    let threw = false;
    try {
      await integrations.updateIntegrationGroup(
        attacker.orgId,
        attacker.integrationAId,
        victim.brandAId
      );
    } catch {
      threw = true;
    }
    const row = await db.integration.findUnique({
      where: { id: attacker.integrationAId },
    });
    // Either it refused, or — the thing that actually matters — the attacker's
    // integration is not now pointing at the victim's brand.
    expect(row!.customerId).not.toEqual(victim.brandAId);
    if (!threw) {
      expect(row!.customerId).toEqual(attacker.brandAId);
    }
  });
});

describe('RISK-02 / media', () => {
  it('getMedia never pages in another org\'s assets', async () => {
    const page = await media.getMedia(attacker.orgId, 1);
    const ids = page.results.map((m: any) => m.id);
    expect(ids).not.toContain(victim.mediaId);
  });

  it('deleteMedia cannot soft-delete the victim asset', async () => {
    await expect(
      media.deleteMedia(attacker.orgId, victim.mediaId)
    ).rejects.toBeDefined();
    const row = await db.media.findUnique({ where: { id: victim.mediaId } });
    expect(row!.deletedAt).toBeNull();
  });

  it('saveMediaInformation cannot overwrite the victim asset metadata', async () => {
    const before = await db.media.findUnique({ where: { id: victim.mediaId } });
    await expect(
      media.saveMediaInformation(attacker.orgId, {
        id: victim.mediaId,
        alt: 'PWNED',
        thumbnail: 'x',
        thumbnailTimestamp: 1,
      } as any)
    ).rejects.toBeDefined();
    const after = await db.media.findUnique({ where: { id: victim.mediaId } });
    expect(after!.alt).toEqual(before!.alt);
  });

  /**
   * KNOWN UPSTREAM GAP (reported, not silently fixed):
   * `MediaRepository.getMediaById(id)` takes no organization at all. It is an
   * internal call used by posts.service when resolving images referenced in a
   * post body, so a caller who can put an arbitrary media id in a post body
   * can read another org's media row. This test PINS the current behaviour so
   * the gap is visible and a future fix is detected. See TEST_PLAN.md.
   */
  it('DOCUMENTS: getMediaById has no org parameter and is therefore unscoped', async () => {
    const row = await media.getMediaById(victim.mediaId);
    expect(row).not.toBeNull();
    expect((media.getMediaById as Function).length).toBe(1); // (id) only
  });
});

describe('RISK-02 / webhooks', () => {
  it('getWebhooks only returns the caller org\'s hooks', async () => {
    const list = await webhooks.getWebhooks(attacker.orgId);
    const ids = list.map((w: any) => w.id);
    expect(ids).not.toContain(victim.webhookId);
    const urls = list.map((w: any) => w.url).join(' ');
    expect(urls).not.toContain('hooks.victim');
  });

  it('getTotal does not count the victim hooks', async () => {
    const total = await webhooks.getTotal(attacker.orgId);
    const all = await db.webhooks.count({ where: { deletedAt: null } });
    expect(total).toBeLessThan(all);
  });

  it('deleteWebhook cannot delete the victim hook', async () => {
    await expect(
      webhooks.deleteWebhook(attacker.orgId, victim.webhookId)
    ).rejects.toBeDefined();
    const row = await db.webhooks.findUnique({ where: { id: victim.webhookId } });
    expect(row!.deletedAt).toBeNull();
  });

  it('createWebhook with the victim hook id must not hijack it', async () => {
    const before = await db.webhooks.findUnique({
      where: { id: victim.webhookId },
    });
    let threw = false;
    try {
      await webhooks.createWebhook(attacker.orgId, {
        id: victim.webhookId,
        name: 'PWNED',
        url: 'https://attacker.nashr-test.invalid/steal',
        integrations: [],
      } as any);
    } catch {
      threw = true;
    }
    const after = await db.webhooks.findUnique({
      where: { id: victim.webhookId },
    });
    expect(after!.name).toEqual(before!.name);
    expect(after!.url).toEqual(before!.url);
    expect(after!.organizationId).toEqual(victim.orgId);
    expect(threw || after!.name === before!.name).toBe(true);
  });
});

describe('RISK-02 / NashrPostApproval', () => {
  it('getCurrentStage refuses a cross-tenant post id', async () => {
    await expect(
      approvals.getCurrentStage(attacker.orgId, victim.postId)
    ).rejects.toBeInstanceOf(NashrApprovalError);
  });

  it('getHistory refuses a cross-tenant post id', async () => {
    await expect(
      approvals.getHistory(attacker.orgId, victim.postId)
    ).rejects.toBeInstanceOf(NashrApprovalError);
  });

  it('decide() cannot record a decision on the victim post', async () => {
    const before = await db.nashrPostApproval.count({
      where: { organizationId: victim.orgId },
    });
    await expect(
      approvals.decide({
        organizationId: attacker.orgId,
        postId: victim.postId,
        actorId: attacker.members.ADMIN.userId,
        actorRole: 'ADMIN',
        decision: 'APPROVED',
      })
    ).rejects.toBeInstanceOf(NashrApprovalError);
    const after = await db.nashrPostApproval.count({
      where: { organizationId: victim.orgId },
    });
    expect(after).toEqual(before);
  });

  it('listPending never surfaces the victim\'s pending posts', async () => {
    const pending = await approvals.listPending(attacker.orgId, 'ADMIN', null);
    const postIds = pending.map((p: any) => p.postId);
    expect(postIds).not.toContain(victim.postId);
  });

  it('an attacker APPROVED row cannot satisfy the victim post\'s publish gate', async () => {
    // Attacker forges an APPROVED row that names the victim's post id but
    // carries the attacker's organizationId — the shape a naive
    // `where: { postId }` lookup would fall for.
    const forged = await db.nashrPostApproval.create({
      data: {
        postId: victim.postId,
        organizationId: attacker.orgId,
        stage: 'APPROVED',
        decision: 'APPROVED',
        actorRole: 'ADMIN',
        note: 'forged cross-tenant approval',
      },
    });

    const gate = new PrismaApprovalGate(db as any);
    const decision = await evaluatePublishGate(gate, {
      organizationId: victim.orgId,
      postId: victim.postId,
    }, {} as any);

    expect(decision.allowed).toBe(false);
    expect(decision.stage).toBe('INTERNAL_REVIEW');

    await db.nashrPostApproval.delete({ where: { id: forged.id } });
  });

  it('the publish gate refuses when org and post belong to different tenants', async () => {
    const gate = new PrismaApprovalGate(db as any);
    const decision = await evaluatePublishGate(gate, {
      organizationId: attacker.orgId,
      postId: victim.postId,
    }, {} as any);
    expect(decision.allowed).toBe(false);
    expect(decision.via).toBe('tenant-mismatch');
  });
});

describe('RISK-02 / NashrBrandProfile', () => {
  it('a brand-profile query scoped to the attacker returns nothing of the victim', async () => {
    const rows = await db.nashrBrandProfile.findMany({
      where: { organizationId: attacker.orgId, deletedAt: null },
    });
    const ids = rows.map((r) => r.id);
    expect(ids).not.toContain(victim.brandProfileId);
    expect(ids).toContain(attacker.brandProfileId);
  });

  it('an org-scoped update cannot flip the victim\'s autonomousPublishing kill switch', async () => {
    const res = await db.nashrBrandProfile.updateMany({
      where: { id: victim.brandProfileId, organizationId: attacker.orgId },
      data: { autonomousPublishing: true },
    });
    expect(res.count).toBe(0);
    const row = await db.nashrBrandProfile.findUnique({
      where: { id: victim.brandProfileId },
    });
    expect(row!.autonomousPublishing).toBe(false);
    expect(row!.clientApprovalRequired).toBe(true);
  });

  it('the brand profile is bound to a Customer inside the same organization', async () => {
    const row = await db.nashrBrandProfile.findUnique({
      where: { id: victim.brandProfileId },
      include: { customer: true },
    });
    expect(row!.customer!.orgId).toEqual(victim.orgId);
  });
});

describe('RISK-02 / NashrAgentActionLog', () => {
  it('an org-scoped read returns only the caller\'s agent audit trail', async () => {
    const rows = await db.nashrAgentActionLog.findMany({
      where: { organizationId: attacker.orgId },
    });
    const ids = rows.map((r) => r.id);
    expect(ids).not.toContain(victim.agentLogId);
    expect(rows.map((r) => r.resultSummary).join(' ')).not.toContain(
      'Gulf Eats Agency'
    );
  });

  it('an org-scoped delete cannot erase the victim\'s audit trail', async () => {
    const res = await db.nashrAgentActionLog.deleteMany({
      where: { id: victim.agentLogId, organizationId: attacker.orgId },
    });
    expect(res.count).toBe(0);
    const row = await db.nashrAgentActionLog.findUnique({
      where: { id: victim.agentLogId },
    });
    expect(row).not.toBeNull();
  });

  it('every agent log row carries an organizationId (no orphan audit rows)', async () => {
    const orphans = await db.$queryRawUnsafe<any[]>(
      `SELECT count(*)::int AS n FROM "NashrAgentActionLog" WHERE "organizationId" IS NULL`
    );
    expect(orphans[0].n).toBe(0);
  });
});

describe('RISK-02 / comments', () => {
  it('comments are stored with an organizationId and are org-filterable', async () => {
    const rows = await db.comments.findMany({
      where: { organizationId: attacker.orgId },
    });
    expect(rows.map((c) => c.id)).not.toContain(victim.commentId);
  });

  /**
   * KNOWN UPSTREAM GAP (reported, not silently fixed):
   * `PostsRepository.getComments(postId)` takes no organization. It is called
   * from the post detail path after an org-scoped post lookup, so it is not
   * directly exploitable today — but it is one refactor away from being so.
   */
  it('DOCUMENTS: getComments takes no organization parameter', async () => {
    expect((posts.getComments as Function).length).toBe(1);
    const rows = await posts.getComments(victim.postId);
    expect(rows.length).toBeGreaterThan(0);
  });
});

describe('RISK-02 / whole-database sweep', () => {
  /**
   * Belt and braces: after everything above, no victim row may have been
   * relabelled into the attacker organization, and vice versa.
   */
  it('no row changed tenants during the attack run', async () => {
    const checks: Array<[string, Promise<number>]> = [
      ['posts', db.post.count({ where: { organizationId: victim.orgId } })],
      ['integrations', db.integration.count({ where: { organizationId: victim.orgId } })],
      ['media', db.media.count({ where: { organizationId: victim.orgId } })],
      ['webhooks', db.webhooks.count({ where: { organizationId: victim.orgId } })],
      ['customers', db.customer.count({ where: { orgId: victim.orgId } })],
      ['approvals', db.nashrPostApproval.count({ where: { organizationId: victim.orgId } })],
      ['brandProfiles', db.nashrBrandProfile.count({ where: { organizationId: victim.orgId } })],
      ['agentLogs', db.nashrAgentActionLog.count({ where: { organizationId: victim.orgId } })],
    ];
    const expected: Record<string, number> = {
      posts: 3,
      integrations: 2,
      media: 1,
      webhooks: 1,
      customers: 2,
      approvals: 1,
      brandProfiles: 1,
      agentLogs: 1,
    };
    for (const [name, p] of checks) {
      expect(`${name}=${await p}`).toEqual(`${name}=${expected[name]}`);
    }
  });

  it('every org-scoped table has a non-null organizationId on every row', async () => {
    const tables: Array<[string, string]> = [
      ['Post', 'organizationId'],
      ['Integration', 'organizationId'],
      ['Media', 'organizationId'],
      ['Webhooks', 'organizationId'],
      ['Customer', 'orgId'],
      ['Tags', 'orgId'],
      ['Comments', 'organizationId'],
      ['NashrPostApproval', 'organizationId'],
      ['NashrBrandProfile', 'organizationId'],
      ['NashrAgentActionLog', 'organizationId'],
    ];
    for (const [table, col] of tables) {
      const rows = await db.$queryRawUnsafe<any[]>(
        `SELECT count(*)::int AS n FROM "${table}" WHERE "${col}" IS NULL`
      );
      expect(`${table}.${col} nulls=${rows[0].n}`).toEqual(
        `${table}.${col} nulls=0`
      );
    }
  });
});
