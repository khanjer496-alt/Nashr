import {
  NASHR_APPROVAL_DECISIONS,
  NASHR_APPROVAL_STAGES,
  canSchedule,
  isEditableStage,
  isTransitionFailure,
  legalDecisionsFor,
  transition,
} from './state-machine';

const ALL_ROLES = [
  'OWNER',
  'ADMIN',
  'EDITOR',
  'APPROVER',
  'CLIENT',
  'VIEWER',
] as const;

/** Unwrap a successful transition, or fail loudly with the real reason. */
const ok = (r: ReturnType<typeof transition>) => {
  if (isTransitionFailure(r)) {
    throw new Error(`expected ok, got ${r.code}: ${r.reason}`);
  }
  return r.nextStage;
};

/** Failure code of a transition result, or undefined when it succeeded. */
const code = (r: ReturnType<typeof transition>) =>
  isTransitionFailure(r) ? r.code : undefined;

describe('Nashr approval state machine', () => {
  describe('the happy path: Draft → Internal review → Client approval → Approved', () => {
    it('walks the whole pipeline', () => {
      const a = transition({
        currentStage: 'DRAFT',
        decision: 'SUBMITTED',
        actorRole: 'EDITOR',
      });
      expect(ok(a)).toBe('INTERNAL_REVIEW');

      const b = transition({
        currentStage: 'INTERNAL_REVIEW',
        decision: 'APPROVED',
        actorRole: 'APPROVER',
      });
      expect(ok(b)).toBe('CLIENT_APPROVAL');

      const c = transition({
        currentStage: 'CLIENT_APPROVAL',
        decision: 'APPROVED',
        actorRole: 'CLIENT',
      });
      expect(ok(c)).toBe('APPROVED');

      expect(canSchedule('APPROVED')).toBe(true);
    });

    it('skips client approval when the org opted out', () => {
      const r = transition({
        currentStage: 'INTERNAL_REVIEW',
        decision: 'APPROVED',
        actorRole: 'APPROVER',
        options: { clientApprovalRequired: false },
      });
      expect(ok(r)).toBe('APPROVED');
    });

    it('requires client approval by default', () => {
      const r = transition({
        currentStage: 'INTERNAL_REVIEW',
        decision: 'APPROVED',
        actorRole: 'APPROVER',
        options: {},
      });
      expect(ok(r)).toBe('CLIENT_APPROVAL');
    });
  });

  describe('EDITOR cannot approve', () => {
    it('is refused at internal review', () => {
      const r = transition({
        currentStage: 'INTERNAL_REVIEW',
        decision: 'APPROVED',
        actorRole: 'EDITOR',
      });
      expect(r.ok).toBe(false);
      expect(code(r)).toBe('ROLE_NOT_PERMITTED');
    });

    it('is refused at client approval', () => {
      const r = transition({
        currentStage: 'CLIENT_APPROVAL',
        decision: 'APPROVED',
        actorRole: 'EDITOR',
      });
      expect(code(r)).toBe('ROLE_NOT_PERMITTED');
    });

    it('cannot reject or request changes either', () => {
      for (const decision of ['REJECTED', 'CHANGES_REQUESTED'] as const) {
        const r = transition({
          currentStage: 'INTERNAL_REVIEW',
          decision,
          actorRole: 'EDITOR',
        });
        expect(r.ok).toBe(false);
      }
    });

    it('can never reach APPROVED from any stage with any decision', () => {
      for (const stage of NASHR_APPROVAL_STAGES) {
        for (const decision of NASHR_APPROVAL_DECISIONS) {
          const r = transition({
            currentStage: stage,
            decision,
            actorRole: 'EDITOR',
          });
          if (r.ok) expect(r.nextStage).not.toBe('APPROVED');
        }
      }
    });
  });

  describe('CLIENT cannot make internal decisions', () => {
    it('is refused at INTERNAL_REVIEW', () => {
      for (const decision of [
        'APPROVED',
        'CHANGES_REQUESTED',
        'REJECTED',
      ] as const) {
        const r = transition({
          currentStage: 'INTERNAL_REVIEW',
          decision,
          actorRole: 'CLIENT',
        });
        expect(r.ok).toBe(false);
        expect(code(r)).toBe('ROLE_NOT_PERMITTED');
      }
    });

    it('cannot submit a draft for review', () => {
      const r = transition({
        currentStage: 'DRAFT',
        decision: 'SUBMITTED',
        actorRole: 'CLIENT',
      });
      expect(code(r)).toBe('ROLE_NOT_PERMITTED');
    });

    it('cannot withdraw an approval', () => {
      const r = transition({
        currentStage: 'APPROVED',
        decision: 'WITHDRAWN',
        actorRole: 'CLIENT',
      });
      expect(code(r)).toBe('ROLE_NOT_PERMITTED');
    });

    it('CAN approve at CLIENT_APPROVAL', () => {
      const r = transition({
        currentStage: 'CLIENT_APPROVAL',
        decision: 'APPROVED',
        actorRole: 'CLIENT',
      });
      expect(ok(r)).toBe('APPROVED');
    });
  });

  describe('APPROVER cannot stand in for the client', () => {
    it('is refused at CLIENT_APPROVAL', () => {
      const r = transition({
        currentStage: 'CLIENT_APPROVAL',
        decision: 'APPROVED',
        actorRole: 'APPROVER',
      });
      expect(code(r)).toBe('ROLE_NOT_PERMITTED');
    });
  });

  describe('VIEWER can do nothing', () => {
    it('is refused every decision from every stage', () => {
      for (const stage of NASHR_APPROVAL_STAGES) {
        for (const decision of NASHR_APPROVAL_DECISIONS) {
          const r = transition({
            currentStage: stage,
            decision,
            actorRole: 'VIEWER',
          });
          expect(r.ok).toBe(false);
        }
      }
    });

    it('has no legal decisions anywhere', () => {
      for (const stage of NASHR_APPROVAL_STAGES) {
        expect(legalDecisionsFor(stage, 'VIEWER')).toEqual([]);
      }
    });
  });

  describe('CHANGES_REQUESTED returns to draft', () => {
    it('is an editable stage', () => {
      expect(isEditableStage('CHANGES_REQUESTED')).toBe(true);
      expect(isEditableStage('DRAFT')).toBe(true);
      expect(isEditableStage('INTERNAL_REVIEW')).toBe(false);
      expect(isEditableStage('CLIENT_APPROVAL')).toBe(false);
      expect(isEditableStage('APPROVED')).toBe(false);
    });

    it('accepts a resubmission back into internal review', () => {
      const r = transition({
        currentStage: 'CHANGES_REQUESTED',
        decision: 'SUBMITTED',
        actorRole: 'EDITOR',
      });
      expect(ok(r)).toBe('INTERNAL_REVIEW');
    });

    it('can be raised by the client too', () => {
      const r = transition({
        currentStage: 'CLIENT_APPROVAL',
        decision: 'CHANGES_REQUESTED',
        actorRole: 'CLIENT',
      });
      expect(ok(r)).toBe('CHANGES_REQUESTED');
    });

    it('is not schedulable', () => {
      expect(canSchedule('CHANGES_REQUESTED')).toBe(false);
    });
  });

  describe('REJECTED is terminal until resubmitted', () => {
    it('accepts only SUBMITTED, and only from an author', () => {
      expect(legalDecisionsFor('REJECTED', 'EDITOR')).toEqual(['SUBMITTED']);
      expect(legalDecisionsFor('REJECTED', 'APPROVER')).toEqual([]);
      expect(legalDecisionsFor('REJECTED', 'CLIENT')).toEqual([]);
    });

    it('cannot be approved directly out of rejection', () => {
      for (const role of ALL_ROLES) {
        const r = transition({
          currentStage: 'REJECTED',
          decision: 'APPROVED',
          actorRole: role,
        });
        expect(r.ok).toBe(false);
      }
    });

    it('resubmission lands in INTERNAL_REVIEW, not APPROVED', () => {
      const r = transition({
        currentStage: 'REJECTED',
        decision: 'SUBMITTED',
        actorRole: 'ADMIN',
      });
      expect(ok(r)).toBe('INTERNAL_REVIEW');
    });

    it('is not schedulable', () => {
      expect(canSchedule('REJECTED')).toBe(false);
    });
  });

  describe('illegal transitions', () => {
    it('rejects DRAFT → APPROVED for everyone, including OWNER', () => {
      for (const role of ALL_ROLES) {
        const r = transition({
          currentStage: 'DRAFT',
          decision: 'APPROVED',
          actorRole: role,
        });
        expect(r.ok).toBe(false);
        expect(code(r)).toBe('ILLEGAL_TRANSITION');
      }
    });

    it('rejects a second submission while already in review', () => {
      const r = transition({
        currentStage: 'INTERNAL_REVIEW',
        decision: 'SUBMITTED',
        actorRole: 'EDITOR',
      });
      expect(code(r)).toBe('ILLEGAL_TRANSITION');
    });

    it('rejects re-approving an already approved post', () => {
      const r = transition({
        currentStage: 'APPROVED',
        decision: 'APPROVED',
        actorRole: 'OWNER',
      });
      expect(code(r)).toBe('ILLEGAL_TRANSITION');
    });

    it('allows only WITHDRAWN out of APPROVED, and only for org managers', () => {
      expect(legalDecisionsFor('APPROVED', 'OWNER')).toEqual(['WITHDRAWN']);
      expect(legalDecisionsFor('APPROVED', 'ADMIN')).toEqual(['WITHDRAWN']);
      expect(legalDecisionsFor('APPROVED', 'APPROVER')).toEqual([]);
      expect(legalDecisionsFor('APPROVED', 'EDITOR')).toEqual([]);
      expect(ok(
        transition({
          currentStage: 'APPROVED',
          decision: 'WITHDRAWN',
          actorRole: 'OWNER',
        })
      )).toBe('DRAFT');
    });

    it('distinguishes ILLEGAL_TRANSITION from ROLE_NOT_PERMITTED', () => {
      // The decision does not exist from this stage at all.
      const illegal = transition({
        currentStage: 'DRAFT',
        decision: 'CHANGES_REQUESTED',
        actorRole: 'APPROVER',
      });
      expect(code(illegal)).toBe('ILLEGAL_TRANSITION');

      // The decision exists, this role just may not make it.
      const forbidden = transition({
        currentStage: 'INTERNAL_REVIEW',
        decision: 'CHANGES_REQUESTED',
        actorRole: 'EDITOR',
      });
      expect(code(forbidden)).toBe('ROLE_NOT_PERMITTED');
    });
  });

  describe('garbage input is rejected, never coerced', () => {
    it('rejects unknown stages', () => {
      const r = transition({
        currentStage: 'PUBLISHED' as any,
        decision: 'APPROVED',
        actorRole: 'OWNER',
      });
      expect(code(r)).toBe('UNKNOWN_STAGE');
    });

    it('rejects unknown decisions', () => {
      const r = transition({
        currentStage: 'DRAFT',
        decision: 'YOLO' as any,
        actorRole: 'OWNER',
      });
      expect(code(r)).toBe('UNKNOWN_DECISION');
    });

    it('rejects unknown roles', () => {
      const r = transition({
        currentStage: 'DRAFT',
        decision: 'SUBMITTED',
        actorRole: 'SUPERADMIN' as any,
      });
      expect(code(r)).toBe('UNKNOWN_ROLE');
    });

    it('rejects null / undefined without throwing', () => {
      expect(transition({} as any).ok).toBe(false);
      expect(transition(null as any).ok).toBe(false);
    });
  });

  describe('canSchedule', () => {
    it('is true only for APPROVED', () => {
      for (const stage of NASHR_APPROVAL_STAGES) {
        expect(canSchedule(stage)).toBe(stage === 'APPROVED');
      }
    });

    it('is false for upstream State values and for junk', () => {
      expect(canSchedule('QUEUE')).toBe(false);
      expect(canSchedule('PUBLISHED')).toBe(false);
      expect(canSchedule(null)).toBe(false);
      expect(canSchedule(undefined)).toBe(false);
      expect(canSchedule(true)).toBe(false);
    });
  });
});
