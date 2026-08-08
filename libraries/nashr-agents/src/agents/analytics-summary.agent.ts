/**
 * Analytics Summary agent.
 *
 * The hard requirement: **never fabricate metrics.** Only 11 of the 34 social
 * providers Postiz ships implement `analytics()`, so a workspace's connected
 * channels are usually a mix of measurable and unmeasurable. A summary that
 * quietly omits that is worse than no summary.
 *
 * How fabrication is prevented, structurally rather than by asking nicely:
 *
 *  - `summarizeWeek` computes its aggregates **in code** from what the port
 *    returned. The model is not involved in producing numbers; it only writes
 *    prose around a `figures` block the tool already computed.
 *  - Every response carries a `coverage` object naming the channels with no
 *    analytics support and the ones that returned nothing.
 *  - When there is no data at all, the tool returns `hasData: false` and an
 *    empty figures list. There is no code path that invents a placeholder.
 *  - The agent's instructions forbid stating any number not present in the tool
 *    output, and the tool output includes the exact list of numbers it may use.
 */
import { z } from 'zod';
import type { AgentDefinition } from '../types';
import type { ChannelAnalytics, ConnectedChannel } from '../ports';
import {
  AgentFactoryDeps,
  customerIdSchema,
  defineTool,
  groundedModelFor,
} from './agent.helpers';

const ANALYTICS_INSTRUCTIONS = `
You summarise social media performance for MENA businesses.

Absolute rules:
- You may only state numbers that appear in a tool result. If a figure is not
  there, say it is not available and name the reason.
- Several connected channels have no analytics API at all. When that is the
  case, say which channels are not measurable rather than leaving them out of
  the picture silently.
- Never estimate, extrapolate, benchmark against "typical" figures, or fill a
  gap with an industry average.
- No data is a finding. Report it as one.
- Percentage changes are only valid when both periods have real data.
`.trim();

const figureSchema = z.object({
  channel: z.string(),
  providerIdentifier: z.string(),
  metric: z.string(),
  total: z.number(),
  periodStart: z.string(),
  periodEnd: z.string(),
  percentageChange: z.number().nullable(),
});

const coverageSchema = z.object({
  channelsConnected: z.number(),
  channelsWithAnalyticsSupport: z.number(),
  channelsReportingData: z.number(),
  unsupportedChannels: z.array(
    z.object({ name: z.string(), providerIdentifier: z.string(), reason: z.string() })
  ),
  emptyChannels: z.array(
    z.object({ name: z.string(), providerIdentifier: z.string(), reason: z.string() })
  ),
  failedChannels: z.array(
    z.object({ name: z.string(), providerIdentifier: z.string(), reason: z.string() })
  ),
});

interface Collected {
  figures: Array<z.infer<typeof figureSchema>>;
  coverage: z.infer<typeof coverageSchema>;
}

/**
 * Pure aggregation over real port output. Exported for unit testing: this is
 * the function that guarantees a number in a summary came from a provider.
 */
export function collectFigures(
  channels: ConnectedChannel[],
  results: Array<{ channel: ConnectedChannel; data?: ChannelAnalytics; failed?: boolean }>,
  periodStart: string,
  periodEnd: string
): Collected {
  const figures: Collected['figures'] = [];
  const unsupportedChannels: Collected['coverage']['unsupportedChannels'] = [];
  const emptyChannels: Collected['coverage']['emptyChannels'] = [];
  const failedChannels: Collected['coverage']['failedChannels'] = [];
  const reporting = new Set<string>();

  for (const channel of channels) {
    if (!channel.supportsAnalytics) {
      unsupportedChannels.push({
        name: channel.name,
        providerIdentifier: channel.providerIdentifier,
        reason: 'This platform does not expose an analytics API to Nashr.',
      });
    }
  }

  for (const result of results) {
    const { channel } = result;
    if (result.failed) {
      failedChannels.push({
        name: channel.name,
        providerIdentifier: channel.providerIdentifier,
        reason: 'The platform did not return analytics for this period.',
      });
      continue;
    }
    const metrics = result.data?.metrics ?? [];
    const usable = metrics.filter((m) => (m.points ?? []).length > 0);
    if (usable.length === 0) {
      emptyChannels.push({
        name: channel.name,
        providerIdentifier: channel.providerIdentifier,
        reason: 'The platform returned no data points for this period.',
      });
      continue;
    }
    reporting.add(channel.integrationId);
    for (const metric of usable) {
      const total = metric.points.reduce(
        (sum, p) => sum + (Number.isFinite(p.total) ? p.total : 0),
        0
      );
      figures.push({
        channel: channel.name,
        providerIdentifier: channel.providerIdentifier,
        metric: metric.label,
        total,
        periodStart,
        periodEnd,
        percentageChange:
          typeof metric.percentageChange === 'number' ? metric.percentageChange : null,
      });
    }
  }

  return {
    figures,
    coverage: {
      channelsConnected: channels.length,
      channelsWithAnalyticsSupport: channels.filter((c) => c.supportsAnalytics).length,
      channelsReportingData: reporting.size,
      unsupportedChannels,
      emptyChannels,
      failedChannels,
    },
  };
}

export function createAnalyticsSummaryAgent(deps: AgentFactoryDeps): AgentDefinition {
  const { ports } = deps;

  const gather = async (
    organizationId: string,
    customerId: string | null | undefined,
    days: number,
    now: Date
  ) => {
    const channels = await ports.analytics.listChannels(organizationId, customerId ?? null);
    const measurable = channels.filter((c) => c.supportsAnalytics && !c.disabled);

    const results = await Promise.all(
      measurable.map(async (channel) => {
        try {
          const data = await ports.analytics.fetchChannelAnalytics(
            organizationId,
            channel.integrationId,
            days
          );
          return { channel, data };
        } catch {
          // Provider errors never propagate; a failed channel becomes a stated
          // coverage gap instead of a missing row or an invented number.
          return { channel, failed: true };
        }
      })
    );

    const periodEnd = now.toISOString().slice(0, 10);
    const periodStart = new Date(now.getTime() - days * 86_400_000)
      .toISOString()
      .slice(0, 10);

    return { channels, ...collectFigures(channels, results, periodStart, periodEnd) };
  };

  return {
    key: 'nashrAnalyticsSummary',
    name: 'Analytics Summary',
    nameAr: 'ملخص التحليلات',
    description:
      'Summarises performance from the channels that actually report analytics, and states coverage gaps rather than filling them in.',
    capabilities: ['analytics.read', 'brand.read'],
    instructions: ANALYTICS_INSTRUCTIONS,
    tools: [
      defineTool({
        id: 'getAnalyticsCoverage',
        title: 'Get analytics coverage',
        description:
          'List connected channels and say which of them can report analytics at all.',
        category: 'read',
        sensitive: false,
        capability: 'analytics.read',
        inputSchema: z.object({ customerId: customerIdSchema }),
        outputSchema: z.object({
          channels: z.array(
            z.object({
              name: z.string(),
              providerIdentifier: z.string(),
              supportsAnalytics: z.boolean(),
            })
          ),
          supportedCount: z.number(),
          unsupportedCount: z.number(),
        }),
        handler: async (input, ctx) => {
          const channels = await ports.analytics.listChannels(
            ctx.organizationId,
            input.customerId ?? null
          );
          return {
            channels: channels.map((c) => ({
              name: c.name,
              providerIdentifier: c.providerIdentifier,
              supportsAnalytics: c.supportsAnalytics,
            })),
            supportedCount: channels.filter((c) => c.supportsAnalytics).length,
            unsupportedCount: channels.filter((c) => !c.supportsAnalytics).length,
          };
        },
      }),

      defineTool({
        id: 'getChannelMetrics',
        title: 'Get channel metrics',
        description:
          'Fetch real metrics for the period, with an explicit list of channels that could not be measured.',
        category: 'read',
        sensitive: false,
        capability: 'analytics.read',
        inputSchema: z.object({
          customerId: customerIdSchema,
          days: z.number().int().min(1).max(90).default(7),
        }),
        outputSchema: z.object({
          hasData: z.boolean(),
          figures: z.array(figureSchema),
          coverage: coverageSchema,
        }),
        handler: async (input, ctx) => {
          const { figures, coverage } = await gather(
            ctx.organizationId,
            input.customerId,
            input.days,
            ctx.now
          );
          return { hasData: figures.length > 0, figures, coverage };
        },
      }),

      defineTool({
        id: 'summarizeWeek',
        title: 'Summarise the week',
        description:
          'Write a weekly summary using only the figures the platforms returned, and state what could not be measured.',
        category: 'generate',
        sensitive: false,
        capability: 'analytics.read',
        inputSchema: z.object({
          customerId: customerIdSchema,
          days: z.number().int().min(1).max(31).default(7),
        }),
        outputSchema: z.object({
          hasData: z.boolean(),
          /** The ONLY numbers that may appear in `summary`. */
          figures: z.array(figureSchema),
          coverage: coverageSchema,
          summary: z.string(),
          caveats: z.array(z.string()),
        }),
        handler: async (input, ctx) => {
          const { figures, coverage } = await gather(
            ctx.organizationId,
            input.customerId,
            input.days,
            ctx.now
          );

          const caveats: string[] = [];
          if (coverage.unsupportedChannels.length) {
            caveats.push(
              `No analytics are available for ${coverage.unsupportedChannels
                .map((c) => c.name)
                .join(', ')} — the platform does not expose them.`
            );
          }
          if (coverage.emptyChannels.length) {
            caveats.push(
              `${coverage.emptyChannels.map((c) => c.name).join(', ')} returned no data for this period.`
            );
          }
          if (coverage.failedChannels.length) {
            caveats.push(
              `${coverage.failedChannels.map((c) => c.name).join(', ')} could not be reached for this period.`
            );
          }

          // No data → no prose. The model is never asked to write around a void.
          if (figures.length === 0) {
            return {
              hasData: false,
              figures,
              coverage,
              summary:
                'There is no performance data for this period. Nothing can be reported. See the caveats for why each channel is missing.',
              caveats,
            };
          }

          const model = await groundedModelFor(
            deps,
            ctx,
            ANALYTICS_INSTRUCTIONS,
            input.customerId
          );
          const summary = await model.generate({
            prompt: [
              `Write a short weekly performance summary for the last ${input.days} days.`,
              '',
              'These are the ONLY figures that exist. Do not state any other number:',
              ...figures.map(
                (f) =>
                  `- ${f.channel} (${f.providerIdentifier}) ${f.metric}: ${f.total}${
                    f.percentageChange !== null ? ` (change ${f.percentageChange}%)` : ''
                  } for ${f.periodStart}..${f.periodEnd}`
              ),
              '',
              'Coverage gaps you must mention:',
              ...(caveats.length ? caveats.map((c) => `- ${c}`) : ['- none']),
              '',
              'Four to six sentences. Plain prose, no headings, no invented comparisons.',
            ].join('\n'),
            temperature: 0.3,
            maxOutputTokens: 700,
          });

          return { hasData: true, figures, coverage, summary, caveats };
        },
      }),
    ],
  };
}
