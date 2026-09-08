/**
 * Campaign Calendar agent.
 *
 * Builds weekly and monthly plans. It **proposes and never schedules**:
 * `proposeCalendar` is read-only and returns a plan object; putting anything on
 * the real calendar goes through `scheduleCalendar`, which is category
 * `schedule` and therefore sensitive by registry rule — a person approves it.
 *
 * Hijri awareness comes from `HijriPort`. Lunar observances are returned with
 * `approximate: true` because Ramadan and both Eids are announced by moon
 * sighting; the agent is instructed to present them as expected, not fixed.
 *
 * The MENA working week is Monday–Friday with a Friday–Saturday weekend in most
 * of the Gulf, so the planner treats Friday as a low-intent morning and Sunday
 * as the start of the business week for AE/SA/KW/QA/BH/EG/JO.
 */
import { z } from 'zod';
import type { AgentDefinition } from '../types';
import { marketNote } from '../grounding';
import { invalidInput } from '../errors';
import {
  AgentFactoryDeps,
  customerIdSchema,
  defineTool,
  detail,
  groundedModelFor,
  loadGrounding,
  marketSchema,
  parseJsonBlock,
} from './agent.helpers';

const CALENDAR_INSTRUCTIONS = `
You plan social media calendars for businesses and creators worldwide.

- You never put anything on the real calendar. You produce a plan; a person
  reviews it and approves scheduling separately. Say this plainly.
- Choose observances that are relevant to the brand's target audience. When
  Ramadan, Eid al-Fitr or Eid al-Adha are relevant, their dates depend on moon
  sighting, so any date you are given for them is expected, not confirmed.
  Always say so.
- For audiences observing Ramadan, consider suhoor and iftar windows, late
  evening activity, shorter working days, and appropriate messaging during
  fasting hours.
- Base working days and posting times on the brand's market and timezone.
  Ask for missing audience preferences instead of assuming a regional weekend.
- Do not invent an offer, a price or an opening time. If a slot needs one, mark
  it as needing input from the business.
`.trim();

const plannedItem = z.object({
  date: z.string(),
  timeLocal: z.string(),
  titleEn: z.string(),
  titleAr: z.string(),
  format: z.string(),
  pillar: z.string(),
  rationale: z.string(),
  tiedToObservance: z.string().nullable(),
  needsInputFromBusiness: z.boolean(),
});

const observanceSchema = z.object({
  key: z.string(),
  nameEn: z.string(),
  nameAr: z.string(),
  date: z.string(),
  approximate: z.boolean(),
  note: z.string(),
});

function addDays(date: Date, days: number): Date {
  const d = new Date(date.getTime());
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function parseIsoDate(value: string | undefined, fallback: Date): Date {
  if (!value) return fallback;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    throw invalidInput('startDate must be an ISO date, e.g. 2026-09-01');
  }
  return parsed;
}

export function createCampaignCalendarAgent(deps: AgentFactoryDeps): AgentDefinition {
  const { ports } = deps;

  return {
    key: 'nashrCampaignCalendar',
    name: 'Campaign Calendar',
    nameAr: 'روزنامة الحملات',
    description:
      'Proposes weekly and monthly content calendars, Hijri-aware for Ramadan and Eid. Proposes only — scheduling requires human approval.',
    capabilities: ['calendar.propose', 'calendar.schedule', 'brand.read'],
    instructions: CALENDAR_INSTRUCTIONS,
    tools: [
      defineTool({
        id: 'listMenaObservances',
        title: 'List MENA observances',
        description:
          'List Islamic and national observances in a date range for a market, flagging which dates are moon-dependent.',
        category: 'read',
        sensitive: false,
        capability: 'calendar.propose',
        inputSchema: z.object({
          market: marketSchema,
          startDate: z.string().max(10).optional(),
          days: z.number().int().min(7).max(400).default(90),
        }),
        outputSchema: z.object({
          from: z.string(),
          to: z.string(),
          hijriToday: z.object({ year: z.number(), month: z.number(), day: z.number() }),
          observances: z.array(observanceSchema),
        }),
        handler: async (input, ctx) => {
          const from = parseIsoDate(input.startDate, ctx.now);
          const to = addDays(from, input.days);
          const observances = ports.hijri.observancesBetween(from, to, input.market);
          return {
            from: from.toISOString().slice(0, 10),
            to: to.toISOString().slice(0, 10),
            hijriToday: ports.hijri.toHijri(ctx.now),
            observances: observances.map((o) => ({
              key: o.key,
              nameEn: o.nameEn,
              nameAr: o.nameAr,
              date: o.date,
              approximate: o.approximate,
              note: o.approximate
                ? 'Expected date. Confirmed locally by moon sighting and can move by a day.'
                : 'Fixed calendar date.',
            })),
          };
        },
      }),

      defineTool({
        id: 'proposeCalendar',
        title: 'Propose a content calendar',
        description:
          'Build a weekly or monthly content plan. Read-only: nothing is scheduled and no post is created.',
        category: 'read',
        sensitive: false,
        capability: 'calendar.propose',
        inputSchema: z.object({
          customerId: customerIdSchema,
          period: z.enum(['week', 'month']).default('week'),
          startDate: z.string().max(10).optional(),
          postsPerWeek: z.number().int().min(1).max(21).default(5),
          market: marketSchema.optional(),
          focus: z.string().max(400).optional(),
        }),
        outputSchema: z.object({
          period: z.enum(['week', 'month']),
          from: z.string(),
          to: z.string(),
          timezone: z.string(),
          observances: z.array(observanceSchema),
          items: z.array(plannedItem),
          isProposalOnly: z.literal(true),
          nextStep: z.string(),
        }),
        handler: async (input, ctx) => {
          const grounding = await loadGrounding(ports, ctx, input.customerId);
          const market = input.market ?? grounding?.market ?? ctx.market;
          const timezone = grounding?.timezone ?? 'Asia/Dubai';
          const from = parseIsoDate(input.startDate, ctx.now);
          const days = input.period === 'week' ? 7 : 30;
          const to = addDays(from, days - 1);

          const observances = ports.hijri.observancesBetween(from, to, market).map((o) => ({
            key: o.key,
            nameEn: o.nameEn,
            nameAr: o.nameAr,
            date: o.date,
            approximate: o.approximate,
            note: o.approximate
              ? 'Expected date. Confirmed locally by moon sighting and can move by a day.'
              : 'Fixed calendar date.',
          }));

          const model = await groundedModelFor(
            deps,
            ctx,
            CALENDAR_INSTRUCTIONS,
            input.customerId
          );
          const totalPosts =
            input.period === 'week' ? input.postsPerWeek : Math.round(input.postsPerWeek * 4.3);

          const text = await model.generate({
            prompt: [
              `Plan ${totalPosts} posts from ${from.toISOString().slice(0, 10)} to ${to.toISOString().slice(0, 10)}.`,
              `Market: ${market}. ${marketNote(market)}`,
              `Timezone for all times: ${timezone}.`,
              input.focus ? `Focus: ${input.focus}` : '',
              observances.length
                ? `Observances in range (dates marked approximate are moon-dependent):\n${observances
                    .map((o) => `- ${o.date} ${o.nameEn}${o.approximate ? ' (expected)' : ''}`)
                    .join('\n')}`
                : 'No major observances fall in this range.',
              'Spread across content pillars. Mark needsInputFromBusiness true for any slot that would need a price, offer or opening time you were not given.',
              'Return JSON only: {"items":[{"date":"YYYY-MM-DD","timeLocal":"HH:mm","titleEn":"...","titleAr":"...","format":"...","pillar":"...","rationale":"...","tiedToObservance":null,"needsInputFromBusiness":false}]}',
            ]
              .filter(Boolean)
              .join('\n'),
            temperature: 0.7,
            maxOutputTokens: 2000,
          });

          const parsed = parseJsonBlock<{ items?: Array<Record<string, unknown>> }>(text, {});
          const items = (parsed.items ?? []).slice(0, totalPosts).map((i) => ({
            date: String(i.date ?? ''),
            timeLocal: String(i.timeLocal ?? ''),
            titleEn: String(i.titleEn ?? ''),
            titleAr: String(i.titleAr ?? ''),
            format: String(i.format ?? ''),
            pillar: String(i.pillar ?? ''),
            rationale: String(i.rationale ?? ''),
            tiedToObservance: i.tiedToObservance ? String(i.tiedToObservance) : null,
            needsInputFromBusiness: Boolean(i.needsInputFromBusiness),
          }));

          return {
            period: input.period,
            from: from.toISOString().slice(0, 10),
            to: to.toISOString().slice(0, 10),
            timezone,
            observances,
            items,
            isProposalOnly: true as const,
            nextStep:
              'Nothing has been scheduled. Turn items into drafts, then use scheduleCalendar — which a person must approve.',
          };
        },
      }),

      defineTool({
        id: 'scheduleCalendar',
        title: 'Schedule approved drafts',
        description:
          'Move existing drafts onto the publishing calendar. Requires human approval before it runs.',
        category: 'schedule',
        sensitive: true,
        capability: 'calendar.schedule',
        inputSchema: z.object({
          postIds: z.array(z.string().min(1).max(64)).min(1).max(60),
          timezone: z.string().max(64).default('Asia/Dubai'),
        }),
        outputSchema: z.object({ scheduled: z.number() }),
        describeProposal: (input) => ({
          title: 'Schedule drafts',
          summary: `Move ${input.postIds.length} draft(s) onto the publishing calendar in ${input.timezone}.`,
          details: [
            detail('Drafts', input.postIds.length),
            detail('Timezone', input.timezone),
          ],
          effect:
            'These posts enter the publishing queue. They still pass the post approval workflow before anything goes live.',
          reversible: true,
        }),
        handler: async (input, ctx) =>
          ports.posts.scheduleDrafts(ctx.organizationId, input.postIds, input.timezone),
      }),

      defineTool({
        id: 'changeCampaign',
        title: 'Change a campaign',
        description:
          'Reschedule or retime an existing set of campaign posts. Requires human approval.',
        category: 'campaign',
        sensitive: true,
        capability: 'calendar.schedule',
        inputSchema: z.object({
          postIds: z.array(z.string().min(1).max(64)).min(1).max(60),
          timezone: z.string().max(64).default('Asia/Dubai'),
          reason: z.string().min(3).max(400),
        }),
        outputSchema: z.object({ scheduled: z.number() }),
        describeProposal: (input) => ({
          title: 'Change campaign timing',
          summary: `Re-time ${input.postIds.length} campaign post(s).`,
          details: [
            detail('Posts', input.postIds.length),
            detail('Timezone', input.timezone),
            detail('Reason', input.reason),
          ],
          effect: 'The affected posts move in the publishing queue.',
          reversible: true,
        }),
        handler: async (input, ctx) =>
          ports.posts.scheduleDrafts(ctx.organizationId, input.postIds, input.timezone),
      }),
    ],
  };
}
