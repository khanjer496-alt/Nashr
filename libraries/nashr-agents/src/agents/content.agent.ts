/**
 * Content agent.
 *
 * Generates captions, hooks, hashtags and content ideas in English AND Arabic,
 * grounded in the brand profile. Generation is never free-floating: every call
 * goes through `GroundedModel`, which injects brand facts and prohibited claims
 * and re-checks the output against them.
 *
 * Only one tool here writes anything (`saveDraftPost`), and it is sensitive.
 */
import { z } from 'zod';
import type { AgentDefinition } from '../types';
import { findProhibitedClaims, parseProhibitedClaims } from '../grounding';
import {
  AgentFactoryDeps,
  customerIdSchema,
  defineTool,
  detail,
  groundedModelFor,
  loadGrounding,
  localeSchema,
  parseJsonBlock,
} from './agent.helpers';

const bilingualItem = z.object({
  en: z.string(),
  ar: z.string(),
  note: z.string().optional(),
});

const CONTENT_INSTRUCTIONS = `
You write social content for MENA businesses — restaurants, agencies, salons,
clinics and small businesses.

- Produce English and Arabic as two pieces of original writing, not a translation
  pair. The Arabic should read as though it was written first for the market;
  the English should read as though it was written first for an English speaker
  in that market.
- Use the brand's tone of voice. If none is recorded, stay warm, concrete and
  free of hype.
- Never state a price, an offer, an opening time or a result that is not in the
  brand profile or in the user's message.
- Respect the prohibited claims absolutely.
`.trim();

export function createContentAgent(deps: AgentFactoryDeps): AgentDefinition {
  const { ports } = deps;

  return {
    key: 'nashrContent',
    name: 'Content',
    nameAr: 'المحتوى',
    description:
      'Generates bilingual captions, hooks, hashtags and content ideas grounded in the brand profile.',
    capabilities: ['content.generate', 'content.write', 'brand.read'],
    instructions: CONTENT_INSTRUCTIONS,
    tools: [
      defineTool({
        id: 'generateCaptions',
        title: 'Generate captions',
        description:
          'Generate bilingual (English + Arabic) captions for a topic, grounded in the brand profile.',
        category: 'generate',
        sensitive: false,
        capability: 'content.generate',
        inputSchema: z.object({
          customerId: customerIdSchema,
          topic: z.string().min(3).max(600),
          platform: z
            .string()
            .max(40)
            .optional()
            .describe('Channel name, e.g. instagram, tiktok, linkedin.'),
          count: z.number().int().min(1).max(5).default(3),
          language: localeSchema,
          includeCallToAction: z.boolean().default(true),
        }),
        outputSchema: z.object({
          captions: z.array(bilingualItem),
          groundedInBrandProfile: z.boolean(),
          prohibitedClaimsApplied: z.number(),
        }),
        handler: async (input, ctx) => {
          const grounding = await loadGrounding(ports, ctx, input.customerId);
          const model = await groundedModelFor(
            deps,
            ctx,
            CONTENT_INSTRUCTIONS,
            input.customerId
          );
          const text = await model.generate({
            prompt: [
              `Write ${input.count} caption option(s).`,
              `Topic: ${input.topic}`,
              input.platform ? `Channel: ${input.platform}` : '',
              input.includeCallToAction
                ? 'Each option ends with a short, natural call to action.'
                : 'Do not add a call to action.',
              `Language: ${input.language === 'both' ? 'English and Arabic' : input.language}.`,
              'Return JSON only: {"captions":[{"en":"...","ar":"...","note":"why this angle"}]}',
            ]
              .filter(Boolean)
              .join('\n'),
            temperature: 0.8,
          });

          const parsed = parseJsonBlock<{ captions?: Array<Record<string, string>> }>(
            text,
            {}
          );
          const captions = (parsed.captions ?? []).slice(0, input.count).map((c) => ({
            en: String(c.en ?? ''),
            ar: String(c.ar ?? ''),
            note: c.note ? String(c.note) : undefined,
          }));

          return {
            captions,
            groundedInBrandProfile: !!grounding,
            prohibitedClaimsApplied: parseProhibitedClaims(grounding?.prohibitedClaims).length,
          };
        },
      }),

      defineTool({
        id: 'generateHooks',
        title: 'Generate hooks',
        description: 'Generate short opening lines designed to stop the scroll, in both languages.',
        category: 'generate',
        sensitive: false,
        capability: 'content.generate',
        inputSchema: z.object({
          customerId: customerIdSchema,
          topic: z.string().min(3).max(600),
          count: z.number().int().min(1).max(8).default(5),
        }),
        outputSchema: z.object({ hooks: z.array(bilingualItem) }),
        handler: async (input, ctx) => {
          const model = await groundedModelFor(deps, ctx, CONTENT_INSTRUCTIONS, input.customerId);
          const text = await model.generate({
            prompt: [
              `Write ${input.count} opening hooks (max 12 words each) about: ${input.topic}`,
              'No emoji spam, no clickbait the brand cannot deliver on.',
              'Return JSON only: {"hooks":[{"en":"...","ar":"..."}]}',
            ].join('\n'),
            temperature: 0.9,
          });
          const parsed = parseJsonBlock<{ hooks?: Array<Record<string, string>> }>(text, {});
          return {
            hooks: (parsed.hooks ?? []).slice(0, input.count).map((h) => ({
              en: String(h.en ?? ''),
              ar: String(h.ar ?? ''),
            })),
          };
        },
      }),

      defineTool({
        id: 'generateHashtags',
        title: 'Generate hashtags',
        description:
          'Suggest English and Arabic hashtags appropriate to the brand, market and channel.',
        category: 'generate',
        sensitive: false,
        capability: 'content.generate',
        inputSchema: z.object({
          customerId: customerIdSchema,
          topic: z.string().min(3).max(600),
          platform: z.string().max(40).optional(),
          count: z.number().int().min(3).max(30).default(12),
        }),
        outputSchema: z.object({
          english: z.array(z.string()),
          arabic: z.array(z.string()),
          note: z.string(),
        }),
        handler: async (input, ctx) => {
          const model = await groundedModelFor(deps, ctx, CONTENT_INSTRUCTIONS, input.customerId);
          const text = await model.generate({
            prompt: [
              `Suggest up to ${input.count} hashtags for: ${input.topic}`,
              input.platform ? `Channel: ${input.platform}` : '',
              'Mix broad and niche. Arabic hashtags must be ones people in this market actually use.',
              'Return JSON only: {"english":["#..."],"arabic":["#..."],"note":"one sentence on mix"}',
            ]
              .filter(Boolean)
              .join('\n'),
            temperature: 0.6,
          });
          const parsed = parseJsonBlock<{
            english?: string[];
            arabic?: string[];
            note?: string;
          }>(text, {});
          return {
            english: (parsed.english ?? []).map(String).slice(0, input.count),
            arabic: (parsed.arabic ?? []).map(String).slice(0, input.count),
            note: String(parsed.note ?? ''),
          };
        },
      }),

      defineTool({
        id: 'generateContentIdeas',
        title: 'Generate content ideas',
        description:
          'Propose content ideas for the brand, with the angle and format for each.',
        category: 'generate',
        sensitive: false,
        capability: 'content.generate',
        inputSchema: z.object({
          customerId: customerIdSchema,
          theme: z.string().max(400).optional(),
          count: z.number().int().min(1).max(15).default(8),
        }),
        outputSchema: z.object({
          ideas: z.array(
            z.object({
              titleEn: z.string(),
              titleAr: z.string(),
              format: z.string(),
              angle: z.string(),
            })
          ),
        }),
        handler: async (input, ctx) => {
          const model = await groundedModelFor(deps, ctx, CONTENT_INSTRUCTIONS, input.customerId);
          const text = await model.generate({
            prompt: [
              `Propose ${input.count} content ideas${input.theme ? ` around: ${input.theme}` : ''}.`,
              'Each idea: a bilingual working title, a format (reel, carousel, photo, story, short video), and the angle.',
              'Return JSON only: {"ideas":[{"titleEn":"...","titleAr":"...","format":"...","angle":"..."}]}',
            ].join('\n'),
            temperature: 0.85,
          });
          const parsed = parseJsonBlock<{ ideas?: Array<Record<string, string>> }>(text, {});
          return {
            ideas: (parsed.ideas ?? []).slice(0, input.count).map((i) => ({
              titleEn: String(i.titleEn ?? ''),
              titleAr: String(i.titleAr ?? ''),
              format: String(i.format ?? ''),
              angle: String(i.angle ?? ''),
            })),
          };
        },
      }),

      defineTool({
        id: 'checkProhibitedClaims',
        title: 'Check text against prohibited claims',
        description:
          'Deterministically check draft text against the brand’s prohibited claims. No model involved.',
        category: 'read',
        sensitive: false,
        capability: 'brand.read',
        inputSchema: z.object({
          customerId: customerIdSchema,
          text: z.string().min(1).max(8000),
        }),
        outputSchema: z.object({
          passed: z.boolean(),
          violations: z.array(z.string()),
          claimsChecked: z.number(),
        }),
        handler: async (input, ctx) => {
          const grounding = await loadGrounding(ports, ctx, input.customerId);
          const claims = parseProhibitedClaims(grounding?.prohibitedClaims);
          const violations = findProhibitedClaims(input.text, claims);
          return { passed: violations.length === 0, violations, claimsChecked: claims.length };
        },
      }),

      defineTool({
        id: 'saveDraftPost',
        title: 'Save a draft post',
        description:
          'Save generated content as a draft post. Requires human approval; it creates content in the workspace.',
        category: 'write',
        sensitive: true,
        capability: 'content.write',
        inputSchema: z.object({
          customerId: customerIdSchema,
          integrationIds: z.array(z.string().min(1).max(64)).min(1).max(20),
          contentEn: z.string().max(6000).optional(),
          contentAr: z.string().max(6000).optional(),
          tags: z.array(z.string().max(60)).max(20).optional(),
        }),
        outputSchema: z.object({ postId: z.string(), state: z.string() }),
        describeProposal: (input) => ({
          title: 'Save a draft post',
          summary: `Create one draft across ${input.integrationIds.length} channel(s). It will not be scheduled or published.`,
          details: [
            detail('Channels', input.integrationIds.length),
            detail('English', input.contentEn ? `${input.contentEn.slice(0, 160)}…` : '(none)'),
            detail('Arabic', input.contentAr ? `${input.contentAr.slice(0, 160)}…` : '(none)'),
          ],
          effect:
            'A draft appears in the calendar. Publishing still requires the normal approval workflow.',
          reversible: true,
        }),
        handler: async (input, ctx) => {
          const created = await ports.posts.createDraft(ctx.organizationId, {
            customerId: input.customerId ?? null,
            integrationIds: input.integrationIds,
            contentEn: input.contentEn,
            contentAr: input.contentAr,
            tags: input.tags,
          });
          return { postId: created.id, state: created.state };
        },
      }),
    ],
  };
}
