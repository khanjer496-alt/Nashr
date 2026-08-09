/**
 * The Nashr agent set.
 *
 * ADDING AN AGENT: write `agents/<name>.agent.ts` exporting a factory that
 * returns an `AgentDefinition`, then add one line to `buildNashrAgents()`.
 * `AgentRegistry` validates the result at construction time — see
 * `registry.ts` for the rules it enforces and README.md for the checklist.
 */
import type { AgentDefinition } from '../types';
import { AgentRegistry } from '../registry';
import type { AgentFactoryDeps } from './agent.helpers';
import { createBrandProfileAgent } from './brand-profile.agent';
import { createContentAgent } from './content.agent';
import { createLocalizationAgent } from './localization.agent';
import { createCampaignCalendarAgent } from './campaign-calendar.agent';
import { createApprovalAgent } from './approval.agent';
import { createAnalyticsSummaryAgent } from './analytics-summary.agent';

export type AgentFactory = (deps: AgentFactoryDeps) => AgentDefinition;

/** The registration list. One entry per agent — nothing else to touch. */
export const NASHR_AGENT_FACTORIES: AgentFactory[] = [
  createBrandProfileAgent,
  createContentAgent,
  createLocalizationAgent,
  createCampaignCalendarAgent,
  createApprovalAgent,
  createAnalyticsSummaryAgent,
];

export function buildNashrAgents(deps: AgentFactoryDeps): AgentDefinition[] {
  return NASHR_AGENT_FACTORIES.map((factory) => factory(deps));
}

/** Build and validate. Throws `AgentRegistrationError` on any rule violation. */
export function buildNashrAgentRegistry(deps: AgentFactoryDeps): AgentRegistry {
  return new AgentRegistry(buildNashrAgents(deps));
}

export {
  createBrandProfileAgent,
  createContentAgent,
  createLocalizationAgent,
  createCampaignCalendarAgent,
  createApprovalAgent,
  createAnalyticsSummaryAgent,
};
export { assertHumanActor } from './approval.agent';
export { collectFigures } from './analytics-summary.agent';
export * from './agent.helpers';
