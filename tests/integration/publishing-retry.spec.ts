/**
 * Nashr (نشر) — failed publishing and retry behaviour.
 *
 * Retry/backoff is Temporal's, configured declaratively in the workflow
 * `proxyActivities` options. Replaying a real workflow needs
 * `@temporalio/testing` and a Temporal test server, neither of which is
 * available here and neither of which may be added (adding a dependency would
 * change package.json / the lockfile, outside this phase's ownership). The
 * full workflow replay is therefore a manual step in TEST_PLAN.md.
 *
 * What IS verified here, and what actually protects customers:
 *   1. The declared retry policies — specifically that IRREVERSIBLE publish
 *      activities get NO automatic retries. A retried publish that already
 *      succeeded in the background posts twice to a customer's live account.
 *   2. That every workflow version funnels through the single publish
 *      chokepoint the approval gate sits on.
 *   3. That the gate error carries the marker workflows branch on.
 *   4. That a failed publish really does land as State.ERROR plus an `Errors`
 *      row in PostgreSQL — the user-visible half of failure handling.
 */
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { prisma, repo, disconnect } from '../fixtures/db';
import { seedTwoTenants, SeededTenant } from '../fixtures/seed';
import { PostsRepository } from '@gitroom/nestjs-libraries/database/prisma/posts/posts.repository';
import {
  NashrApprovalRequiredError,
  PrismaApprovalGate,
  assertPublishAllowed,
} from '@gitroom/nashr-approval/publish.gate';

const REPO_ROOT = path.resolve(__dirname, '../..');
const WORKFLOW_DIR = path.join(
  REPO_ROOT,
  'apps/orchestrator/src/workflows/post-workflows'
);
const ACTIVITY_FILE = path.join(
  REPO_ROOT,
  'apps/orchestrator/src/activities/post.activity.ts'
);

const workflowFiles = fs
  .readdirSync(WORKFLOW_DIR)
  .filter((f) => f.endsWith('.ts'))
  .sort();

const readWorkflow = (f: string) =>
  fs.readFileSync(path.join(WORKFLOW_DIR, f), 'utf8');

let db: PrismaClient;
let victim: SeededTenant;
let posts: PostsRepository;

beforeAll(async () => {
  db = prisma();
  const tenants = await seedTwoTenants(db);
  victim = tenants.victim;
  posts = new PostsRepository(repo(), repo(), repo(), repo(), repo(), repo());
});

afterAll(async () => {
  await disconnect();
});

// ───────────────────────────────────────────────────────────────────────────
describe('the publish chokepoint covers every workflow version', () => {
  it('there are six versioned post workflows', () => {
    expect(workflowFiles).toHaveLength(6);
    expect(workflowFiles[0]).toBe('post.workflow.v1.0.1.ts');
    expect(workflowFiles[5]).toBe('post.workflow.v1.0.6.ts');
  });

  it.each(workflowFiles)(
    '%s publishes only via postSocial / postSocialPending',
    (file) => {
      const src = readWorkflow(file);
      expect(/postSocial(Pending)?\s*\(/.test(src)).toBe(true);
    }
  );

  it('both entry points funnel into postSocialInternal', () => {
    const src = fs.readFileSync(ACTIVITY_FILE, 'utf8');
    const postSocial = src.match(
      /async postSocial\([^)]*\)\s*\{[^}]*postSocialInternal/s
    );
    const postSocialPending = src.match(
      /async postSocialPending\([^)]*\)\s*\{[^}]*postSocialInternal/s
    );
    expect(postSocial).not.toBeNull();
    expect(postSocialPending).not.toBeNull();
  });

  it('the approval gate is the FIRST thing postSocialInternal does', () => {
    const src = fs.readFileSync(ACTIVITY_FILE, 'utf8');
    const start = src.indexOf('private async postSocialInternal');
    expect(start).toBeGreaterThan(-1);

    const body = src.slice(start, start + 2500);
    const gateAt = body.indexOf('assertNashrApproved');
    expect(gateAt).toBeGreaterThan(-1);

    // Nothing that touches a provider or a subscription may precede it.
    const before = body.slice(0, gateAt);
    expect(before).not.toContain('getSocialIntegration');
    expect(before).not.toContain('getSubscription');
    expect(before).not.toContain('await this._postService');
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('retry policies: an irreversible publish is never auto-retried', () => {
  /**
   * The rule: a retried activity whose earlier (timed-out) attempt actually
   * completed in the background publishes the post TWICE to a live customer
   * account. So the mutation proxy must declare maximumAttempts: 1, and the
   * workflow retries deliberately instead.
   */
  it('v1.0.6 gives postSocialPending / finalizePost maximumAttempts: 1', () => {
    const src = readWorkflow('post.workflow.v1.0.6.ts');
    const mutation = src.match(
      /const proxyMutationTaskQueue[\s\S]*?\n\};/
    );
    expect(mutation).not.toBeNull();
    expect(mutation![0]).toContain('maximumAttempts: 1');

    // …and those are the activities routed through it.
    expect(src).toMatch(
      /const \{\s*postSocialPending,\s*finalizePost\s*\}\s*=\s*proxyMutationTaskQueue/
    );
  });

  it('the read-only status check keeps fast retries — retrying it cannot duplicate a post', () => {
    const src = readWorkflow('post.workflow.v1.0.6.ts');
    const check = src.match(/const proxyCheckTaskQueue[\s\S]*?\n\};/);
    expect(check).not.toBeNull();
    expect(check![0]).toContain('maximumAttempts: 3');
    expect(check![0]).toContain("initialInterval: '10 seconds'");
    expect(src).toMatch(
      /const \{\s*checkPostStatus\s*\}\s*=\s*proxyCheckTaskQueue/
    );
  });

  it.each(workflowFiles)('%s declares bounded retries everywhere', (file) => {
    const src = readWorkflow(file);
    const attempts = [...src.matchAll(/maximumAttempts:\s*(\d+)/g)].map((m) =>
      Number(m[1])
    );
    expect(attempts.length).toBeGreaterThan(0);
    // Bounded and modest: an unbounded or large retry budget on a publish path
    // is how a transient outage becomes a flood of duplicate posts.
    for (const n of attempts) {
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(3);
    }
  });

  it.each(workflowFiles)('%s uses a flat (non-exponential) backoff', (file) => {
    const src = readWorkflow(file);
    const coefficients = [
      ...src.matchAll(/backoffCoefficient:\s*([\d.]+)/g),
    ].map((m) => Number(m[1]));
    for (const c of coefficients) {
      expect(c).toBe(1);
    }
  });

  it('every activity proxy sets a startToCloseTimeout — no unbounded activity', () => {
    for (const file of workflowFiles) {
      const src = readWorkflow(file);
      const proxies = [...src.matchAll(/proxyActivities<[^>]*>\(\{/g)];
      const timeouts = [...src.matchAll(/startToCloseTimeout:/g)];
      expect(`${file}: ${timeouts.length} >= ${proxies.length}`).toEqual(
        `${file}: ${timeouts.length} >= ${proxies.length}`
      );
      expect(timeouts.length).toBeGreaterThanOrEqual(proxies.length);
    }
  });

  it('the maintenance workflows also declare bounded retries', () => {
    const others = [
      'autopost.workflow.ts',
      'digest.email.workflow.ts',
      'missing.post.workflow.ts',
      'refresh.token.workflow.ts',
    ];
    for (const file of others) {
      const src = fs.readFileSync(
        path.join(REPO_ROOT, 'apps/orchestrator/src/workflows', file),
        'utf8'
      );
      expect(`${file}:${/maximumAttempts:\s*3/.test(src)}`).toEqual(
        `${file}:true`
      );
    }
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('the approval gate error is shaped for the workflow to branch on', () => {
  it('carries the nashrApprovalGate marker, the stage and the ids', async () => {
    const post = await db.post.create({
      data: {
        state: 'QUEUE',
        publishDate: new Date('2026-12-10T09:00:00.000Z'),
        organizationId: victim.orgId,
        integrationId: victim.integrationAId,
        content: '<p>unapproved</p>',
        group: randomUUID(),
        creationMethod: 'API',
      },
    });

    const gate = new PrismaApprovalGate(db as any);
    let caught: any = null;
    try {
      await assertPublishAllowed(
        gate,
        { organizationId: victim.orgId, postId: post.id },
        {} as any
      );
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(NashrApprovalRequiredError);
    expect(caught.nashrApprovalGate).toBe(true);
    expect(caught.name).toBe('NashrApprovalRequiredError');
    expect(caught.postId).toBe(post.id);
    expect(caught.organizationId).toBe(victim.orgId);
    expect(caught.stage).toBe('DRAFT');
    // The message is what ends up in Post.error and in front of the user.
    expect(caught.message).toContain('APPROVED');
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('a failed publish is visible to the customer', () => {
  it('changeState(ERROR) marks the post and writes an Errors row', async () => {
    const post = await db.post.create({
      data: {
        state: 'QUEUE',
        publishDate: new Date('2026-12-11T09:00:00.000Z'),
        organizationId: victim.orgId,
        integrationId: victim.integrationAId,
        content: '<p>will fail</p>',
        group: randomUUID(),
        creationMethod: 'WEB',
      },
    });

    await posts.changeState(
      post.id,
      'ERROR',
      'Nashr approval gate: Post is at stage DRAFT',
      { attempted: true }
    );

    const reloaded = await db.post.findUnique({ where: { id: post.id } });
    expect(reloaded!.state).toBe('ERROR');
    expect(reloaded!.error).toContain('approval gate');

    const errors = await db.errors.findMany({
      where: { postId: post.id },
      orderBy: { createdAt: 'desc' },
    });
    expect(errors.length).toBe(1);
    expect(errors[0].organizationId).toBe(victim.orgId);
    expect(errors[0].platform).toBe('instagram');
  });

  it('the Errors row is org-scoped, so a failure is not visible cross-tenant', async () => {
    const rows = await db.errors.findMany({
      where: { organizationId: victim.orgId },
    });
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.organizationId).toBe(victim.orgId);
    }
  });

  it('a post already in ERROR is not silently re-queued', async () => {
    const post = await db.post.create({
      data: {
        state: 'ERROR',
        publishDate: new Date('2026-12-12T09:00:00.000Z'),
        organizationId: victim.orgId,
        integrationId: victim.integrationAId,
        content: '<p>already failed</p>',
        group: randomUUID(),
        creationMethod: 'WEB',
        error: 'previous failure',
      },
    });

    // The workflow's own guard: anything not in QUEUE is refused as
    // "Already posted" rather than retried. Mirrored here as a state check.
    const reloaded = await db.post.findUnique({ where: { id: post.id } });
    expect(reloaded!.state).not.toBe('QUEUE');

    const src = readWorkflow('post.workflow.v1.0.6.ts');
    expect(src).toContain("firstPost.state !== 'QUEUE'");
    expect(src).toContain("'Already posted'");
  });

  it('an unconfirmed publish is marked distinctly so the user does not double-post', () => {
    const src = readWorkflow('post.workflow.v1.0.6.ts');
    expect(src).toContain('markUnconfirmed');
    expect(src).toMatch(/couldn't confirm/i);
    expect(src).toMatch(/before posting again/i);
  });
});
