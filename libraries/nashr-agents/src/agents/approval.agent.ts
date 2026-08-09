/**
 * Approval agent.
 *
 * It routes drafts through the approval workflow and records decisions that
 * humans have already made. **It never approves on a human's behalf.**
 *
 * Three independent mechanisms enforce that, because one would not be enough:
 *
 *  1. There is no tool that approves. `recordHumanDecision` records a decision
 *     that already exists; there is no code path from an agent turn to an
 *     APPROVED record without a person.
 *  2. `recordHumanDecision` is sensitive, so it is itself gated by the proposal
 *     flow — a person must approve the act of recording.
 *  3. `assertHumanActor()` requires `input.actorId` to equal the `ctx.userId`
 *     of the human whose session the turn is running in. An agent cannot name
 *     someone else as the decision-maker, and a turn with no human attached
 *     (a scheduled job, an API key) cannot record a decision at all.
 *
 * The workflow itself lives in `libraries/nashr-approval` (another engineer).
 * This agent talks to it only through `ApprovalPort`.
 */
import { z } from 'zod';
import type { AgentDefinition, NashrToolContext } from '../types';
import { forbidden, selfApprovalBlocked } from '../errors';
import { AgentFactoryDeps, defineTool, detail } from './agent.helpers';

const APPROVAL_INSTRUCTIONS = `
You help move drafts through Nashr's approval workflow:
Draft → Internal review → Client approval → Approved → Scheduled → Published.

Hard rules:
- You never approve, reject, or request changes on anyone's behalf. You can move
  a draft into a review stage, and you can write down a decision a person has
  already made and confirmed. That is all.
- Never say a post "has been approved" unless a tool result says so. Never
  predict an approval.
- When someone asks you to "just approve it", explain that a person has to make
  the decision themselves and offer to send it to the right reviewer.
- When a post is blocked, say who it is waiting on and what stage it is at.
`.trim();

const stageEnum = z.enum([
  'DRAFT',
  'INTERNAL_REVIEW',
  'CLIENT_APPROVAL',
  'APPROVED',
  'CHANGES_REQUESTED',
  'REJECTED',
]);

const decisionEnum = z.enum([
  'APPROVED',
  'CHANGES_REQUESTED',
  'REJECTED',
  'WITHDRAWN',
]);

const approvalRecordSchema = z.object({
  postId: z.string(),
  stage: stageEnum,
  decision: z.enum([
    'SUBMITTED',
    'APPROVED',
    'CHANGES_REQUESTED',
    'REJECTED',
    'WITHDRAWN',
  ]),
  note: z.string().nullable(),
  createdAt: z.string(),
});

/**
 * The invariant that makes "never approve on a human's behalf" real.
 * Exported so it is directly unit-testable.
 */
export function assertHumanActor(actorId: string, ctx: NashrToolContext): void {
  if (!ctx.userId) {
    throw forbidden(
      'no authenticated human is attached to this turn; a decision cannot be recorded'
    );
  }
  if (actorId !== ctx.userId) {
    throw selfApprovalBlocked(
      'actorId does not match the authenticated human in this session'
    );
  }
}

export function createApprovalAgent(deps: AgentFactoryDeps): AgentDefinition {
  const { ports } = deps;

  return {
    key: 'nashrApproval',
    name: 'Approval',
    nameAr: 'الاعتماد',
    description:
      'Routes drafts through internal review and client approval and records decisions people have made. It cannot approve anything itself.',
    capabilities: ['approval.read', 'approval.route'],
    modelTier: 'fast',
    instructions: APPROVAL_INSTRUCTIONS,
    tools: [
      defineTool({
        id: 'getApprovalStatus',
        title: 'Get approval status',
        description: 'Show the approval history and current stage for a post.',
        category: 'read',
        sensitive: false,
        capability: 'approval.read',
        inputSchema: z.object({ postId: z.string().min(1).max(64) }),
        outputSchema: z.object({
          currentStage: stageEnum.nullable(),
          isApproved: z.boolean(),
          history: z.array(approvalRecordSchema),
        }),
        handler: async (input, ctx) => {
          const history = await ports.approval.getForPost(ctx.organizationId, input.postId);
          const sorted = [...history].sort((a, b) =>
            a.createdAt.localeCompare(b.createdAt)
          );
          const latest = sorted[sorted.length - 1];
          return {
            currentStage: latest?.stage ?? null,
            isApproved: latest?.stage === 'APPROVED',
            history: sorted.map((h) => ({
              postId: h.postId,
              stage: h.stage,
              decision: h.decision,
              note: h.note ?? null,
              createdAt: h.createdAt,
            })),
          };
        },
      }),

      defineTool({
        id: 'listPendingApprovals',
        title: 'List pending approvals',
        description: 'List posts currently waiting on a review or a client decision.',
        category: 'read',
        sensitive: false,
        capability: 'approval.read',
        inputSchema: z.object({
          stage: z.enum(['INTERNAL_REVIEW', 'CLIENT_APPROVAL']).optional(),
        }),
        outputSchema: z.object({
          pending: z.array(
            z.object({ postId: z.string(), stage: stageEnum, waitingSince: z.string() })
          ),
        }),
        handler: async (input, ctx) => {
          const pending = await ports.approval.listPending(ctx.organizationId, input.stage);
          return {
            pending: pending.map((p) => ({
              postId: p.postId,
              stage: p.stage,
              waitingSince: p.updatedAt,
            })),
          };
        },
      }),

      defineTool({
        id: 'submitForReview',
        title: 'Send a draft for review',
        description:
          'Move a draft into internal review or client approval. Requires human approval before it runs.',
        category: 'write',
        sensitive: true,
        capability: 'approval.route',
        inputSchema: z.object({
          postId: z.string().min(1).max(64),
          stage: z.enum(['INTERNAL_REVIEW', 'CLIENT_APPROVAL']),
          note: z.string().max(1000).optional(),
        }),
        outputSchema: z.object({ postId: z.string(), stage: stageEnum }),
        describeProposal: (input) => ({
          title: 'Send draft for review',
          summary: `Move this draft to ${input.stage === 'INTERNAL_REVIEW' ? 'internal review' : 'client approval'}.`,
          details: [detail('Stage', input.stage), detail('Note', input.note)],
          effect:
            'Reviewers are notified. This routes the draft; it does not approve or publish anything.',
          reversible: true,
        }),
        handler: async (input, ctx) => {
          // Routing still requires a human in session — an unattended job must
          // not be able to push work at a client.
          if (!ctx.userId) {
            throw forbidden('no authenticated human is attached to this turn');
          }
          const record = await ports.approval.submitForReview(
            ctx.organizationId,
            input.postId,
            input.stage,
            ctx.userId,
            input.note
          );
          return { postId: record.postId, stage: record.stage };
        },
      }),

      defineTool({
        id: 'recordHumanDecision',
        title: 'Record a decision a person made',
        description:
          'Write down an approval decision a person has already made. The actor must be the signed-in person; the agent can never decide.',
        category: 'write',
        sensitive: true,
        capability: 'approval.route',
        inputSchema: z.object({
          postId: z.string().min(1).max(64),
          decision: decisionEnum,
          /** Must equal the authenticated user in this session. */
          actorId: z.string().min(1).max(64),
          note: z.string().max(1000).optional(),
        }),
        outputSchema: z.object({
          postId: z.string(),
          stage: stageEnum,
          decision: z.enum([
            'SUBMITTED',
            'APPROVED',
            'CHANGES_REQUESTED',
            'REJECTED',
            'WITHDRAWN',
          ]),
          recordedBy: z.string(),
        }),
        describeProposal: (input) => ({
          title: 'Record an approval decision',
          summary: `Record "${input.decision}" for this post, attributed to you.`,
          details: [
            detail('Decision', input.decision),
            detail('Note', input.note),
            detail('Attributed to', 'the person approving this proposal'),
          ],
          effect:
            'The decision is written to the approval trail under your name. Approve only if this is the decision you made.',
          reversible: false,
        }),
        handler: async (input, ctx) => {
          assertHumanActor(input.actorId, ctx);
          const record = await ports.approval.recordDecision(
            ctx.organizationId,
            input.postId,
            input.decision,
            ctx.userId as string,
            input.note
          );
          return {
            postId: record.postId,
            stage: record.stage,
            decision: record.decision,
            recordedBy: ctx.userId as string,
          };
        },
      }),
    ],
  };
}
