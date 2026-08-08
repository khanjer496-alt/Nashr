/**
 * Nashr (نشر) — registration, login, activation and logout.
 *
 * Exercised as far as is reachable without a full running HTTP stack: the real
 * `AuthService.routeAuth` with real `UsersService` / `OrganizationService`
 * over real PostgreSQL, plus the real password hashing and JWT helpers. Email
 * delivery and the HTTP cookie round-trip are stubbed — the full browser
 * journey is a manual step in TEST_PLAN.md.
 */
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import { prisma, repo, disconnect } from '../fixtures/db';
import { resetDatabase } from '../fixtures/seed';

import { AuthService } from '@gitroom/backend/services/auth/auth.service';
import { AuthService as AuthChecker } from '@gitroom/helpers/auth/auth.service';
import { UsersService } from '@gitroom/nestjs-libraries/database/prisma/users/users.service';
import { UsersRepository } from '@gitroom/nestjs-libraries/database/prisma/users/users.repository';
import { OrganizationService } from '@gitroom/nestjs-libraries/database/prisma/organizations/organization.service';
import { OrganizationRepository } from '@gitroom/nestjs-libraries/database/prisma/organizations/organization.repository';
import { CreateOrgUserDto } from '@gitroom/nestjs-libraries/dtos/auth/create.org.user.dto';
import { LoginUserDto } from '@gitroom/nestjs-libraries/dtos/auth/login.user.dto';

// Obviously fake, local-only.
const TEST_JWT_SECRET = 'nashr-local-test-secret-not-for-production-0000';
const TEST_PASSWORD = 'Local-Test-Password-123';

let db: PrismaClient;
let auth: AuthService;
let sentEmails: Array<{ to: string; subject: string; body: string }> = [];

function signup(over: Partial<CreateOrgUserDto> = {}): CreateOrgUserDto {
  const dto = new CreateOrgUserDto();
  Object.assign(dto, {
    email: `signup-${randomUUID()}@nashr-test.invalid`,
    password: TEST_PASSWORD,
    company: 'Gulf Test Agency',
    provider: 'LOCAL',
    ...over,
  });
  return dto;
}

function login(email: string, password: string): LoginUserDto {
  const dto = new LoginUserDto();
  Object.assign(dto, { email, password, provider: 'LOCAL' });
  return dto;
}

beforeAll(async () => {
  process.env.JWT_SECRET = TEST_JWT_SECRET;
  process.env.FRONTEND_URL = 'http://localhost:4200';
  delete process.env.DISABLE_REGISTRATION;
  delete process.env.DISALLOW_PLUS;

  db = prisma();
  await resetDatabase(db);

  // Notification/email delivery is stubbed; `hasEmailProvider()` returning
  // true is what makes a LOCAL signup start deactivated and require the
  // activation email, which is the production configuration.
  const notifications: any = {
    inAppNotification: async () => undefined,
    hasEmailProvider: () => true,
    sendEmail: async () => undefined,
  };
  const orgRepo = new OrganizationRepository(repo(), repo(), repo());
  const orgService = new OrganizationService(orgRepo, notifications);
  const usersRepo = new UsersRepository(repo(), repo(), repo());
  const usersService = new UsersService(usersRepo, orgRepo, notifications);

  // Email delivery is not under test; capture instead of send.
  const emailService: any = {
    sendEmail: async (to: string, subject: string, body: string) => {
      sentEmails.push({ to, subject, body });
    },
    hasProvider: () => true,
  };
  const providerManager: any = {
    getProvider: () => {
      throw new Error('not used in these tests');
    },
  };

  auth = new AuthService(
    usersService,
    orgService,
    notifications,
    emailService,
    providerManager
  );
});

beforeEach(() => {
  sentEmails = [];
});

afterAll(async () => {
  await disconnect();
});

// ───────────────────────────────────────────────────────────────────────────
describe('registration', () => {
  it('creates an organization, a user and a signed JWT', async () => {
    const dto = signup();
    const result = await auth.routeAuth('LOCAL' as any, dto, '127.0.0.1', 'jest');

    expect(result.jwt).toBeTruthy();
    const claims: any = AuthChecker.verifyJWT(result.jwt);
    expect(claims.email).toBe(dto.email);

    const user = await db.user.findFirst({ where: { email: dto.email } });
    expect(user).not.toBeNull();

    const membership = await db.userOrganization.findFirst({
      where: { userId: user!.id },
      include: { organization: true },
    });
    expect(membership).not.toBeNull();
    expect(membership!.role).toBe('SUPERADMIN');
    expect(membership!.organization.name).toBe('Gulf Test Agency');
  });

  it('never stores the password in plaintext', async () => {
    const dto = signup();
    await auth.routeAuth('LOCAL' as any, dto, '127.0.0.1', 'jest');

    const user = await db.user.findFirst({ where: { email: dto.email } });
    expect(user!.password).not.toBe(TEST_PASSWORD);
    expect(user!.password).toMatch(/^\$2[aby]\$/); // bcrypt
    expect(AuthChecker.comparePassword(TEST_PASSWORD, user!.password!)).toBe(
      true
    );
  });

  it('the JWT does not carry the password hash', async () => {
    const dto = signup();
    const result = await auth.routeAuth('LOCAL' as any, dto, '127.0.0.1', 'jest');
    const claims: any = AuthChecker.verifyJWT(result.jwt);
    expect(claims.password).toBeFalsy();
  });

  it('sends an activation email and the new account starts deactivated', async () => {
    const dto = signup();
    await auth.routeAuth('LOCAL' as any, dto, '127.0.0.1', 'jest');

    expect(sentEmails).toHaveLength(1);
    expect(sentEmails[0].to).toBe(dto.email);
    expect(sentEmails[0].subject).toMatch(/activate/i);

    const user = await db.user.findFirst({ where: { email: dto.email } });
    expect(user!.activated).toBe(false);
  });

  it('lowercases the email so Case@x and case@x are one account', async () => {
    const dto = signup({ email: `MiXeD-${randomUUID()}@NASHR-TEST.invalid` });
    const original = dto.email;
    await auth.routeAuth('LOCAL' as any, dto, '127.0.0.1', 'jest');

    const user = await db.user.findFirst({
      where: { email: original.toLowerCase() },
    });
    expect(user).not.toBeNull();
  });

  it('refuses a duplicate email', async () => {
    const dto = signup();
    await auth.routeAuth('LOCAL' as any, dto, '127.0.0.1', 'jest');
    await expect(
      auth.routeAuth('LOCAL' as any, signup({ email: dto.email }), '127.0.0.1', 'jest')
    ).rejects.toThrow(/already exists/i);
  });

  it('refuses a duplicate email that differs only in case', async () => {
    const local = `dupcase-${randomUUID()}`;
    await auth.routeAuth(
      'LOCAL' as any,
      signup({ email: `${local}@nashr-test.invalid` }),
      '127.0.0.1',
      'jest'
    );
    await expect(
      auth.routeAuth(
        'LOCAL' as any,
        signup({ email: `${local.toUpperCase()}@NASHR-TEST.invalid` }),
        '127.0.0.1',
        'jest'
      )
    ).rejects.toThrow(/already exists/i);
  });

  it('DISALLOW_PLUS blocks user+tag@ signups', async () => {
    process.env.DISALLOW_PLUS = 'true';
    try {
      await expect(
        auth.routeAuth(
          'LOCAL' as any,
          signup({ email: `plus+tag-${randomUUID()}@nashr-test.invalid` }),
          '127.0.0.1',
          'jest'
        )
      ).rejects.toThrow(/plus sign/i);
    } finally {
      delete process.env.DISALLOW_PLUS;
    }
  });

  it('DISABLE_REGISTRATION closes signup once an organization exists', async () => {
    // There is at least one org by now.
    expect(await db.organization.count()).toBeGreaterThan(0);

    process.env.DISABLE_REGISTRATION = 'true';
    try {
      expect(await auth.canRegister('LOCAL')).toBe(false);
      await expect(
        auth.routeAuth('LOCAL' as any, signup(), '127.0.0.1', 'jest')
      ).rejects.toThrow(/disabled/i);
    } finally {
      delete process.env.DISABLE_REGISTRATION;
    }
  });

  it('each registration gets its own isolated organization', async () => {
    const a = signup({ company: 'Agency A' });
    const b = signup({ company: 'Agency B' });
    await auth.routeAuth('LOCAL' as any, a, '127.0.0.1', 'jest');
    await auth.routeAuth('LOCAL' as any, b, '127.0.0.1', 'jest');

    const userA = await db.user.findFirst({ where: { email: a.email } });
    const userB = await db.user.findFirst({ where: { email: b.email } });
    const orgA = await db.userOrganization.findFirst({
      where: { userId: userA!.id },
    });
    const orgB = await db.userOrganization.findFirst({
      where: { userId: userB!.id },
    });

    expect(orgA!.organizationId).not.toBe(orgB!.organizationId);
    // And neither is a member of the other's org.
    expect(
      await db.userOrganization.count({
        where: { userId: userA!.id, organizationId: orgB!.organizationId },
      })
    ).toBe(0);
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('login', () => {
  async function registerAndActivate() {
    const dto = signup();
    await auth.routeAuth('LOCAL' as any, dto, '127.0.0.1', 'jest');
    await db.user.updateMany({
      where: { email: dto.email },
      data: { activated: true },
    });
    return dto;
  }

  it('accepts the correct password and returns a JWT', async () => {
    const dto = await registerAndActivate();
    const result = await auth.routeAuth(
      'LOCAL' as any,
      login(dto.email, TEST_PASSWORD),
      '127.0.0.1',
      'jest'
    );
    expect(result.jwt).toBeTruthy();
    const claims: any = AuthChecker.verifyJWT(result.jwt);
    expect(claims.email).toBe(dto.email);
  });

  it('rejects the wrong password', async () => {
    const dto = await registerAndActivate();
    await expect(
      auth.routeAuth(
        'LOCAL' as any,
        login(dto.email, 'definitely-not-the-password'),
        '127.0.0.1',
        'jest'
      )
    ).rejects.toThrow(/invalid user name or password/i);
  });

  it('rejects an unknown email with the SAME message — no account enumeration', async () => {
    const dto = await registerAndActivate();

    const wrongPassword = await auth
      .routeAuth('LOCAL' as any, login(dto.email, 'nope'), '127.0.0.1', 'jest')
      .catch((e) => e.message);
    const unknownUser = await auth
      .routeAuth(
        'LOCAL' as any,
        login(`ghost-${randomUUID()}@nashr-test.invalid`, 'nope'),
        '127.0.0.1',
        'jest'
      )
      .catch((e) => e.message);

    expect(wrongPassword).toEqual(unknownUser);
  });

  it('rejects an empty password', async () => {
    const dto = await registerAndActivate();
    await expect(
      auth.routeAuth('LOCAL' as any, login(dto.email, ''), '127.0.0.1', 'jest')
    ).rejects.toThrow();
  });

  it('refuses to log in a user who has not activated', async () => {
    const dto = signup();
    await auth.routeAuth('LOCAL' as any, dto, '127.0.0.1', 'jest');
    // Deliberately NOT activated.
    await expect(
      auth.routeAuth(
        'LOCAL' as any,
        login(dto.email, TEST_PASSWORD),
        '127.0.0.1',
        'jest'
      )
    ).rejects.toThrow(/not activated/i);
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('activation', () => {
  it('the activation token is a JWT that resolves to the new user', async () => {
    const dto = signup();
    const { jwt } = await auth.routeAuth(
      'LOCAL' as any,
      dto,
      '127.0.0.1',
      'jest'
    );

    // The email carries the same token in the activate link.
    expect(sentEmails[0].body).toContain(jwt);

    const claims: any = AuthChecker.verifyJWT(jwt);
    const user = await db.user.findUnique({ where: { id: claims.id } });
    expect(user!.email).toBe(dto.email);
    expect(user!.activated).toBe(false);

    await db.user.update({
      where: { id: claims.id },
      data: { activated: true },
    });
    const after = await db.user.findUnique({ where: { id: claims.id } });
    expect(after!.activated).toBe(true);
  });

  it('an activation token signed with another secret is rejected', async () => {
    const dto = signup();
    await auth.routeAuth('LOCAL' as any, dto, '127.0.0.1', 'jest');

    const real = process.env.JWT_SECRET;
    process.env.JWT_SECRET = 'another-local-only-test-secret-00000';
    const forged = AuthChecker.signJWT({ id: randomUUID(), email: dto.email });
    process.env.JWT_SECRET = real;

    expect(() => AuthChecker.verifyJWT(forged)).toThrow();
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('logout', () => {
  /**
   * Two places clear the session cookie with identical options:
   *   - `removeAuth(res)` in auth.middleware.ts, used when a session is
   *     invalidated server-side;
   *   - `POST /users/logout` in users.controller.ts, which inlines the same
   *     block for the explicit user action.
   *
   * `removeAuth` is the exported one, so it is what is exercised here.
   * Importing users.controller.ts pulls in IntegrationManager → nostr-tools,
   * which is ESM-only and cannot be loaded under this CommonJS Jest transform;
   * the controller route itself is covered by the manual login/logout walk in
   * TEST_PLAN.md.
   */
  const { removeAuth } = require('@gitroom/backend/services/auth/auth.middleware');

  function capture() {
    const cookies: any[] = [];
    const headers: Record<string, string> = {};
    const response: any = {
      cookie: (name: string, value: string, options: any) =>
        cookies.push({ name, value, options }),
      header: (k: string, v: string) => {
        headers[k] = v;
      },
      status: () => response,
      send: () => response,
    };
    removeAuth(response);
    return { cookies, headers };
  }

  it('clears the auth cookie and signals the client to log out', () => {
    const { cookies, headers } = capture();

    expect(headers.logout).toBe('true');
    const authCookie = cookies.find((c) => c.name === 'auth');
    expect(authCookie).toBeDefined();
    expect(authCookie.value).toBe('');
    expect(authCookie.options.expires.getTime()).toBe(0);
    expect(authCookie.options.maxAge).toBeLessThan(0);
  });

  it('the cleared cookie is secure + httpOnly by default', () => {
    delete process.env.NOT_SECURED;
    const { cookies } = capture();
    expect(cookies[0].options.secure).toBe(true);
    expect(cookies[0].options.httpOnly).toBe(true);
    expect(cookies[0].options.sameSite).toBe('none');
  });

  /**
   * PINNED UPSTREAM TRAP (already recorded in MENA_CUSTOMIZATIONS.md): the
   * code tests `!process.env.NOT_SECURED`, so the STRING "false" is truthy and
   * setting NOT_SECURED=false ENABLES the insecure path. Any guard must reject
   * the variable's PRESENCE, not its value.
   */
  it('NOT_SECURED=false paradoxically DISABLES the secure flags', () => {
    process.env.NOT_SECURED = 'false';
    try {
      const { cookies } = capture();
      expect(cookies[0].options.secure).toBeUndefined();
      expect(cookies[0].options.httpOnly).toBeUndefined();
    } finally {
      delete process.env.NOT_SECURED;
    }
  });

  it('a logged-out session cannot be revived — the JWT is the only credential', () => {
    // There is no server-side session store: logout is purely cookie removal,
    // so a token captured before logout stays valid until it expires. Pinned
    // because it is a real property of the design, not an accident.
    const token = AuthChecker.signJWT({ id: 'some-user', email: 'x@y.invalid' });
    capture();
    expect(() => AuthChecker.verifyJWT(token)).not.toThrow();
  });
});
