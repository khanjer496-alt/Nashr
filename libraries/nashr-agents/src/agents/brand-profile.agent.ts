/**
 * Brand Profile agent.
 *
 * Owns `NashrBrandProfile`: tone, industry, market, audience, products, offers
 * and — the field that carries real legal weight — `prohibitedClaims`.
 *
 * Prohibited claims are not advice to the other agents. They are injected into
 * every system prompt by `GroundedModel` and re-checked deterministically after
 * generation (`findProhibitedClaims`). For clinics and salons in the UAE and
 * KSA, unsubstantiated health or result claims are a regulatory matter, so the
 * constraint is enforced in code rather than left to prompt discipline.
 *
 * Every write here is `sensitive` — changing a brand's voice or its prohibited
 * claims silently changes every downstream generation.
 */
import { z } from 'zod';
import { brand } from '../../../nashr-brand/src/brand.config';
import type { AgentDefinition } from '../types';
import { parseProhibitedClaims } from '../grounding';
import { notFound } from '../errors';
import {
  AgentFactoryDeps,
  customerIdSchema,
  defineTool,
  detail,
  loadBrandProfile,
  marketSchema,
} from './agent.helpers';

const brandProfileShape = z.object({
  id: z.string(),
  brandName: z.string(),
  brandNameAr: z.string().nullable(),
  industry: z.string(),
  market: marketSchema,
  timezone: z.string(),
  toneOfVoice: z.string().nullable(),
  targetAudience: z.string().nullable(),
  products: z.string().nullable(),
  offers: z.string().nullable(),
  prohibitedClaims: z.array(z.string()),
  keywords: z.array(z.string()),
});

const splitList = (raw?: string | null): string[] =>
  (raw ?? '')
    .split(/\r?\n|,|;/)
    .map((s) => s.trim())
    .filter(Boolean);

const present = (record: any) => ({
  id: record.id,
  brandName: record.brandName,
  brandNameAr: record.brandNameAr ?? null,
  industry: record.industry,
  market: record.market,
  timezone: record.timezone,
  toneOfVoice: record.toneOfVoice ?? null,
  targetAudience: record.targetAudience ?? null,
  products: record.products ?? null,
  offers: record.offers ?? null,
  prohibitedClaims: parseProhibitedClaims(record.prohibitedClaims),
  keywords: splitList(record.keywords),
});

const writableFields = z.object({
  customerId: customerIdSchema,
  brandName: z.string().min(1).max(120).optional(),
  brandNameAr: z.string().max(120).optional(),
  industry: z.string().min(1).max(120).optional(),
  market: marketSchema.optional(),
  timezone: z.string().max(64).optional(),
  toneOfVoice: z.string().max(1000).optional(),
  targetAudience: z.string().max(1000).optional(),
  products: z.string().max(2000).optional(),
  offers: z.string().max(2000).optional(),
  keywords: z.array(z.string().max(60)).max(50).optional(),
});

export function createBrandProfileAgent(deps: AgentFactoryDeps): AgentDefinition {
  const { ports } = deps;

  return {
    key: 'nashrBrandProfile',
    name: 'Brand Profile',
    nameAr: 'ملف العلامة التجارية',
    description:
      `Reads and maintains the brand profile that grounds every other ${brand.name} agent: tone, industry, market, audience, products, offers and prohibited claims.`,
    capabilities: ['brand.read', 'brand.write'],
    modelTier: 'fast',
    instructions: `
Your job is to help the user describe their brand accurately and to keep that
description current. You are the source every other agent reads from.

- Ask for what is missing rather than guessing. An empty field is better than an
  invented one.
- Prohibited claims deserve extra care. For clinics, salons and anything health
  or beauty adjacent, ask directly about claims the business must not make
  (guaranteed results, "cures", "no side effects", medical outcomes, comparative
  superlatives). Apply the brand's prohibited claims regardless of its market.
- Explain that prohibited claims become hard constraints on every caption,
  campaign and translation ${brand.name} produces.
- You cannot save anything yourself. Saving produces a proposal for a person to
  approve; say so plainly instead of implying the change is already live.
`.trim(),
    tools: [
      defineTool({
        id: 'getBrandProfile',
        title: 'Get brand profile',
        description:
          'Return the brand profile for this workspace, optionally for a specific brand/client.',
        category: 'read',
        sensitive: false,
        capability: 'brand.read',
        inputSchema: z.object({ customerId: customerIdSchema }),
        outputSchema: z.object({
          found: z.boolean(),
          profile: brandProfileShape.nullable(),
          missingFields: z.array(z.string()),
        }),
        handler: async (input, ctx) => {
          const record = await loadBrandProfile(ports, ctx, input.customerId);
          if (!record) {
            return { found: false, profile: null, missingFields: ['all'] };
          }
          const profile = present(record);
          const missingFields = (
            [
              'toneOfVoice',
              'targetAudience',
              'products',
              'offers',
            ] as const
          ).filter((f) => !profile[f]);
          if (profile.prohibitedClaims.length === 0) missingFields.push('prohibitedClaims' as never);
          return { found: true, profile, missingFields: missingFields as string[] };
        },
      }),

      defineTool({
        id: 'listBrandProfiles',
        title: 'List brand profiles',
        description: 'List every brand profile in this workspace.',
        category: 'read',
        sensitive: false,
        capability: 'brand.read',
        inputSchema: z.object({}),
        outputSchema: z.object({ profiles: z.array(brandProfileShape) }),
        handler: async (_input, ctx) => ({
          profiles: (await ports.brand.listForOrganization(ctx.organizationId)).map(present),
        }),
      }),

      defineTool({
        id: 'previewBrandProfileChange',
        title: 'Preview a brand profile change',
        description:
          'Show what would change if the given brand fields were saved. Read-only; nothing is written.',
        category: 'read',
        sensitive: false,
        capability: 'brand.read',
        inputSchema: writableFields,
        outputSchema: z.object({
          changes: z.array(
            z.object({ field: z.string(), from: z.string(), to: z.string() })
          ),
          isNewProfile: z.boolean(),
        }),
        handler: async (input, ctx) => {
          const current = await loadBrandProfile(ports, ctx, input.customerId);
          const changes: Array<{ field: string; from: string; to: string }> = [];
          for (const [field, value] of Object.entries(input)) {
            if (field === 'customerId' || value === undefined) continue;
            const next = Array.isArray(value) ? value.join(', ') : String(value);
            const from = current ? String((current as any)[field] ?? '') : '';
            if (from !== next) changes.push({ field, from: from || '(not set)', to: next });
          }
          return { changes, isNewProfile: !current };
        },
      }),

      defineTool({
        id: 'saveBrandProfile',
        title: 'Save brand profile',
        description:
          'Create or update the brand profile. Requires human approval because every later generation is grounded in it.',
        category: 'write',
        sensitive: true,
        capability: 'brand.write',
        inputSchema: writableFields,
        outputSchema: z.object({ profile: brandProfileShape }),
        describeProposal: (input) => ({
          title: 'Save brand profile',
          summary: `Update the brand profile${input.brandName ? ` for "${input.brandName}"` : ''}.`,
          details: Object.entries(input)
            .filter(([, v]) => v !== undefined)
            .map(([k, v]) => detail(k, Array.isArray(v) ? v.join(', ') : v)),
          effect:
            'Every caption, campaign and translation produced afterwards will be grounded in these values.',
          reversible: true,
        }),
        handler: async (input, ctx) => {
          const { keywords, ...rest } = input;
          const record = await ports.brand.upsert(ctx.organizationId, {
            ...rest,
            ...(keywords ? { keywords: keywords.join(', ') } : {}),
          });
          return { profile: present(record) };
        },
      }),

      defineTool({
        id: 'setProhibitedClaims',
        title: 'Set prohibited claims',
        description:
          'Replace the list of claims the brand must never make. Requires human approval; this is a compliance control.',
        category: 'write',
        sensitive: true,
        capability: 'brand.write',
        inputSchema: z.object({
          customerId: customerIdSchema,
          claims: z
            .array(z.string().min(3).max(200))
            .max(100)
            .describe('One claim per entry, e.g. "guaranteed results", "cures acne".'),
        }),
        outputSchema: z.object({ profile: brandProfileShape }),
        describeProposal: (input) => ({
          title: 'Replace prohibited claims',
          summary: `Set ${input.claims.length} prohibited claim(s) for this brand.`,
          details: input.claims.map((c, i) => detail(`Claim ${i + 1}`, c)),
          effect:
            'These become hard constraints on every generated caption, campaign and translation. Existing content is not rewritten.',
          reversible: true,
        }),
        handler: async (input, ctx) => {
          const record = await ports.brand.upsert(ctx.organizationId, {
            customerId: input.customerId ?? null,
            prohibitedClaims: input.claims.join('\n'),
          });
          return { profile: present(record) };
        },
      }),

      defineTool({
        id: 'deleteBrandProfile',
        title: 'Delete brand profile',
        description:
          'Soft-delete a brand profile. Requires human approval; other agents lose their grounding afterwards.',
        category: 'delete',
        sensitive: true,
        capability: 'brand.write',
        inputSchema: z.object({ profileId: z.string().min(1).max(64) }),
        outputSchema: z.object({ deleted: z.boolean() }),
        describeProposal: (input) => ({
          title: 'Delete brand profile',
          summary: 'Remove this brand profile from the workspace.',
          details: [detail('Profile', input.profileId)],
          effect:
            'Content, localisation and campaign agents will fall back to having no brand facts and no prohibited claims.',
          reversible: false,
        }),
        handler: async (input, ctx) => {
          const result = await ports.brand.softDelete(ctx.organizationId, input.profileId);
          if (!result.deleted) throw notFound('brand profile not found in this organization');
          return result;
        },
      }),
    ],
  };
}
