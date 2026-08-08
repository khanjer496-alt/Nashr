/**
 * Nashr (نشر) — two-tenant adversarial seed.
 *
 * Builds two complete, realistic organizations in real PostgreSQL:
 *
 *   VICTIM   — "Gulf Eats Agency"        (org A, the data that must not leak)
 *   ATTACKER — "Desert Rivals Agency"    (org B, the tenant doing the probing)
 *
 * Both hold the full org-scoped object graph: members in every Nashr role,
 * brands (Customer), integrations, posts (including a thread), media,
 * webhooks, tags, comments, and the three Nashr tables
 * (NashrPostApproval, NashrBrandProfile, NashrAgentActionLog).
 *
 * Every credential here is obviously fake and local-only.
 */
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

export type NashrRoleLiteral =
  | 'OWNER'
  | 'ADMIN'
  | 'EDITOR'
  | 'APPROVER'
  | 'CLIENT'
  | 'VIEWER';

export interface SeededMember {
  userId: string;
  userOrgId: string;
  email: string;
  nashrRole: NashrRoleLiteral;
  nashrCustomerId: string | null;
}

export interface SeededTenant {
  label: string;
  orgId: string;
  apiKey: string;
  /** Two brands, so CLIENT brand-scoping can be tested inside one org. */
  brandAId: string;
  brandBId: string;
  brandProfileId: string;
  integrationAId: string;
  integrationBId: string;
  /** Root post on brand A, with one threaded child. */
  postId: string;
  childPostId: string;
  /** A second post on brand B, used for CLIENT cross-brand checks. */
  brandBPostId: string;
  postGroup: string;
  mediaId: string;
  webhookId: string;
  tagId: string;
  commentId: string;
  approvalId: string;
  agentLogId: string;
  members: Record<NashrRoleLiteral, SeededMember>;
}

const ROLES: NashrRoleLiteral[] = [
  'OWNER',
  'ADMIN',
  'EDITOR',
  'APPROVER',
  'CLIENT',
  'VIEWER',
];

/** Wipe every table the suite writes to, children first. */
export async function resetDatabase(db: PrismaClient) {
  await db.$executeRawUnsafe(`
    TRUNCATE TABLE
      "NashrAgentActionLog", "NashrPostApproval", "NashrBrandProfile",
      "TagsPosts", "Tags", "Comments", "Errors",
      "IntegrationsWebhooks", "Webhooks",
      "Post", "Integration", "Customer", "Media",
      "UserOrganization", "Subscription", "Notifications", "Sets",
      "Signatures", "AutoPost", "Credits", "UsedCodes",
      "User", "Organization"
    RESTART IDENTITY CASCADE;
  `);
}

export async function seedTenant(
  db: PrismaClient,
  label: string,
  slug: string
): Promise<SeededTenant> {
  const org = await db.organization.create({
    data: {
      name: label,
      description: `${label} — Nashr Phase 7 test tenant`,
      // Obviously fake, local-only. Never a real key.
      apiKey: `nashr-test-apikey-${slug}-0000`,
    },
  });

  const brandA = await db.customer.create({
    data: { name: `${slug}-brand-alpha`, orgId: org.id },
  });
  const brandB = await db.customer.create({
    data: { name: `${slug}-brand-beta`, orgId: org.id },
  });

  const brandProfile = await db.nashrBrandProfile.create({
    data: {
      organizationId: org.id,
      customerId: brandA.id,
      brandName: `${label} Alpha`,
      brandNameAr: 'ألفا',
      industry: 'restaurants',
      market: 'AE',
      timezone: 'Asia/Dubai',
      toneOfVoice: 'warm, family-friendly',
      prohibitedClaims: 'halal-certified\nmedically proven',
      // Explicitly pinned: the brief requires autonomous publishing OFF and
      // client approval ON by default. Seeding them explicitly means a silent
      // default flip in a future migration fails these tests.
      autonomousPublishing: false,
      clientApprovalRequired: true,
    },
  });

  const members = {} as Record<NashrRoleLiteral, SeededMember>;
  for (const role of ROLES) {
    const user = await db.user.create({
      data: {
        email: `${role.toLowerCase()}@${slug}.nashr-test.invalid`,
        // bcrypt hash of a throwaway local-only string; never a real secret.
        password: '$2b$10$nashrtestonlynotarealhashXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
        providerName: 'LOCAL',
        name: `${role} of ${label}`,
        timezone: 4,
        activated: true,
      },
    });
    const userOrg = await db.userOrganization.create({
      data: {
        userId: user.id,
        organizationId: org.id,
        role: role === 'OWNER' ? 'SUPERADMIN' : role === 'ADMIN' ? 'ADMIN' : 'USER',
        nashrRole: role,
        // Only the CLIENT is brand-scoped; everyone else is org-wide.
        nashrCustomerId: role === 'CLIENT' ? brandA.id : null,
      },
    });
    members[role] = {
      userId: user.id,
      userOrgId: userOrg.id,
      email: user.email,
      nashrRole: role,
      nashrCustomerId: role === 'CLIENT' ? brandA.id : null,
    };
  }

  const integrationA = await db.integration.create({
    data: {
      internalId: `${slug}-internal-alpha`,
      organizationId: org.id,
      name: `${label} Instagram`,
      providerIdentifier: 'instagram',
      type: 'social',
      // Fake token — the point is that it must never be readable cross-tenant.
      token: `FAKE-TOKEN-${slug}-alpha-do-not-use`,
      refreshToken: `FAKE-REFRESH-${slug}-alpha`,
      customerId: brandA.id,
    },
  });
  const integrationB = await db.integration.create({
    data: {
      internalId: `${slug}-internal-beta`,
      organizationId: org.id,
      name: `${label} X`,
      providerIdentifier: 'x',
      type: 'social',
      token: `FAKE-TOKEN-${slug}-beta-do-not-use`,
      customerId: brandB.id,
    },
  });

  const group = randomUUID();
  const post = await db.post.create({
    data: {
      state: 'DRAFT',
      publishDate: new Date('2026-09-01T09:00:00.000Z'),
      organizationId: org.id,
      integrationId: integrationA.id,
      content: `<p>${label} confidential campaign copy</p>`,
      group,
      creationMethod: 'WEB',
      settings: JSON.stringify({ __type: 'instagram' }),
    },
  });
  const childPost = await db.post.create({
    data: {
      state: 'DRAFT',
      publishDate: new Date('2026-09-01T09:00:00.000Z'),
      organizationId: org.id,
      integrationId: integrationA.id,
      content: `<p>${label} thread comment</p>`,
      group,
      parentPostId: post.id,
      creationMethod: 'WEB',
    },
  });
  const brandBPost = await db.post.create({
    data: {
      state: 'DRAFT',
      publishDate: new Date('2026-09-02T09:00:00.000Z'),
      organizationId: org.id,
      integrationId: integrationB.id,
      content: `<p>${label} brand-beta copy</p>`,
      group: randomUUID(),
      creationMethod: 'WEB',
    },
  });

  const media = await db.media.create({
    data: {
      name: `${slug}-secret-asset.png`,
      originalName: `${label} unreleased artwork.png`,
      path: `/uploads/${slug}/secret-asset.png`,
      organizationId: org.id,
      fileSize: 2048,
      type: 'image',
    },
  });

  const webhook = await db.webhooks.create({
    data: {
      name: `${label} internal hook`,
      organizationId: org.id,
      url: `https://hooks.${slug}.nashr-test.invalid/private`,
    },
  });

  const tag = await db.tags.create({
    data: { name: `${slug}-confidential`, color: '#0E7C74', orgId: org.id },
  });

  const comment = await db.comments.create({
    data: {
      content: `${label} internal review note`,
      organizationId: org.id,
      postId: post.id,
      userId: members.ADMIN.userId,
    },
  });

  const approval = await db.nashrPostApproval.create({
    data: {
      postId: post.id,
      organizationId: org.id,
      stage: 'INTERNAL_REVIEW',
      decision: 'SUBMITTED',
      actorId: members.EDITOR.userId,
      actorRole: 'EDITOR',
      note: `${label} submitted for review`,
    },
  });

  const agentLog = await db.nashrAgentActionLog.create({
    data: {
      organizationId: org.id,
      userOrgId: members.ADMIN.userOrgId,
      agentKey: 'content',
      toolName: 'draft_post',
      sensitive: false,
      status: 'EXECUTED',
      argsDigest: JSON.stringify({ brand: `${label} Alpha` }),
      resultSummary: `${label} drafted 3 captions`,
      attempts: 1,
      durationMs: 1200,
    },
  });

  return {
    label,
    orgId: org.id,
    apiKey: org.apiKey!,
    brandAId: brandA.id,
    brandBId: brandB.id,
    brandProfileId: brandProfile.id,
    integrationAId: integrationA.id,
    integrationBId: integrationB.id,
    postId: post.id,
    childPostId: childPost.id,
    brandBPostId: brandBPost.id,
    postGroup: group,
    mediaId: media.id,
    webhookId: webhook.id,
    tagId: tag.id,
    commentId: comment.id,
    approvalId: approval.id,
    agentLogId: agentLog.id,
    members,
  };
}

export interface TwoTenants {
  victim: SeededTenant;
  attacker: SeededTenant;
}

/** Fresh database, then both tenants. Call in beforeAll. */
export async function seedTwoTenants(db: PrismaClient): Promise<TwoTenants> {
  await resetDatabase(db);
  const victim = await seedTenant(db, 'Gulf Eats Agency', 'victim');
  const attacker = await seedTenant(db, 'Desert Rivals Agency', 'attacker');
  return { victim, attacker };
}
