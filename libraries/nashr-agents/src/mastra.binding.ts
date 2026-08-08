/**
 * Mastra binding.
 *
 * Converts registry entries into Mastra agents, following the conventions
 * already in `libraries/nestjs-libraries/src/chat/` (createTool with an
 * `mcp.annotations` block, `Agent` with `@ai-sdk/openai` and a `Memory` backed
 * by the shared `pStore`). Nashr does not introduce a second agent framework.
 *
 * The important property of this file: **every** Mastra tool it produces routes
 * through `GuardrailRuntime.execute`. There is no branch that calls a handler
 * directly, so a tool cannot exist in a Nashr agent without the guardrails.
 *
 * Tenancy comes from Mastra's `requestContext`, exactly as upstream's tools do
 * (`chat/auth.context.ts`), and is treated as the sole source of truth: a
 * caller-supplied organisation id in the tool arguments is rejected by
 * `assertOrgScope`, not merged.
 */
import { z } from 'zod';
import { Agent } from '@mastra/core/agent';
import { createTool } from '@mastra/core/tools';
import { Memory } from '@mastra/memory';
import { openai } from '@ai-sdk/openai';
import { pStore } from '@gitroom/nestjs-libraries/chat/mastra.store';
import type { AgentDefinition, NashrToolDefinition } from './types';
import type { AgentRegistry } from './registry';
import type { NashrAgentRuntime, TurnRequest } from './runtime';
import { GUARDRAIL_PREAMBLE } from './grounding';

/** Values the controller places on Mastra's requestContext. */
export const NASHR_CONTEXT_KEYS = {
  organization: 'organization',
  userOrgId: 'nashrUserOrgId',
  userId: 'nashrUserId',
  locale: 'nashrLocale',
  market: 'nashrMarket',
  requestId: 'nashrRequestId',
} as const;

interface RequestContextLike {
  get(key: string): unknown;
}

function readContext(context: unknown, key: string): string | undefined {
  const rc = (context as { requestContext?: RequestContextLike } | undefined)?.requestContext;
  if (!rc || typeof rc.get !== 'function') return undefined;
  const value = rc.get(key);
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

/**
 * Resolve the turn request from Mastra's request context.
 *
 * Upstream stores the whole organisation as a JSON string under
 * `organization`; we accept either that or a bare id so this works from the
 * CopilotKit bridge and from a direct HTTP invocation.
 */
export function resolveTurnRequest(context: unknown): TurnRequest {
  const rawOrg = readContext(context, NASHR_CONTEXT_KEYS.organization);
  let organizationId = '';
  if (rawOrg) {
    if (rawOrg.trim().startsWith('{')) {
      try {
        const parsed = JSON.parse(rawOrg) as { id?: unknown };
        organizationId = typeof parsed.id === 'string' ? parsed.id : '';
      } catch {
        organizationId = '';
      }
    } else {
      organizationId = rawOrg;
    }
  }

  const locale = readContext(context, NASHR_CONTEXT_KEYS.locale);
  const market = readContext(context, NASHR_CONTEXT_KEYS.market);

  return {
    organizationId,
    userOrgId: readContext(context, NASHR_CONTEXT_KEYS.userOrgId),
    userId: readContext(context, NASHR_CONTEXT_KEYS.userId),
    locale: locale === 'ar' ? 'ar' : 'en',
    market: (market && /^(AE|SA|KW|QA|BH|OM|EG|JO)$/.test(market)
      ? market
      : 'AE') as TurnRequest['market'],
    requestId: readContext(context, NASHR_CONTEXT_KEYS.requestId) ?? 'unknown',
  };
}

const confirmationField = {
  confirmationToken: z
    .string()
    .optional()
    .describe(
      'Opaque confirmation issued after a person approved this exact action. You never generate this value; it is supplied by the application.'
    ),
};

/**
 * Build the schema Mastra advertises to the model: the tool's own schema plus
 * an optional confirmation field for sensitive tools.
 */
function toMastraInputSchema(tool: NashrToolDefinition) {
  const schema = tool.inputSchema;
  if (!tool.sensitive) return schema;
  if (schema instanceof z.ZodObject) {
    return schema.extend(confirmationField);
  }
  return z.object({ ...confirmationField, input: schema });
}

/** Result envelope handed back to the model. Always a discriminated union. */
const guardedResultSchema = z.object({
  status: z.enum(['ok', 'awaiting_approval', 'error']),
  data: z.unknown().optional(),
  proposal: z.unknown().optional(),
  error: z.object({ code: z.string(), message: z.string() }).optional(),
});

export function toMastraTool(
  runtime: NashrAgentRuntime,
  agentKey: string,
  tool: NashrToolDefinition
) {
  const readOnly = tool.category === 'read';
  return createTool({
    id: tool.id,
    description: [
      tool.description,
      tool.sensitive
        ? 'This action is sensitive: calling it returns a proposal for a person to approve. It does not perform the action.'
        : '',
    ]
      .filter(Boolean)
      .join(' '),
    inputSchema: toMastraInputSchema(tool),
    outputSchema: guardedResultSchema,
    mcp: {
      annotations: {
        title: tool.title,
        readOnlyHint: readOnly,
        destructiveHint: tool.category === 'delete',
        idempotentHint: tool.idempotent ?? readOnly,
        openWorldHint: false,
      },
    },
    execute: async (inputData: unknown, context: unknown) => {
      const request = resolveTurnRequest(context);
      const result = await runtime.invokeOnAgent(agentKey, tool.id, inputData, request);
      // Normalised so the model always sees the same envelope shape.
      if (result.status === 'ok') return { status: 'ok' as const, data: result.data };
      if (result.status === 'awaiting_approval') {
        return { status: 'awaiting_approval' as const, proposal: result.proposal };
      }
      return { status: 'error' as const, error: result.error };
    },
  });
}

function resolveModelId(definition: AgentDefinition): string {
  if (definition.modelTier === 'fast') {
    return process.env.NASHR_AGENT_MODEL_FAST || process.env.NASHR_AGENT_MODEL || 'gpt-5.2';
  }
  return process.env.NASHR_AGENT_MODEL || 'gpt-5.2';
}

export function toMastraAgent(runtime: NashrAgentRuntime, definition: AgentDefinition): Agent {
  const tools = definition.tools.reduce<Record<string, ReturnType<typeof createTool>>>(
    (all, tool) => {
      all[tool.id] = toMastraTool(runtime, definition.key, tool);
      return all;
    },
    {}
  );

  return new Agent({
    id: definition.key,
    name: definition.name,
    description: definition.description,
    instructions: [
      GUARDRAIL_PREAMBLE,
      '',
      definition.instructions,
      '',
      'Brand facts and prohibited claims are applied inside the tools; do not restate them from memory and do not assume them when a tool has not returned them.',
    ].join('\n'),
    model: openai(resolveModelId(definition)),
    tools,
    memory: new Memory({ storage: pStore }),
  });
}

/** All Nashr agents, keyed by agent key — ready for `new Mastra({ agents })`. */
export function toMastraAgents(
  runtime: NashrAgentRuntime,
  registry: AgentRegistry
): Record<string, Agent> {
  return registry.list().reduce<Record<string, Agent>>((all, definition) => {
    all[definition.key] = toMastraAgent(runtime, definition);
    return all;
  }, {});
}
