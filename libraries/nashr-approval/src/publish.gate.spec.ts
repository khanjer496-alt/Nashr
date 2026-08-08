import {
  ApprovalGatePort,
  NashrApprovalRequiredError,
  assertPublishAllowed,
  evaluatePublishGate,
} from './publish.gate';
import {
  clientApprovalRequired,
  requiresApproval,
  resolveAutonomyPolicy,
} from './autonomy.policy';
import type { NashrApprovalStageName } from './state-machine';

const ORG = 'org_agency_1';
const OTHER_ORG = 'org_agency_2';
const POST = 'post_1';

function makePort(opts: {
  posts?: Record<string, { organizationId: string; parentPostId?: string | null }>;
  stages?: Record<string, NashrApprovalStageName>;
}): ApprovalGatePort {
  const posts = opts.posts ?? {};
  const stages = opts.stages ?? {};
  return {
    async loadPostRoot(postId) {
      let current = posts[postId];
      if (!current) return null;
      let id = postId;
      let guard = 0;
      while (current.parentPostId && guard++ < 20) {
        const next = posts[current.parentPostId];
        if (!next) break;
        id = current.parentPostId;
        current = next;
      }
      return { rootPostId: id, organizationId: current.organizationId };
    },
    async loadLatestStage(organizationId, rootPostId) {
      // The real adapter filters on organizationId; the fake must too, or the
      // tenant-isolation tests below would be meaningless.
      const key = `${organizationId}:${rootPostId}`;
      return stages[key] ?? null;
    },
  };
}

describe('autonomy policy', () => {
  it('requires approval by default — empty env', () => {
    expect(resolveAutonomyPolicy(ORG, {})).toEqual({
      autonomousPublishing: false,
      source: 'default-deny',
    });
    expect(requiresApproval(ORG, {})).toBe(true);
  });

  it('only opts in an org that is named explicitly', () => {
    const env = { NASHR_AUTONOMOUS_PUBLISH_ORG_IDS: `${OTHER_ORG}, org_x ` };
    expect(resolveAutonomyPolicy(ORG, env).autonomousPublishing).toBe(false);
    expect(resolveAutonomyPolicy(OTHER_ORG, env).autonomousPublishing).toBe(true);
    expect(resolveAutonomyPolicy('org_x', env).autonomousPublishing).toBe(true);
  });

  it('fails closed on a typo in the kill switch', () => {
    expect(
      resolveAutonomyPolicy(ORG, { NASHR_APPROVAL_GATE_ENABLED: 'FALSE' })
        .autonomousPublishing
    ).toBe(false);
    expect(
      resolveAutonomyPolicy(ORG, { NASHR_APPROVAL_GATE_ENABLED: '0' })
        .autonomousPublishing
    ).toBe(false);
    expect(
      resolveAutonomyPolicy(ORG, { NASHR_APPROVAL_GATE_ENABLED: 'false' })
        .autonomousPublishing
    ).toBe(true);
  });

  it('never opts in an empty organization id', () => {
    expect(
      resolveAutonomyPolicy('', { NASHR_AUTONOMOUS_PUBLISH_ORG_IDS: ',,' })
        .autonomousPublishing
    ).toBe(false);
  });

  it('requires client approval unless the org opts out', () => {
    expect(clientApprovalRequired(ORG, {})).toBe(true);
    expect(
      clientApprovalRequired(ORG, { NASHR_SKIP_CLIENT_APPROVAL_ORG_IDS: ORG })
    ).toBe(false);
    expect(
      clientApprovalRequired(ORG, {
        NASHR_SKIP_CLIENT_APPROVAL_ORG_IDS: OTHER_ORG,
      })
    ).toBe(true);
  });
});

describe('publish gate', () => {
  it('blocks a post with no approval trail at all', async () => {
    const port = makePort({ posts: { [POST]: { organizationId: ORG } } });
    const d = await evaluatePublishGate(port, { organizationId: ORG, postId: POST }, {});
    expect(d.allowed).toBe(false);
    expect(d.stage).toBe('DRAFT');
    expect(d.via).toBe('denied');
  });

  it.each([
    'DRAFT',
    'INTERNAL_REVIEW',
    'CLIENT_APPROVAL',
    'CHANGES_REQUESTED',
    'REJECTED',
  ] as NashrApprovalStageName[])('blocks a post at stage %s', async (stage) => {
    const port = makePort({
      posts: { [POST]: { organizationId: ORG } },
      stages: { [`${ORG}:${POST}`]: stage },
    });
    const d = await evaluatePublishGate(port, { organizationId: ORG, postId: POST }, {});
    expect(d.allowed).toBe(false);
    expect(d.stage).toBe(stage);
  });

  it('allows a post with an APPROVED record', async () => {
    const port = makePort({
      posts: { [POST]: { organizationId: ORG } },
      stages: { [`${ORG}:${POST}`]: 'APPROVED' },
    });
    const d = await evaluatePublishGate(port, { organizationId: ORG, postId: POST }, {});
    expect(d.allowed).toBe(true);
    expect(d.via).toBe('approved');
  });

  it('blocks a post that does not exist', async () => {
    const port = makePort({});
    const d = await evaluatePublishGate(port, { organizationId: ORG, postId: POST }, {});
    expect(d.allowed).toBe(false);
    expect(d.via).toBe('not-found');
  });

  describe('tenant isolation', () => {
    it("refuses to publish another organization's post", async () => {
      const port = makePort({
        posts: { [POST]: { organizationId: OTHER_ORG } },
        stages: { [`${OTHER_ORG}:${POST}`]: 'APPROVED' },
      });
      const d = await evaluatePublishGate(
        port,
        { organizationId: ORG, postId: POST },
        {}
      );
      expect(d.allowed).toBe(false);
      expect(d.via).toBe('tenant-mismatch');
    });

    it("does not accept another organization's APPROVED row", async () => {
      const port = makePort({
        posts: { [POST]: { organizationId: ORG } },
        // Approval recorded under a different tenant.
        stages: { [`${OTHER_ORG}:${POST}`]: 'APPROVED' },
      });
      const d = await evaluatePublishGate(
        port,
        { organizationId: ORG, postId: POST },
        {}
      );
      expect(d.allowed).toBe(false);
      expect(d.stage).toBe('DRAFT');
    });

    it("an org allowlisted for autonomy does not unlock another org's post", async () => {
      const port = makePort({ posts: { [POST]: { organizationId: ORG } } });
      const env = { NASHR_AUTONOMOUS_PUBLISH_ORG_IDS: OTHER_ORG };
      const d = await evaluatePublishGate(
        port,
        { organizationId: ORG, postId: POST },
        env
      );
      expect(d.allowed).toBe(false);
    });
  });

  describe('thread roots', () => {
    it('uses the root post approval for a child comment', async () => {
      const port = makePort({
        posts: {
          root: { organizationId: ORG },
          child: { organizationId: ORG, parentPostId: 'root' },
        },
        stages: { [`${ORG}:root`]: 'APPROVED' },
      });
      const d = await evaluatePublishGate(
        port,
        { organizationId: ORG, postId: 'child' },
        {}
      );
      expect(d.allowed).toBe(true);
    });

    it('blocks a child whose root is not approved', async () => {
      const port = makePort({
        posts: {
          root: { organizationId: ORG },
          child: { organizationId: ORG, parentPostId: 'root' },
        },
        stages: { [`${ORG}:root`]: 'INTERNAL_REVIEW' },
      });
      const d = await evaluatePublishGate(
        port,
        { organizationId: ORG, postId: 'child' },
        {}
      );
      expect(d.allowed).toBe(false);
    });
  });

  describe('autonomous publishing opt-in', () => {
    it('lets an allowlisted org publish without approval', async () => {
      const port = makePort({ posts: { [POST]: { organizationId: ORG } } });
      const d = await evaluatePublishGate(
        port,
        { organizationId: ORG, postId: POST },
        { NASHR_AUTONOMOUS_PUBLISH_ORG_IDS: ORG }
      );
      expect(d.allowed).toBe(true);
      expect(d.via).toBe('autonomous');
    });
  });

  describe('assertPublishAllowed', () => {
    it('throws NashrApprovalRequiredError when blocked', async () => {
      const port = makePort({ posts: { [POST]: { organizationId: ORG } } });
      await expect(
        assertPublishAllowed(port, { organizationId: ORG, postId: POST }, {})
      ).rejects.toBeInstanceOf(NashrApprovalRequiredError);
    });

    it('carries the stage and ids on the error', async () => {
      const port = makePort({
        posts: { [POST]: { organizationId: ORG } },
        stages: { [`${ORG}:${POST}`]: 'INTERNAL_REVIEW' },
      });
      await expect(
        assertPublishAllowed(port, { organizationId: ORG, postId: POST }, {})
      ).rejects.toMatchObject({
        stage: 'INTERNAL_REVIEW',
        postId: POST,
        organizationId: ORG,
        nashrApprovalGate: true,
      });
    });

    it('resolves when approved', async () => {
      const port = makePort({
        posts: { [POST]: { organizationId: ORG } },
        stages: { [`${ORG}:${POST}`]: 'APPROVED' },
      });
      await expect(
        assertPublishAllowed(port, { organizationId: ORG, postId: POST }, {})
      ).resolves.toMatchObject({ allowed: true });
    });
  });
});
