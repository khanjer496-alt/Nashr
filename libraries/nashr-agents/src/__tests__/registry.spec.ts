import { z } from 'zod';
import { AgentRegistry, AgentRegistrationError, validateAgentDefinition } from '../registry';
import type { AgentDefinition, NashrToolDefinition } from '../types';
import { buildNashrAgentRegistry, buildNashrAgents } from '../agents';
import { makePorts } from './test.harness';

const baseTool = (over: Partial<NashrToolDefinition> = {}): NashrToolDefinition => ({
  id: 'doThing',
  title: 'Do thing',
  description: 'Does a thing.',
  category: 'read',
  sensitive: false,
  capability: 'brand.read',
  inputSchema: z.object({}),
  outputSchema: z.object({}),
  handler: async () => ({}),
  ...over,
});

const baseAgent = (over: Partial<AgentDefinition> = {}): AgentDefinition => ({
  key: 'nashrExample',
  name: 'Example',
  description: 'An example agent.',
  capabilities: ['brand.read'],
  instructions: 'Be useful.',
  tools: [baseTool()],
  ...over,
});

describe('registry validation', () => {
  it('accepts a well-formed agent', () => {
    expect(() => validateAgentDefinition(baseAgent())).not.toThrow();
  });

  it.each(['write', 'publish', 'delete', 'message', 'schedule', 'campaign'] as const)(
    'refuses a "%s" tool that is not declared sensitive',
    (category) => {
      expect(() =>
        validateAgentDefinition(
          baseAgent({
            capabilities: ['brand.read', 'brand.write'],
            tools: [baseTool({ category, sensitive: false, capability: 'brand.write' })],
          })
        )
      ).toThrow(/must be declared sensitive/);
    }
  );

  it('refuses a sensitive tool with no proposal description', () => {
    expect(() =>
      validateAgentDefinition(
        baseAgent({
          capabilities: ['brand.read', 'brand.write'],
          tools: [baseTool({ category: 'write', sensitive: true, capability: 'brand.write' })],
        })
      )
    ).toThrow(/describeProposal/);
  });

  it('refuses a tool whose capability the agent did not declare', () => {
    expect(() =>
      validateAgentDefinition(baseAgent({ tools: [baseTool({ capability: 'analytics.read' })] }))
    ).toThrow(/does not declare/);
  });

  it.each(['runShell', 'execCommand', 'evalCode', 'fetchUrl', 'rawSqlQuery'])(
    'refuses a tool named %s',
    (id) => {
      expect(() => validateAgentDefinition(baseAgent({ tools: [baseTool({ id })] }))).toThrow(
        AgentRegistrationError
      );
    }
  );

  it('refuses an agent key outside the nashr namespace', () => {
    expect(() => validateAgentDefinition(baseAgent({ key: 'randomAgent' }))).toThrow(/nashr/);
  });

  it('refuses a tool with no Zod schemas', () => {
    expect(() =>
      validateAgentDefinition(
        baseAgent({ tools: [baseTool({ inputSchema: undefined as never })] })
      )
    ).toThrow(/Zod input schema/);
  });

  it('refuses duplicate tool ids across agents', () => {
    const registry = new AgentRegistry([baseAgent()]);
    expect(() => registry.register(baseAgent({ key: 'nashrOther' }))).toThrow(
      /already registered/
    );
  });
});

describe('the six Nashr agents', () => {
  const registry = buildNashrAgentRegistry({ ports: makePorts() });

  it('all register and validate', () => {
    expect(registry.list().map((a) => a.key).sort()).toEqual([
      'nashrAnalyticsSummary',
      'nashrApproval',
      'nashrBrandProfile',
      'nashrCampaignCalendar',
      'nashrContent',
      'nashrLocalization',
    ]);
  });

  it('marks every write / publish / delete / schedule / campaign tool sensitive', () => {
    const offenders = registry
      .list()
      .flatMap((a) => a.tools)
      .filter(
        (t) =>
          ['write', 'publish', 'delete', 'message', 'schedule', 'campaign'].includes(t.category) &&
          !t.sensitive
      );
    expect(offenders).toEqual([]);
  });

  it('exposes no read tool that is marked sensitive by accident', () => {
    const sensitiveReads = registry
      .list()
      .flatMap((a) => a.tools)
      .filter((t) => t.category === 'read' && t.sensitive);
    expect(sensitiveReads).toEqual([]);
  });

  it('gives every sensitive tool a human-readable proposal', () => {
    const sensitive = registry.list().flatMap((a) => a.tools).filter((t) => t.sensitive);
    expect(sensitive.length).toBeGreaterThan(0);
    for (const tool of sensitive) {
      expect(typeof tool.describeProposal).toBe('function');
    }
  });

  it('the approval agent has no tool that can approve by itself', () => {
    const approval = registry.get('nashrApproval');
    const ids = approval.tools.map((t) => t.id);
    expect(ids).not.toContain('approve');
    expect(ids).not.toContain('approvePost');
    // The one decision-recording tool is sensitive, i.e. itself human-gated.
    const recorder = approval.tools.find((t) => t.id === 'recordHumanDecision');
    expect(recorder?.sensitive).toBe(true);
  });

  it('the calendar agent cannot schedule without approval', () => {
    const calendar = registry.get('nashrCampaignCalendar');
    expect(calendar.tools.find((t) => t.id === 'proposeCalendar')?.sensitive).toBe(false);
    expect(calendar.tools.find((t) => t.id === 'scheduleCalendar')?.sensitive).toBe(true);
    expect(calendar.tools.find((t) => t.id === 'changeCampaign')?.sensitive).toBe(true);
  });

  it('publishes a manifest that states approval requirements', () => {
    const manifest = registry.manifest();
    const brand = manifest.find((a) => a.key === 'nashrBrandProfile');
    const save = brand?.tools.find((t) => t.id === 'saveBrandProfile');
    expect(save?.requiresHumanApproval).toBe(true);
  });

  it('adding an agent is a data entry — the factory list drives everything', () => {
    const agents = buildNashrAgents({ ports: makePorts() });
    expect(agents).toHaveLength(6);
    expect(agents.every((a) => a.tools.length > 0)).toBe(true);
  });
});
