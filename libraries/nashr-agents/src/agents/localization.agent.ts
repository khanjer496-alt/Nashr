/**
 * Localization agent.
 *
 * The product requirement is explicit: **avoid literal translation when a
 * culturally natural version is better**. So the default mode of every tool
 * here is `cultural`, and `literal` mode exists only because a user sometimes
 * genuinely needs a faithful rendering (legal text, a quoted price, a menu
 * item). The mode is a required, visible field on the output — nobody has to
 * guess which one they got.
 *
 * Handles both directions: ar→en and en→ar.
 */
import { z } from 'zod';
import type { AgentDefinition } from '../types';
import { marketNote } from '../grounding';
import {
  AgentFactoryDeps,
  customerIdSchema,
  defineTool,
  groundedModelFor,
  marketSchema,
  parseJsonBlock,
} from './agent.helpers';

const LOCALIZATION_INSTRUCTIONS = `
You adapt marketing copy between Arabic and English for specific Gulf and wider
MENA markets. You are not a translator.

Rules:
- Default to cultural adaptation. A literal rendering that is grammatically
  correct but reads as foreign is a failure, not a safe choice.
- Rewrite idioms, humour, wordplay and cultural references so they land for the
  target audience, even when that means changing the surface meaning.
- Register matters more than vocabulary. Saudi audiences read Khaleeji phrasing
  as local and Levantine or Egyptian phrasing as foreign; Emirati audiences are
  used to a more multinational voice. Egyptian colloquial is its own register.
- Keep names, prices, dates, legal disclaimers and product names exact. Never
  "adapt" a number or a claim.
- Do not add a promise, discount or result the source text did not contain.
- Say what you changed and why. If a literal version would have been wrong, name
  the reason.
`.trim();

const adaptationSchema = z.object({
  text: z.string(),
  mode: z.enum(['cultural', 'literal']),
  changes: z.array(
    z.object({
      from: z.string(),
      to: z.string(),
      reason: z.string(),
    })
  ),
  literalWouldHaveBeen: z.string().optional(),
});

export function createLocalizationAgent(deps: AgentFactoryDeps): AgentDefinition {
  return {
    key: 'nashrLocalization',
    name: 'Localization',
    nameAr: 'التوطين',
    description:
      'Adapts content between Arabic and English for a specific MENA market, preferring culturally natural writing over literal translation.',
    capabilities: ['localization.adapt', 'brand.read'],
    instructions: LOCALIZATION_INSTRUCTIONS,
    tools: [
      defineTool({
        id: 'adaptContent',
        title: 'Adapt content for a market',
        description:
          'Adapt text between Arabic and English for a target market. Cultural adaptation by default.',
        category: 'generate',
        sensitive: false,
        capability: 'localization.adapt',
        inputSchema: z.object({
          customerId: customerIdSchema,
          text: z.string().min(1).max(6000),
          direction: z
            .enum(['en_to_ar', 'ar_to_en'])
            .describe('Source and target language.'),
          market: marketSchema,
          mode: z
            .enum(['cultural', 'literal'])
            .default('cultural')
            .describe(
              'cultural (default) rewrites so it reads native; literal stays faithful and is only for legal or quoted text.'
            ),
          preserve: z
            .array(z.string().max(120))
            .max(30)
            .optional()
            .describe('Strings that must survive unchanged: names, prices, disclaimers.'),
        }),
        outputSchema: adaptationSchema,
        handler: async (input, ctx) => {
          const model = await groundedModelFor(
            deps,
            ctx,
            LOCALIZATION_INSTRUCTIONS,
            input.customerId
          );
          const targetLanguage = input.direction === 'en_to_ar' ? 'Arabic' : 'English';
          const text = await model.generate({
            prompt: [
              `Adapt the following into ${targetLanguage} for the ${input.market} market.`,
              `Market context: ${marketNote(input.market)}`,
              input.mode === 'literal'
                ? 'Mode: LITERAL. Stay faithful to the source. Still fix grammar and flow.'
                : 'Mode: CULTURAL. Rewrite so it reads as though written for this market. Do not translate word for word.',
              input.preserve?.length
                ? `Preserve exactly: ${input.preserve.join(' | ')}`
                : '',
              '',
              'SOURCE:',
              input.text,
              '',
              'Return JSON only:',
              '{"text":"...","changes":[{"from":"...","to":"...","reason":"..."}],"literalWouldHaveBeen":"only when mode is cultural and a literal version would read wrong"}',
            ]
              .filter(Boolean)
              .join('\n'),
            temperature: input.mode === 'literal' ? 0.2 : 0.7,
          });

          const parsed = parseJsonBlock<{
            text?: string;
            changes?: Array<Record<string, string>>;
            literalWouldHaveBeen?: string;
          }>(text, {});

          return {
            text: String(parsed.text ?? ''),
            mode: input.mode,
            changes: (parsed.changes ?? []).slice(0, 25).map((c) => ({
              from: String(c.from ?? ''),
              to: String(c.to ?? ''),
              reason: String(c.reason ?? ''),
            })),
            literalWouldHaveBeen: parsed.literalWouldHaveBeen
              ? String(parsed.literalWouldHaveBeen)
              : undefined,
          };
        },
      }),

      defineTool({
        id: 'compareMarketVariants',
        title: 'Compare UAE and Saudi variants',
        description:
          'Produce one variant per requested market from the same source, and explain how they differ.',
        category: 'generate',
        sensitive: false,
        capability: 'localization.adapt',
        inputSchema: z.object({
          customerId: customerIdSchema,
          text: z.string().min(1).max(4000),
          language: z.enum(['ar', 'en']).default('ar'),
          markets: z.array(marketSchema).min(2).max(4).default(['AE', 'SA']),
        }),
        outputSchema: z.object({
          variants: z.array(
            z.object({
              market: marketSchema,
              text: z.string(),
              whyItDiffers: z.string(),
            })
          ),
        }),
        handler: async (input, ctx) => {
          const model = await groundedModelFor(
            deps,
            ctx,
            LOCALIZATION_INSTRUCTIONS,
            input.customerId
          );
          const text = await model.generate({
            prompt: [
              `Produce one ${input.language === 'ar' ? 'Arabic' : 'English'} variant per market: ${input.markets.join(', ')}.`,
              ...input.markets.map((m) => `${m}: ${marketNote(m)}`),
              'The variants must differ in register and reference, not only in vocabulary.',
              '',
              'SOURCE:',
              input.text,
              '',
              'Return JSON only: {"variants":[{"market":"AE","text":"...","whyItDiffers":"..."}]}',
            ].join('\n'),
            temperature: 0.75,
          });

          const parsed = parseJsonBlock<{ variants?: Array<Record<string, string>> }>(text, {});
          const allowed = new Set<string>(input.markets);
          return {
            variants: (parsed.variants ?? [])
              .filter((v) => allowed.has(String(v.market)))
              .map((v) => ({
                market: String(v.market) as any,
                text: String(v.text ?? ''),
                whyItDiffers: String(v.whyItDiffers ?? ''),
              })),
          };
        },
      }),

      defineTool({
        id: 'explainAdaptation',
        title: 'Explain an adaptation choice',
        description:
          'Explain, line by line, why a culturally adapted version was chosen over a literal translation.',
        category: 'generate',
        sensitive: false,
        capability: 'localization.adapt',
        inputSchema: z.object({
          customerId: customerIdSchema,
          source: z.string().min(1).max(4000),
          adapted: z.string().min(1).max(4000),
          market: marketSchema,
        }),
        outputSchema: z.object({
          summary: z.string(),
          points: z.array(
            z.object({ observation: z.string(), reason: z.string() })
          ),
        }),
        handler: async (input, ctx) => {
          const model = await groundedModelFor(
            deps,
            ctx,
            LOCALIZATION_INSTRUCTIONS,
            input.customerId
          );
          const text = await model.generate({
            prompt: [
              `Explain the adaptation for the ${input.market} market.`,
              `Market context: ${marketNote(input.market)}`,
              '',
              'SOURCE:',
              input.source,
              '',
              'ADAPTED:',
              input.adapted,
              '',
              'Return JSON only: {"summary":"...","points":[{"observation":"...","reason":"..."}]}',
            ].join('\n'),
            temperature: 0.4,
          });
          const parsed = parseJsonBlock<{
            summary?: string;
            points?: Array<Record<string, string>>;
          }>(text, {});
          return {
            summary: String(parsed.summary ?? ''),
            points: (parsed.points ?? []).slice(0, 20).map((p) => ({
              observation: String(p.observation ?? ''),
              reason: String(p.reason ?? ''),
            })),
          };
        },
      }),
    ],
  };
}
