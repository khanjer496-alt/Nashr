/**
 * Nashr (نشر) — unauthorized access and role permissions.
 *
 * Two layers, both exercised with the real implementations against real
 * PostgreSQL:
 *
 *   1. AuthMiddleware — the identity gate. Anonymous, forged, expired-identity
 *      and disabled-membership requests must all be rejected.
 *   2. PermissionsService.checkNashrRole / the role matrix — the authorization
 *      gate. Roles are read FRESH FROM THE DATABASE on every request, so a
 *      demotion takes effect immediately rather than at next login.
 *
 * The scenarios go beyond the existing matrix unit tests: EDITOR cannot
 * approve, CLIENT cannot edit, CLIENT sees only their own brand.
 */
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import { prisma, repo, disconnect } from '../fixtures/db';
import { seedTwoTenants, SeededTenant } from '../fixtures/seed';

import { AuthService } from '@gitroom/helpers/auth/auth.service';
import { AuthMiddleware } from '@gitroom/backend/services/auth/auth.middleware';
import { OrganizationService } from '@gitroom/nestjs-libraries/database/prisma/organizations/organization.service';
import { OrganizationRepository } from '@gitroom/nestjs-libraries/database/prisma/organizations/organization.repository';
import { UsersService } from '@gitroom/nestjs-libraries/database/prisma/users/users.service';
import { UsersRepository } from '@gitroom/nestjs-libraries/database/prisma/users/users.repository';

import { can, firstDenied, scopeFor } from '@gitroom/nashr-permissions/role.matrix';
import { resolveBrandScope } from '@gitroom/nashr-permissions/brand.scope';
import {
  NashrApprovalError,
  NashrApprovalService,
} from '@gitroom/nashr-approval/approval.service';
import { legalDecisionsFor, transition } from '@gitroom/nashr-approval/state-machine';

// Obviously fake, local-only. Set before any JWT is minted.
const TEST_JWT_SECRET = 'nashr-local-test-secret-not-for-production-0000';

let db: PrismaClient;
let victim: SeededTenant;
let attacker: SeededTenant;
let middleware: AuthMiddleware;
let approvals: NashrApprovalService;

/** Minimal express-ish doubles. */
function makeReq(over: any = {}) {
  return {
    headers: {},
    cookies: {},
    path: '/posts',
    query: {},
    ...over,
  } as any;
}
function makeRes() {
  const headers: Record<string, string> = {};
  return {
    cookie: () => undefined,
    header: (k: string, v: string) => {
      headers[k] = v;
    },
    _headers: headers,
  } as any;
}

/** Run the middleware and report what happened. */
async function runMiddleware(req: any) {
  const res = makeRes();
  let nextCalled = false;
  let error: any = null;
  try {
    await middleware.use(req, res, () => {
      nextCalled = true;
    });
  } catch (err) {
    error = err;
  }
  return { nextCalled, error, req, res };
}

beforeAll(async () => {
  process.env.JWT_SECRET = TEST_JWT_SECRET;
  db = prisma();
  const tenants = await seedTwoTenants(db);
  victim = tenants.victim;
  attacker = tenants.attacker;

  // Notifications are not under test here; the middleware never reaches them.
  const notifications: any = {};
  const orgRepo = new OrganizationRepository(repo(), repo(), repo());
  const orgService = new OrganizationService(orgRepo, notifications);
  const usersRepo = new UsersRepository(repo(), repo(), repo());
  const usersService = new UsersService(usersRepo, orgRepo, notifications);
  middleware = new AuthMiddleware(orgService, usersService);

  approvals = new NashrApprovalService(repo() as any);
});

afterAll(async () => {
  await disconnect();
});

// ───────────────────────────────────────────────────────────────────────────
describe('unauthenticated access is rejected', () => {
  it('a request with no auth cookie and no auth header is refused', async () => {
    const { nextCalled, error } = await runMiddleware(makeReq());
    expect(nextCalled).toBe(false);
    expect(error).toBeTruthy();
  });

  it('an empty auth header is refused', async () => {
    const { nextCalled, error } = await runMiddleware(
      makeReq({ headers: { auth: '' } })
    );
    expect(nextCalled).toBe(false);
    expect(error).toBeTruthy();
  });

  it('a structurally invalid token is refused', async () => {
    const { nextCalled, error } = await runMiddleware(
      makeReq({ headers: { auth: 'not-a-jwt' } })
    );
    expect(nextCalled).toBe(false);
    expect(error).toBeTruthy();
  });

  it('a token signed with the WRONG secret is refused', async () => {
    const realSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = 'a-completely-different-local-test-secret';
    const forged = AuthService.signJWT({ id: victim.members.OWNER.userId });
    process.env.JWT_SECRET = realSecret;

    const { nextCalled, error } = await runMiddleware(
      makeReq({ headers: { auth: forged } })
    );
    expect(nextCalled).toBe(false);
    expect(error).toBeTruthy();
  });

  it('a validly-signed token for a user that does not exist is refused', async () => {
    const token = AuthService.signJWT({ id: randomUUID() });
    const { nextCalled, error } = await runMiddleware(
      makeReq({ headers: { auth: token } })
    );
    expect(nextCalled).toBe(false);
    expect(error).toBeTruthy();
  });

  it('claims in the token body are NOT trusted — isSuperAdmin cannot be forged', async () => {
    // Correctly signed, but claiming super-admin. The middleware must
    // re-resolve the user from the database and ignore the claim.
    const token = AuthService.signJWT({
      id: victim.members.VIEWER.userId,
      isSuperAdmin: true,
      activated: true,
    });
    const { nextCalled, req } = await runMiddleware(
      makeReq({ headers: { auth: token } })
    );
    expect(nextCalled).toBe(true);
    expect(req.user.isSuperAdmin).toBe(false);
  });

  it('a deactivated user is refused even with a valid token', async () => {
    const user = await db.user.create({
      data: {
        email: `deactivated-${randomUUID()}@nashr-test.invalid`,
        providerName: 'LOCAL',
        timezone: 4,
        activated: false,
      },
    });
    await db.userOrganization.create({
      data: {
        userId: user.id,
        organizationId: victim.orgId,
        nashrRole: 'VIEWER',
      },
    });

    const token = AuthService.signJWT({ id: user.id });
    const { nextCalled, error } = await runMiddleware(
      makeReq({ headers: { auth: token } })
    );
    expect(nextCalled).toBe(false);
    expect(error).toBeTruthy();
  });
});

describe('an authenticated user is bound to their OWN organization', () => {
  it('the resolved org is the user\'s org, never another tenant', async () => {
    const token = AuthService.signJWT({ id: victim.members.ADMIN.userId });
    const { nextCalled, req } = await runMiddleware(
      makeReq({ headers: { auth: token } })
    );
    expect(nextCalled).toBe(true);
    expect(req.org.id).toBe(victim.orgId);
    expect(req.org.id).not.toBe(attacker.orgId);
  });

  it('asking for another tenant via the showorg header does NOT switch tenants', async () => {
    const token = AuthService.signJWT({ id: victim.members.ADMIN.userId });
    const { nextCalled, req } = await runMiddleware(
      makeReq({
        headers: { auth: token, showorg: attacker.orgId },
      })
    );
    expect(nextCalled).toBe(true);
    // `showorg` only selects among organizations the user actually belongs to.
    expect(req.org.id).toBe(victim.orgId);
  });

  it('a disabled membership is filtered out of the org list', async () => {
    const user = await db.user.create({
      data: {
        email: `disabled-${randomUUID()}@nashr-test.invalid`,
        providerName: 'LOCAL',
        timezone: 4,
        activated: true,
      },
    });
    await db.userOrganization.create({
      data: {
        userId: user.id,
        organizationId: victim.orgId,
        nashrRole: 'ADMIN',
        disabled: true,
      },
    });

    const token = AuthService.signJWT({ id: user.id });
    const { nextCalled, error } = await runMiddleware(
      makeReq({ headers: { auth: token } })
    );
    // With every membership disabled there is no organization to bind to.
    expect(nextCalled).toBe(false);
    expect(error).toBeTruthy();
  });

  it('the password hash is never attached to the request', async () => {
    const token = AuthService.signJWT({ id: victim.members.OWNER.userId });
    const { req } = await runMiddleware(makeReq({ headers: { auth: token } }));
    expect(req.user.password).toBeUndefined();
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('role permissions — realistic scenarios', () => {
  it('EDITOR cannot approve, at either layer', () => {
    // Layer 1: the matrix.
    expect(can('EDITOR', 'approval', 'approve')).toBe(false);
    expect(can('EDITOR', 'post', 'publish')).toBe(false);
    expect(can('EDITOR', 'post', 'schedule')).toBe(false);
    // But they can author and submit.
    expect(can('EDITOR', 'post', 'create')).toBe(true);
    expect(can('EDITOR', 'approval', 'submit')).toBe(true);

    // Layer 2: the state machine refuses the transition itself, so even a
    // caller that slipped past the guard cannot record the decision.
    const result = transition({
      currentStage: 'INTERNAL_REVIEW',
      decision: 'APPROVED',
      actorRole: 'EDITOR',
    });
    expect(result.ok).toBe(false);
    expect((result as any).code).toBe('ROLE_NOT_PERMITTED');
  });

  it('EDITOR cannot approve a real post in the database', async () => {
    const post = await db.post.create({
      data: {
        state: 'DRAFT',
        publishDate: new Date('2026-12-05T09:00:00.000Z'),
        organizationId: victim.orgId,
        integrationId: victim.integrationAId,
        content: '<p>editor authored</p>',
        group: randomUUID(),
        creationMethod: 'WEB',
      },
    });

    await approvals.decide({
      organizationId: victim.orgId,
      postId: post.id,
      actorId: victim.members.EDITOR.userId,
      actorRole: 'EDITOR',
      decision: 'SUBMITTED',
    });

    await expect(
      approvals.decide({
        organizationId: victim.orgId,
        postId: post.id,
        actorId: victim.members.EDITOR.userId,
        actorRole: 'EDITOR',
        decision: 'APPROVED',
      })
    ).rejects.toBeInstanceOf(NashrApprovalError);

    expect(await approvals.getCurrentStage(victim.orgId, post.id)).toBe(
      'INTERNAL_REVIEW'
    );
  });

  it('CLIENT cannot edit anything', () => {
    for (const resource of ['post', 'brand', 'integration', 'webhook'] as const) {
      for (const action of ['create', 'update', 'delete'] as const) {
        expect(`${resource}.${action}=${can('CLIENT', resource, action)}`).toEqual(
          `${resource}.${action}=false`
        );
      }
    }
    expect(can('CLIENT', 'post', 'read')).toBe(true);
    expect(can('CLIENT', 'approval', 'approve')).toBe(true);
  });

  it('CLIENT cannot make the INTERNAL_REVIEW decision — only the client one', () => {
    expect(
      transition({
        currentStage: 'INTERNAL_REVIEW',
        decision: 'APPROVED',
        actorRole: 'CLIENT',
      }).ok
    ).toBe(false);
    expect(
      transition({
        currentStage: 'CLIENT_APPROVAL',
        decision: 'APPROVED',
        actorRole: 'CLIENT',
      }).ok
    ).toBe(true);
  });

  it('APPROVER cannot author or publish', () => {
    expect(can('APPROVER', 'post', 'create')).toBe(false);
    expect(can('APPROVER', 'post', 'update')).toBe(false);
    expect(can('APPROVER', 'post', 'publish')).toBe(false);
    expect(can('APPROVER', 'approval', 'approve')).toBe(true);
    // Internal sign-off must not substitute for the client's.
    expect(
      transition({
        currentStage: 'CLIENT_APPROVAL',
        decision: 'APPROVED',
        actorRole: 'APPROVER',
      }).ok
    ).toBe(false);
  });

  it('VIEWER can do nothing but read', () => {
    expect(legalDecisionsFor('INTERNAL_REVIEW', 'VIEWER')).toEqual([]);
    expect(can('VIEWER', 'post', 'read')).toBe(true);
    expect(can('VIEWER', 'post', 'create')).toBe(false);
    expect(can('VIEWER', 'approval', 'approve')).toBe(false);
  });

  it('only OWNER may mutate billing or delete the organization', () => {
    expect(can('OWNER', 'billing', 'update')).toBe(true);
    expect(can('ADMIN', 'billing', 'update')).toBe(false);
    expect(can('ADMIN', 'billing', 'read')).toBe(true);
    expect(can('OWNER', 'organization', 'delete')).toBe(true);
    expect(can('ADMIN', 'organization', 'delete')).toBe(false);
  });

  it('unknown, null and prototype-polluting inputs are denied (default deny)', () => {
    expect(can(undefined, 'post', 'read')).toBe(false);
    expect(can(null, 'post', 'read')).toBe(false);
    expect(can('SUPERUSER', 'post', 'read')).toBe(false);
    expect(can('OWNER', 'constructor', 'read')).toBe(false);
    expect(can('OWNER', '__proto__', 'read')).toBe(false);
    expect(can('OWNER', 'post', 'toString')).toBe(false);
    expect(firstDenied('EDITOR', [['approval', 'approve']])).toEqual({
      resource: 'approval',
      action: 'approve',
      role: 'EDITOR',
    });
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('CLIENT brand scoping — a client sees only their own brand', () => {
  it('the CLIENT role is brand-scoped; staff roles are organization-wide', () => {
    expect(scopeFor('CLIENT')).toBe('own_brand');
    for (const role of ['OWNER', 'ADMIN', 'EDITOR', 'APPROVER', 'VIEWER']) {
      expect(`${role}=${scopeFor(role)}`).toEqual(`${role}=organization`);
    }
    // An unknown role gets the NARROWEST scope, never the widest.
    expect(scopeFor('WHATEVER')).toBe('own_brand');
  });

  it('resolveBrandScope reads the real UserOrganization.nashrCustomerId link', async () => {
    const membership = await db.userOrganization.findFirst({
      where: {
        userId: victim.members.CLIENT.userId,
        organizationId: victim.orgId,
      },
      select: { nashrCustomerId: true },
    });
    expect(membership!.nashrCustomerId).toBe(victim.brandAId);

    const scope = resolveBrandScope('CLIENT', membership, {});
    expect(scope.allowedCustomerIds).toEqual([victim.brandAId]);
  });

  it('an unlinked CLIENT fails CLOSED — no brands at all', () => {
    const scope = resolveBrandScope('CLIENT', { nashrCustomerId: null }, {});
    expect(scope.allowedCustomerIds).toEqual([]);
    expect(scope.warning).toContain('fail closed');
  });

  it('a CLIENT may approve a post on their OWN brand', async () => {
    const post = await db.post.create({
      data: {
        state: 'DRAFT',
        publishDate: new Date('2026-12-06T09:00:00.000Z'),
        organizationId: victim.orgId,
        // integrationA belongs to brandA, which is the CLIENT's brand.
        integrationId: victim.integrationAId,
        content: '<p>brand alpha copy</p>',
        group: randomUUID(),
        creationMethod: 'WEB',
      },
    });

    for (const s of [
      { role: 'EDITOR', decision: 'SUBMITTED' },
      { role: 'APPROVER', decision: 'APPROVED' },
    ] as const) {
      await approvals.decide({
        organizationId: victim.orgId,
        postId: post.id,
        actorId: victim.members[s.role].userId,
        actorRole: s.role,
        decision: s.decision,
      });
    }

    const result = await approvals.decide({
      organizationId: victim.orgId,
      postId: post.id,
      actorId: victim.members.CLIENT.userId,
      actorRole: 'CLIENT',
      decision: 'APPROVED',
      allowedCustomerIds: [victim.brandAId],
    });
    expect(result.stage).toBe('APPROVED');
  });

  it('a CLIENT may NOT approve a post on a DIFFERENT brand in the same org', async () => {
    const post = await db.post.create({
      data: {
        state: 'DRAFT',
        publishDate: new Date('2026-12-07T09:00:00.000Z'),
        organizationId: victim.orgId,
        // integrationB belongs to brandB — NOT the CLIENT's brand.
        integrationId: victim.integrationBId,
        content: '<p>brand beta copy</p>',
        group: randomUUID(),
        creationMethod: 'WEB',
      },
    });

    for (const s of [
      { role: 'EDITOR', decision: 'SUBMITTED' },
      { role: 'APPROVER', decision: 'APPROVED' },
    ] as const) {
      await approvals.decide({
        organizationId: victim.orgId,
        postId: post.id,
        actorId: victim.members[s.role].userId,
        actorRole: s.role,
        decision: s.decision,
      });
    }

    await expect(
      approvals.decide({
        organizationId: victim.orgId,
        postId: post.id,
        actorId: victim.members.CLIENT.userId,
        actorRole: 'CLIENT',
        decision: 'APPROVED',
        allowedCustomerIds: [victim.brandAId],
      })
    ).rejects.toMatchObject({ code: 'BRAND_FORBIDDEN' });

    expect(await approvals.getCurrentStage(victim.orgId, post.id)).toBe(
      'CLIENT_APPROVAL'
    );
  });

  it('listPending for a CLIENT shows only their own brand\'s posts', async () => {
    const pending = await approvals.listPending(victim.orgId, 'CLIENT', [
      victim.brandAId,
    ]);
    const customerIds = pending.map(
      (p: any) => p.post?.integration?.customerId
    );
    for (const id of customerIds) {
      expect(id).toBe(victim.brandAId);
    }
    expect(customerIds).not.toContain(victim.brandBId);
  });

  it('a CLIENT with an empty brand list sees nothing at all', async () => {
    const pending = await approvals.listPending(victim.orgId, 'CLIENT', []);
    expect(pending).toEqual([]);
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('roles are re-read from the database, not trusted from the token', () => {
  it('a demotion takes effect immediately', async () => {
    const before = await approvals.getMemberRole(
      victim.orgId,
      victim.members.APPROVER.userId
    );
    expect(before).toBe('APPROVER');

    await db.userOrganization.update({
      where: { id: victim.members.APPROVER.userOrgId },
      data: { nashrRole: 'VIEWER' },
    });

    const after = await approvals.getMemberRole(
      victim.orgId,
      victim.members.APPROVER.userId
    );
    expect(after).toBe('VIEWER');
    expect(can(after, 'approval', 'approve')).toBe(false);

    await db.userOrganization.update({
      where: { id: victim.members.APPROVER.userOrgId },
      data: { nashrRole: 'APPROVER' },
    });
  });

  it('a user from another organization has NO role in this one', async () => {
    const role = await approvals.getMemberRole(
      victim.orgId,
      attacker.members.OWNER.userId
    );
    expect(role).toBeNull();
    expect(can(role, 'post', 'read')).toBe(false);
  });

  it('a disabled membership resolves to no role', async () => {
    await db.userOrganization.update({
      where: { id: victim.members.VIEWER.userOrgId },
      data: { disabled: true },
    });
    const role = await approvals.getMemberRole(
      victim.orgId,
      victim.members.VIEWER.userId
    );
    expect(role).toBeNull();
    await db.userOrganization.update({
      where: { id: victim.members.VIEWER.userOrgId },
      data: { disabled: false },
    });
  });
});
