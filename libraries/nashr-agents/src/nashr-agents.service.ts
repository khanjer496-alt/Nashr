/**
 * NestJS wiring.
 *
 * Assembles ports → agents → registry → guardrail runtime → Mastra agents, in
 * that order, once per process. Mirrors `LoadToolsService` / `MastraService`
 * in `libraries/nestjs-libraries/src/chat/` so the two runtimes look the same
 * to a maintainer.
 *
 * The Nashr agents are exposed as their own `Mastra` instance rather than
 * being merged into the upstream `postiz` agent. Upstream's agent can schedule
 * and publish directly; Nashr's cannot. Keeping them separate means an upstream
 * change can never accidentally grant a Nashr agent an ungated tool.
 */
import { Injectable, Logger } from '@nestjs/common';
import { assertLaunchFeature } from '@gitroom/nestjs-libraries/services/launch.policy';
import { Mastra } from '@mastra/core/mastra';
import { ConsoleLogger } from '@mastra/core/logger';
import { pStore } from '@gitroom/nestjs-libraries/chat/mastra.store';
import { PrismaService } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';
import { IntegrationService } from '@gitroom/nestjs-libraries/database/prisma/integrations/integration.service';
import { IntegrationManager } from '@gitroom/nestjs-libraries/integrations/integration.manager';
import { AuditLogger } from './audit';
import { GuardrailRuntime, NASHR_AGENT_LIMITS } from './guardrails';
import { NashrAgentRuntime } from './runtime';
import { InMemoryProposalStore } from './proposals';
import type { AgentPorts, ModelPort, ModelRequest, ModelResponse, ProposalStorePort } from './ports';
import { buildNashrAgentRegistry } from './agents';
import { AgentRegistry } from './registry';
import { toMastraAgents } from './mastra.binding';
import { resolveHijriPort } from './hijri';
import {
  IntegrationAnalyticsPort,
  PrismaActionLogPort,
  PrismaApprovalPort,
  PrismaBrandProfilePort,
  UnconfiguredPostsPort,
} from './adapters/prisma.adapters';
import { notConfigured, upstreamUnavailable } from './errors';

/**
 * Model access for the generation tools, via the OpenAI SDK already in the
 * dependency tree. Nothing here reads a key at import time, so a missing key
 * is a clear runtime failure rather than a silent `sk-proj-` stub (AUDIT §15 S7).
 */
@Injectable()
export class OpenAiModelPort implements ModelPort {
  async generate(request: ModelRequest): Promise<ModelResponse> {
    assertLaunchFeature('hostedAi');
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw notConfigured('OPENAI_API_KEY is not set');
    }

    // Imported lazily so a deployment without AI configured still boots.
    const { default: OpenAI } = await import('openai');
    const client = new OpenAI({ apiKey });

    try {
      const completion = await client.chat.completions.create({
        model: process.env.NASHR_AGENT_MODEL || 'gpt-4.1',
        max_completion_tokens: request.maxOutputTokens,
        temperature: request.temperature ?? 0.7,
        messages: [
          { role: 'system', content: request.system },
          { role: 'user', content: request.prompt },
        ],
      });
      return {
        text: completion.choices[0]?.message?.content ?? '',
        usage: {
          inputTokens: completion.usage?.prompt_tokens,
          outputTokens: completion.usage?.completion_tokens,
        },
      };
    } catch (e) {
      throw upstreamUnavailable(e instanceof Error ? e.message : String(e));
    }
  }
}

@Injectable()
export class NashrAgentsService {
  private readonly logger = new Logger(NashrAgentsService.name);
  private mastraInstance?: Mastra;

  readonly ports: AgentPorts;
  readonly registry: AgentRegistry;
  readonly runtime: NashrAgentRuntime;
  readonly proposals: ProposalStorePort;

  constructor(
    private readonly prisma: PrismaService,
    integrations: IntegrationService,
    integrationManager: IntegrationManager,
    model: OpenAiModelPort
  ) {
    this.ports = {
      brand: new PrismaBrandProfilePort(prisma),
      posts: new UnconfiguredPostsPort(),
      analytics: new IntegrationAnalyticsPort(prisma, integrations, integrationManager),
      approval: new PrismaApprovalPort(prisma),
      hijri: resolveHijriPort(),
      model,
    };

    // Single-process store. Swap for a Redis-backed ProposalStorePort before
    // running more than one backend replica — see README.
    this.proposals = new InMemoryProposalStore();

    const audit = new AuditLogger(new PrismaActionLogPort(prisma), {
      onAuditFailure: (error, entry) =>
        this.logger.error(
          `audit write failed agent=${entry.agentKey} tool=${entry.toolName} status=${entry.status}: ${error.message}`
        ),
    });

    const guardrails = new GuardrailRuntime({
      audit,
      proposals: this.proposals,
      limits: NASHR_AGENT_LIMITS,
    });

    // The registry is built before the runtime so an invalid agent definition
    // fails at boot, not on a customer's first message.
    this.registry = buildNashrAgentRegistry({
      ports: this.ports,
      resolveBudget: (requestId) => this.runtime?.budgetFor(requestId),
    });

    this.runtime = new NashrAgentRuntime(this.registry, guardrails, NASHR_AGENT_LIMITS);
    this.logger.log(
      `registered ${this.registry.list().length} Nashr agents with ${
        this.registry.list().reduce((n, a) => n + a.tools.length, 0)
      } guarded tools`
    );
  }

  /** Lazily built so a deployment without OPENAI_API_KEY still boots. */
  async mastra(): Promise<Mastra> {
    assertLaunchFeature('customAgents');
    if (!this.mastraInstance) {
      this.mastraInstance = new Mastra({
        storage: pStore,
        agents: toMastraAgents(this.runtime, this.registry),
        logger: new ConsoleLogger({ level: 'info' }),
      });
    }
    return this.mastraInstance;
  }

  manifest() {
    return this.registry.manifest();
  }

  /**
   * Read-only audit view. Org-scoped, and the stored columns are already
   * redacted (`argsDigest` is a fingerprint plus a redacted shape), so nothing
   * here can leak a payload.
   */
  async listAuditEntries(organizationId: string, take: number, agentKey?: string) {
    const entries = await this.prisma.nashrAgentActionLog.findMany({
      where: { organizationId, ...(agentKey ? { agentKey } : {}) },
      orderBy: { createdAt: 'desc' },
      take,
      select: {
        id: true,
        agentKey: true,
        toolName: true,
        sensitive: true,
        status: true,
        argsDigest: true,
        resultSummary: true,
        errorMessage: true,
        attempts: true,
        durationMs: true,
        createdAt: true,
      },
    });
    return { entries };
  }
}
