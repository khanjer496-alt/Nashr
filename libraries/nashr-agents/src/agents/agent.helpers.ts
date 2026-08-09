/**
 * Shared plumbing for agent definitions.
 *
 * Agent files stay declarative: they describe tools and prompts. Anything that
 * could be got subtly wrong — loading the brand profile inside the tenant
 * boundary, allow-listing its fields, constructing the grounded model — lives
 * here and is written once.
 */
import { z } from 'zod';
import type { AgentPorts, BrandProfileRecord } from '../ports';
import type { NashrToolContext, NashrToolDefinition } from '../types';
import { GroundedModel, toBrandGrounding } from '../grounding';
import type { BrandGrounding } from '../grounding';
import type { TurnBudget } from '../guardrails';

export interface AgentFactoryDeps {
  ports: AgentPorts;
  /** Supplies the current turn's budget so model calls are charged against it. */
  resolveBudget?: (requestId: string) => TurnBudget | undefined;
}

/** Identity helper: keeps generics inferred while the object stays literal. */
export function defineTool<TIn, TOut>(
  tool: NashrToolDefinition<TIn, TOut>
): NashrToolDefinition<TIn, TOut> {
  return tool;
}

export const customerIdSchema = z
  .string()
  .min(1)
  .max(64)
  .optional()
  .describe('Optional brand/client (Customer) id to scope this call to.');

export const localeSchema = z
  .enum(['en', 'ar', 'both'])
  .default('both')
  .describe('Output language. "both" returns English and Arabic side by side.');

export const marketSchema = z
  .enum(['AE', 'SA', 'KW', 'QA', 'BH', 'OM', 'EG', 'JO'])
  .describe('Target market. Drives dialect, register and calendar.');

/**
 * Load the brand profile for the CALLER'S organisation only. `customerId` is a
 * filter inside that organisation, never a way out of it — the port takes
 * organizationId first and the adapter must apply it.
 */
export async function loadBrandProfile(
  ports: AgentPorts,
  ctx: NashrToolContext,
  customerId?: string | null
): Promise<BrandProfileRecord | null> {
  return ports.brand.findForOrganization(ctx.organizationId, customerId ?? null);
}

export async function loadGrounding(
  ports: AgentPorts,
  ctx: NashrToolContext,
  customerId?: string | null
): Promise<BrandGrounding | null> {
  return toBrandGrounding(await loadBrandProfile(ports, ctx, customerId));
}

/**
 * Build the only object an agent may use to talk to a model. Prohibited claims
 * are baked into the system prompt by `GroundedModel` — an agent cannot opt out.
 */
export async function groundedModelFor(
  deps: AgentFactoryDeps,
  ctx: NashrToolContext,
  agentInstructions: string,
  customerId?: string | null
): Promise<GroundedModel> {
  const grounding = await loadGrounding(deps.ports, ctx, customerId);
  return new GroundedModel(
    deps.ports.model,
    grounding,
    agentInstructions,
    ctx.locale,
    grounding?.market ?? ctx.market,
    ctx.now,
    deps.resolveBudget?.(ctx.requestId)
  );
}

/** Model output that should be JSON. Parsed defensively — a model that returns
 *  prose instead of JSON is a handled failure, not a crash. */
export function parseJsonBlock<T>(text: string, fallback: T): T {
  if (!text) return fallback;
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced ? fenced[1] : text).trim();
  const start = candidate.search(/[[{]/);
  if (start === -1) return fallback;
  try {
    return JSON.parse(candidate.slice(start)) as T;
  } catch {
    return fallback;
  }
}

/** Standard proposal detail row builder. */
export const detail = (label: string, value: unknown) => ({
  label,
  value: value === undefined || value === null || value === '' ? '(not set)' : String(value),
});
