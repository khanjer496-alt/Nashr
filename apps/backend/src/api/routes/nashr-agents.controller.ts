/**
 * Nashr agents HTTP surface.
 *
 * Two responsibilities, and the second one is the reason this controller
 * exists at all:
 *
 *  1. Bridge the Nashr Mastra agents to the CopilotKit UI, the same way
 *     `copilot.controller.ts` bridges the upstream `postiz` agent. Upstream's
 *     controller is left untouched; Nashr agents are served on their own route
 *     so the two agent sets can never share a tool surface.
 *
 *  2. **Be the only place a confirmation token is minted.** A sensitive tool
 *     returns a proposal to the model; the model gets an opaque id and nothing
 *     else. `POST /nashr-agents/proposals/:id/approve` runs behind
 *     `AuthMiddleware`, so it is reachable only by an authenticated person, and
 *     it is the sole caller of `signConfirmation()`. That is what makes
 *     "approval required before publishing, deleting, sending messages or
 *     changing campaigns" a property of the system rather than a prompt.
 */
import {
  Body,
  Controller,
  Get,
  Logger,
  Param,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { Organization } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import {
  CopilotRuntime,
  OpenAIAdapter,
  copilotRuntimeNextJSAppRouterEndpoint,
} from '@copilotkit/runtime';
import { MastraAgent } from '@ag-ui/mastra';
import { RequestContext } from '@mastra/core/di';
import { GetOrgFromRequest } from '@gitroom/nestjs-libraries/user/org.from.request';
import { CheckPolicies } from '@gitroom/backend/services/auth/permissions/permissions.ability';
import {
  AuthorizationActions,
  Sections,
} from '@gitroom/backend/services/auth/permissions/permission.exception.class';
// Relative import: tsconfig.base.json has no "@gitroom/nashr-agents/*" path
// mapping and that file is not owned by this workstream. Adding
//   "@gitroom/nashr-agents/*": ["libraries/nashr-agents/src/*"]
// lets every import below become a scoped one; nothing else changes.
import { NashrAgentsService } from '../../../../../libraries/nashr-agents/src/nashr-agents.service';
import { NASHR_CONTEXT_KEYS } from '../../../../../libraries/nashr-agents/src/mastra.binding';
import {
  hashArgs,
  signConfirmation,
} from '../../../../../libraries/nashr-agents/src/proposals';
import { toSafeError } from '../../../../../libraries/nashr-agents/src/errors';

type NashrCopilotContext = Record<string, string>;

@ApiTags('Nashr Agents')
@Controller('/nashr-agents')
export class NashrAgentsController {
  private readonly logger = new Logger(NashrAgentsController.name);

  constructor(private readonly _nashrAgents: NashrAgentsService) {}

  /**
   * The agent manifest: every agent, its declared capabilities, and for each
   * tool whether it requires human approval. Deliberately public to the
   * workspace — a customer should be able to see exactly what the agents can do.
   */
  @Get('/')
  manifest() {
    return { agents: this._nashrAgents.manifest() };
  }

  /** CopilotKit bridge for the Nashr agent set. */
  @Post('/chat')
  @CheckPolicies([AuthorizationActions.Create, Sections.AI])
  async chat(
    @Req() req: Request,
    @Res() res: Response,
    @GetOrgFromRequest() organization: Organization
  ) {
    if (!process.env.OPENAI_API_KEY) {
      this.logger.warn('OPENAI_API_KEY not set — Nashr agents are unavailable');
      res.status(503).json({
        error: { code: 'NOT_CONFIGURED', message: 'AI is not configured for this deployment.' },
      });
      return;
    }

    const mastra = await this._nashrAgents.mastra();
    const requestContext = new RequestContext<NashrCopilotContext>();

    // Tenancy and identity come from the authenticated request, never from the
    // request body — the model must not be able to nominate an organisation.
    requestContext.set(NASHR_CONTEXT_KEYS.organization, JSON.stringify({ id: organization.id }));
    requestContext.set(NASHR_CONTEXT_KEYS.userId, resolveUserId(req) ?? '');
    requestContext.set(NASHR_CONTEXT_KEYS.userOrgId, resolveUserOrgId(req) ?? '');
    requestContext.set(NASHR_CONTEXT_KEYS.locale, resolveLocale(req));
    requestContext.set(NASHR_CONTEXT_KEYS.market, resolveMarket(req));
    requestContext.set(NASHR_CONTEXT_KEYS.requestId, randomUUID());

    const agents = MastraAgent.getLocalAgents({
      resourceId: organization.id,
      mastra,
      requestContext: requestContext as never,
    });

    const handler = copilotRuntimeNextJSAppRouterEndpoint({
      endpoint: '/nashr-agents/chat',
      runtime: new CopilotRuntime({ agents }),
      serviceAdapter: new OpenAIAdapter({ model: process.env.NASHR_AGENT_MODEL || 'gpt-4.1' }),
    });

    return handler.handleRequest(req, res);
  }

  /** Invoke a single tool directly, with the same guardrails as the chat path. */
  @Post('/tools/:toolId')
  @CheckPolicies([AuthorizationActions.Create, Sections.AI])
  async invokeTool(
    @Req() req: Request,
    @GetOrgFromRequest() organization: Organization,
    @Param('toolId') toolId: string,
    @Body() body: Record<string, unknown>
  ) {
    return this._nashrAgents.runtime.invoke(toolId, body ?? {}, {
      organizationId: organization.id,
      userId: resolveUserId(req),
      userOrgId: resolveUserOrgId(req),
      locale: resolveLocale(req) === 'ar' ? 'ar' : 'en',
      market: resolveMarket(req) as never,
      requestId: randomUUID(),
    });
  }

  @Get('/proposals/:proposalId')
  @CheckPolicies([AuthorizationActions.Create, Sections.AI])
  async getProposal(
    @GetOrgFromRequest() organization: Organization,
    @Param('proposalId') proposalId: string
  ) {
    const stored = await this._nashrAgents.proposals.get(organization.id, proposalId);
    if (!stored) {
      return { found: false };
    }
    return {
      found: true,
      proposal: {
        proposalId: stored.proposalId,
        agentKey: stored.agentKey,
        toolId: stored.toolId,
        state: stored.state,
        createdAt: stored.createdAt,
        expiresAt: stored.expiresAt,
      },
    };
  }

  /**
   * A person approves a proposed action.
   *
   * This is the ONLY caller of `signConfirmation`. The token it returns goes to
   * the browser; it is never placed in a tool result, so the model cannot see,
   * guess or replay it. The token is bound to (proposal, org, tool, exact
   * arguments, approver) and the guardrail marks the proposal CONSUMED before
   * the handler runs, making it single-use.
   */
  @Post('/proposals/:proposalId/approve')
  @CheckPolicies([AuthorizationActions.Create, Sections.AI])
  async approveProposal(
    @Req() req: Request,
    @GetOrgFromRequest() organization: Organization,
    @Param('proposalId') proposalId: string,
    @Body() body: { args?: unknown }
  ) {
    const userId = resolveUserId(req);
    if (!userId) {
      return { approved: false, error: { code: 'FORBIDDEN', message: 'Sign in to approve.' } };
    }

    try {
      const stored = await this._nashrAgents.proposals.get(organization.id, proposalId);
      if (!stored) {
        return {
          approved: false,
          error: { code: 'NOT_FOUND', message: 'That proposal was not found.' },
        };
      }
      if (stored.state !== 'PROPOSED') {
        return {
          approved: false,
          error: {
            code: 'APPROVAL_INVALID',
            message: 'That proposal has already been decided or has expired.',
          },
        };
      }
      if (new Date(stored.expiresAt).getTime() <= Date.now()) {
        await this._nashrAgents.proposals.update(organization.id, proposalId, {
          state: 'EXPIRED',
        });
        return {
          approved: false,
          error: { code: 'APPROVAL_INVALID', message: 'That proposal has expired.' },
        };
      }
      // If the client echoes the arguments back, they must be byte-identical to
      // what was proposed. A changed argument invalidates the approval.
      if (body?.args !== undefined && hashArgs(body.args) !== stored.argsHash) {
        return {
          approved: false,
          error: {
            code: 'APPROVAL_INVALID',
            message: 'The action changed since it was proposed. Ask for a new proposal.',
          },
        };
      }

      const approvedAt = new Date().toISOString();
      await this._nashrAgents.proposals.update(organization.id, proposalId, {
        state: 'APPROVED',
        approvedByUserId: userId,
        approvedAt,
      });

      const confirmationToken = signConfirmation({
        proposalId: stored.proposalId,
        organizationId: organization.id,
        toolId: stored.toolId,
        argsHash: stored.argsHash,
        approvedByUserId: userId,
        expiresAt: new Date(stored.expiresAt).getTime(),
      });

      return { approved: true, confirmationToken, expiresAt: stored.expiresAt };
    } catch (error) {
      // Typed and redacted: no stack, no provider text, no internal ids.
      return { approved: false, error: toSafeError(error) };
    }
  }

  @Post('/proposals/:proposalId/reject')
  @CheckPolicies([AuthorizationActions.Create, Sections.AI])
  async rejectProposal(
    @GetOrgFromRequest() organization: Organization,
    @Param('proposalId') proposalId: string
  ) {
    const updated = await this._nashrAgents.proposals.update(organization.id, proposalId, {
      state: 'REJECTED',
    });
    return { rejected: !!updated };
  }

  /** Read-only audit view, scoped to the caller's organisation. */
  @Get('/audit')
  @CheckPolicies([AuthorizationActions.Read, Sections.AI])
  async audit(
    @GetOrgFromRequest() organization: Organization,
    @Query('agentKey') agentKey?: string,
    @Query('limit') limit?: string
  ) {
    const take = Math.min(Math.max(Number(limit) || 50, 1), 200);
    return this._nashrAgents.listAuditEntries(organization.id, take, agentKey);
  }
}

// ---------------------------------------------------------------------------
// Request helpers
// ---------------------------------------------------------------------------

interface AuthenticatedRequest extends Request {
  user?: { id?: string };
  org?: { id?: string; users?: Array<{ id?: string; userId?: string }> };
}

function resolveUserId(req: Request): string | undefined {
  const user = (req as AuthenticatedRequest).user;
  return typeof user?.id === 'string' ? user.id : undefined;
}

/** `UserOrganization.id` for the acting member, used as the audit actor. */
function resolveUserOrgId(req: Request): string | undefined {
  const authed = req as AuthenticatedRequest;
  const userId = resolveUserId(req);
  const membership = authed.org?.users?.find((u) => u.userId === userId);
  return typeof membership?.id === 'string' ? membership.id : undefined;
}

function resolveLocale(req: Request): string {
  const header = req.headers['accept-language'];
  const raw = Array.isArray(header) ? header[0] : header;
  return typeof raw === 'string' && raw.toLowerCase().startsWith('ar') ? 'ar' : 'en';
}

function resolveMarket(req: Request): string {
  const header = req.headers['x-nashr-market'];
  const raw = Array.isArray(header) ? header[0] : header;
  return typeof raw === 'string' && /^(AE|SA|KW|QA|BH|OM|EG|JO)$/.test(raw.toUpperCase())
    ? raw.toUpperCase()
    : 'AE';
}
