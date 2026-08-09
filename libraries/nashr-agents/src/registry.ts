/**
 * Agent registry.
 *
 * Adding an agent is a data entry, not a code fork: write an
 * `AgentDefinition`, add it to `buildNashrAgents()`, done. The registry then
 * enforces the rules that make that safe — before anything is served, at
 * construction time, so a mistake is a boot failure rather than a production
 * incident.
 *
 * Validation performed on every registration:
 *   R1  agent keys are unique and namespaced
 *   R2  tool ids are unique across the whole registry (a Mastra agent exposes
 *       tools in a flat namespace)
 *   R3  every tool's capability is declared by its agent
 *   R4  every tool in an inherently sensitive category (write / publish /
 *       delete / message / schedule / campaign) has `sensitive: true`
 *   R5  every sensitive tool supplies `describeProposal`, so the human sees
 *       what they are approving
 *   R6  no tool id or description hints at shell, fetch, eval or raw SQL
 */
import type { AgentCapability, AgentDefinition, NashrToolDefinition } from './types';
import { INHERENTLY_SENSITIVE_CATEGORIES } from './types';

export class AgentRegistrationError extends Error {
  constructor(message: string) {
    super(`[nashr-agents] invalid agent registration: ${message}`);
    this.name = 'AgentRegistrationError';
  }
}

/**
 * Substrings that must never appear in a tool id. Tools are structured,
 * Zod-typed function calls; there is no shell, no arbitrary HTTP and no eval
 * anywhere in this library, and this check keeps that true as it grows.
 */
const FORBIDDEN_TOOL_TOKENS = [
  'shell',
  'bash',
  'exec',
  'spawn',
  'eval',
  'rawsql',
  'rawquery',
  'httprequest',
  'fetchurl',
  'curl',
];

export function validateAgentDefinition(def: AgentDefinition): void {
  if (!def.key || !/^nashr[A-Z][A-Za-z0-9]*$/.test(def.key)) {
    throw new AgentRegistrationError(
      `agent key "${def.key}" must be camelCase and start with "nashr" (e.g. nashrContent)`
    );
  }
  if (!def.capabilities?.length) {
    throw new AgentRegistrationError(`agent "${def.key}" declares no capabilities`);
  }
  if (!def.instructions?.trim()) {
    throw new AgentRegistrationError(`agent "${def.key}" has no instructions`);
  }
  if (!def.tools?.length) {
    throw new AgentRegistrationError(`agent "${def.key}" registers no tools`);
  }

  const declared = new Set<AgentCapability>(def.capabilities);
  const seenToolIds = new Set<string>();

  for (const tool of def.tools) {
    validateTool(def, tool, declared, seenToolIds);
  }
}

function validateTool(
  def: AgentDefinition,
  tool: NashrToolDefinition,
  declared: Set<AgentCapability>,
  seenToolIds: Set<string>
): void {
  const where = `${def.key}.${tool.id}`;

  if (!tool.id || !/^[a-z][A-Za-z0-9]*$/.test(tool.id)) {
    throw new AgentRegistrationError(`tool id "${tool.id}" must be camelCase (${def.key})`);
  }
  if (seenToolIds.has(tool.id)) {
    throw new AgentRegistrationError(`duplicate tool id "${tool.id}" in ${def.key}`);
  }
  seenToolIds.add(tool.id);

  const lowered = `${tool.id} ${tool.title} ${tool.description}`.toLowerCase().replace(/[\s_-]/g, '');
  for (const token of FORBIDDEN_TOOL_TOKENS) {
    if (lowered.includes(token)) {
      throw new AgentRegistrationError(
        `tool ${where} references "${token}"; agents have no shell, no arbitrary HTTP and no raw SQL`
      );
    }
  }

  if (!declared.has(tool.capability)) {
    throw new AgentRegistrationError(
      `tool ${where} needs capability "${tool.capability}" which ${def.key} does not declare`
    );
  }

  // R4 — the rule the brief calls "no exceptions, no bypass flag".
  if (INHERENTLY_SENSITIVE_CATEGORIES.includes(tool.category) && tool.sensitive !== true) {
    throw new AgentRegistrationError(
      `tool ${where} is category "${tool.category}" and must be declared sensitive: true`
    );
  }

  if (tool.sensitive && typeof tool.describeProposal !== 'function') {
    throw new AgentRegistrationError(
      `sensitive tool ${where} must supply describeProposal() so a human can see what they approve`
    );
  }

  if (!tool.inputSchema || typeof (tool.inputSchema as any).safeParse !== 'function') {
    throw new AgentRegistrationError(`tool ${where} has no Zod input schema`);
  }
  if (!tool.outputSchema || typeof (tool.outputSchema as any).safeParse !== 'function') {
    throw new AgentRegistrationError(`tool ${where} has no Zod output schema`);
  }
  if (typeof tool.handler !== 'function') {
    throw new AgentRegistrationError(`tool ${where} has no handler`);
  }
}

export interface RegisteredTool {
  agentKey: string;
  tool: NashrToolDefinition;
}

export class AgentRegistry {
  private readonly agents = new Map<string, AgentDefinition>();
  private readonly toolIndex = new Map<string, RegisteredTool>();

  constructor(definitions: AgentDefinition[] = []) {
    for (const def of definitions) this.register(def);
  }

  register(def: AgentDefinition): this {
    validateAgentDefinition(def);

    if (this.agents.has(def.key)) {
      throw new AgentRegistrationError(`agent key "${def.key}" is already registered`);
    }
    for (const tool of def.tools) {
      const existing = this.toolIndex.get(tool.id);
      if (existing) {
        throw new AgentRegistrationError(
          `tool id "${tool.id}" is already registered by agent "${existing.agentKey}"`
        );
      }
    }

    this.agents.set(def.key, def);
    for (const tool of def.tools) {
      this.toolIndex.set(tool.id, { agentKey: def.key, tool });
    }
    return this;
  }

  get(key: string): AgentDefinition {
    const found = this.agents.get(key);
    if (!found) throw new AgentRegistrationError(`unknown agent "${key}"`);
    return found;
  }

  has(key: string): boolean {
    return this.agents.has(key);
  }

  list(): AgentDefinition[] {
    return [...this.agents.values()];
  }

  tool(toolId: string): RegisteredTool {
    const found = this.toolIndex.get(toolId);
    if (!found) throw new AgentRegistrationError(`unknown tool "${toolId}"`);
    return found;
  }

  /** Machine-readable manifest — used by the controller's `GET /nashr-agents`
   *  so the UI and any reviewer can see exactly what each agent may do. */
  manifest() {
    return this.list().map((a) => ({
      key: a.key,
      name: a.name,
      nameAr: a.nameAr,
      description: a.description,
      capabilities: a.capabilities,
      tools: a.tools.map((t) => ({
        id: t.id,
        title: t.title,
        description: t.description,
        category: t.category,
        sensitive: t.sensitive,
        capability: t.capability,
        requiresHumanApproval: t.sensitive,
      })),
    }));
  }
}
