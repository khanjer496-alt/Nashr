import {
  NASHR_ACTIONS,
  NASHR_RESOURCES,
  NASHR_ROLES,
  ROLE_MATRIX,
  can,
  firstDenied,
  isBrandScoped,
  permissionsFor,
  scopeFor,
} from './role.matrix';

describe('Nashr role matrix', () => {
  describe('default deny', () => {
    it('denies an unknown role', () => {
      expect(can('SUPERADMIN', 'post', 'read')).toBe(false);
      expect(can('root', 'post', 'read')).toBe(false);
      expect(can('', 'post', 'read')).toBe(false);
    });

    it('denies null / undefined / non-string roles', () => {
      expect(can(null, 'post', 'read')).toBe(false);
      expect(can(undefined, 'post', 'read')).toBe(false);
      expect(can({}, 'post', 'read')).toBe(false);
      expect(can(1, 'post', 'read')).toBe(false);
    });

    it('denies unknown resources and actions even for OWNER', () => {
      expect(can('OWNER', 'nuclear_launch', 'create')).toBe(false);
      expect(can('OWNER', 'post', 'detonate')).toBe(false);
      expect(can('OWNER', undefined, 'read')).toBe(false);
      expect(can('OWNER', 'post', null)).toBe(false);
    });

    it('is not fooled by prototype-chain property names', () => {
      expect(can('OWNER', 'constructor', 'read')).toBe(false);
      expect(can('OWNER', '__proto__', 'read')).toBe(false);
      expect(can('OWNER', 'toString', 'read')).toBe(false);
      expect(can('OWNER', 'hasOwnProperty', 'read')).toBe(false);
    });

    it('never grants an action outside the declared action vocabulary', () => {
      for (const role of NASHR_ROLES) {
        for (const resource of NASHR_RESOURCES) {
          for (const action of ROLE_MATRIX[role][resource] ?? []) {
            expect(NASHR_ACTIONS).toContain(action);
          }
        }
      }
    });
  });

  describe('OWNER', () => {
    it('can do billing and delete the organization', () => {
      expect(can('OWNER', 'billing', 'create')).toBe(true);
      expect(can('OWNER', 'billing', 'update')).toBe(true);
      expect(can('OWNER', 'billing', 'delete')).toBe(true);
      expect(can('OWNER', 'organization', 'delete')).toBe(true);
    });

    it('can publish and schedule', () => {
      expect(can('OWNER', 'post', 'publish')).toBe(true);
      expect(can('OWNER', 'post', 'schedule')).toBe(true);
    });
  });

  describe('ADMIN', () => {
    it('cannot mutate billing', () => {
      expect(can('ADMIN', 'billing', 'create')).toBe(false);
      expect(can('ADMIN', 'billing', 'update')).toBe(false);
      expect(can('ADMIN', 'billing', 'delete')).toBe(false);
    });

    it('can still read billing', () => {
      expect(can('ADMIN', 'billing', 'read')).toBe(true);
    });

    it('cannot delete the organization', () => {
      expect(can('ADMIN', 'organization', 'delete')).toBe(false);
      expect(can('ADMIN', 'organization', 'update')).toBe(true);
    });

    it('otherwise matches OWNER on content and channels', () => {
      for (const action of ['create', 'read', 'update', 'delete', 'submit', 'schedule', 'publish'] as const) {
        expect(can('ADMIN', 'post', action)).toBe(can('OWNER', 'post', action));
      }
      for (const action of ['create', 'read', 'update', 'delete'] as const) {
        expect(can('ADMIN', 'integration', action)).toBe(true);
        expect(can('ADMIN', 'brand', action)).toBe(true);
      }
    });
  });

  describe('EDITOR', () => {
    it('can author and submit drafts', () => {
      expect(can('EDITOR', 'post', 'create')).toBe(true);
      expect(can('EDITOR', 'post', 'update')).toBe(true);
      expect(can('EDITOR', 'post', 'delete')).toBe(true);
      expect(can('EDITOR', 'post', 'submit')).toBe(true);
      expect(can('EDITOR', 'approval', 'submit')).toBe(true);
    });

    it('CANNOT approve', () => {
      expect(can('EDITOR', 'approval', 'approve')).toBe(false);
      expect(can('EDITOR', 'approval', 'request_changes')).toBe(false);
      expect(can('EDITOR', 'approval', 'reject')).toBe(false);
    });

    it('CANNOT publish or schedule', () => {
      expect(can('EDITOR', 'post', 'publish')).toBe(false);
      expect(can('EDITOR', 'post', 'schedule')).toBe(false);
    });

    it('has no billing access at all', () => {
      for (const action of NASHR_ACTIONS) {
        expect(can('EDITOR', 'billing', action)).toBe(false);
      }
    });
  });

  describe('APPROVER', () => {
    it('can make review decisions', () => {
      expect(can('APPROVER', 'approval', 'approve')).toBe(true);
      expect(can('APPROVER', 'approval', 'request_changes')).toBe(true);
      expect(can('APPROVER', 'approval', 'reject')).toBe(true);
    });

    it('cannot author or publish content', () => {
      expect(can('APPROVER', 'post', 'create')).toBe(false);
      expect(can('APPROVER', 'post', 'update')).toBe(false);
      expect(can('APPROVER', 'post', 'delete')).toBe(false);
      expect(can('APPROVER', 'post', 'publish')).toBe(false);
      expect(can('APPROVER', 'post', 'schedule')).toBe(false);
    });
  });

  describe('CLIENT', () => {
    it('CANNOT edit anything', () => {
      for (const resource of NASHR_RESOURCES) {
        for (const action of ['create', 'update', 'delete'] as const) {
          expect(can('CLIENT', resource, action)).toBe(false);
        }
      }
    });

    it('can read their own brand and give client approval', () => {
      expect(can('CLIENT', 'post', 'read')).toBe(true);
      expect(can('CLIENT', 'brand', 'read')).toBe(true);
      expect(can('CLIENT', 'analytics', 'read')).toBe(true);
      expect(can('CLIENT', 'approval', 'approve')).toBe(true);
      expect(can('CLIENT', 'approval', 'request_changes')).toBe(true);
      expect(can('CLIENT', 'approval', 'reject')).toBe(true);
    });

    it('cannot submit, schedule, publish, or touch team/billing/webhooks', () => {
      expect(can('CLIENT', 'approval', 'submit')).toBe(false);
      expect(can('CLIENT', 'post', 'schedule')).toBe(false);
      expect(can('CLIENT', 'post', 'publish')).toBe(false);
      expect(can('CLIENT', 'team_member', 'read')).toBe(false);
      expect(can('CLIENT', 'billing', 'read')).toBe(false);
      expect(can('CLIENT', 'webhook', 'read')).toBe(false);
    });

    it('is brand-scoped — it must never see the whole organization', () => {
      expect(scopeFor('CLIENT')).toBe('own_brand');
      expect(isBrandScoped('CLIENT')).toBe(true);
    });
  });

  describe('VIEWER', () => {
    it('holds read and nothing else', () => {
      for (const [, action] of permissionsFor('VIEWER')) {
        expect(action).toBe('read');
      }
    });

    it('cannot approve, submit, schedule or publish', () => {
      expect(can('VIEWER', 'approval', 'approve')).toBe(false);
      expect(can('VIEWER', 'approval', 'submit')).toBe(false);
      expect(can('VIEWER', 'post', 'schedule')).toBe(false);
      expect(can('VIEWER', 'post', 'publish')).toBe(false);
      expect(can('VIEWER', 'post', 'create')).toBe(false);
    });
  });

  describe('scope defaults', () => {
    it('gives unknown roles the narrowest scope, never the widest', () => {
      expect(scopeFor('WHO_IS_THIS')).toBe('own_brand');
      expect(scopeFor(undefined)).toBe('own_brand');
      expect(isBrandScoped(null)).toBe(true);
    });

    it('gives staff roles organization scope', () => {
      for (const role of ['OWNER', 'ADMIN', 'EDITOR', 'APPROVER', 'VIEWER'] as const) {
        expect(scopeFor(role)).toBe('organization');
      }
    });
  });

  describe('firstDenied', () => {
    it('returns null when every permission is held', () => {
      expect(
        firstDenied('OWNER', [
          ['post', 'create'],
          ['billing', 'update'],
        ])
      ).toBeNull();
    });

    it('names the first missing permission', () => {
      expect(
        firstDenied('EDITOR', [
          ['post', 'create'],
          ['approval', 'approve'],
          ['billing', 'update'],
        ])
      ).toEqual({ resource: 'approval', action: 'approve', role: 'EDITOR' });
    });

    it('denies everything for an unknown role', () => {
      expect(firstDenied('GHOST', [['post', 'read']])).toEqual({
        resource: 'post',
        action: 'read',
        role: 'GHOST',
      });
    });

    it('reports UNKNOWN when the role is not even a string', () => {
      expect(firstDenied(null, [['post', 'read']])).toEqual({
        resource: 'post',
        action: 'read',
        role: 'UNKNOWN',
      });
    });
  });

  describe('permissionsFor', () => {
    it('returns nothing for an unknown role', () => {
      expect(permissionsFor('NOPE')).toEqual([]);
      expect(permissionsFor(undefined)).toEqual([]);
    });

    it('agrees with can() for every declared combination', () => {
      for (const role of NASHR_ROLES) {
        const held = new Set(
          permissionsFor(role).map(([r, a]) => `${r}:${a}`)
        );
        for (const resource of NASHR_RESOURCES) {
          for (const action of NASHR_ACTIONS) {
            expect(can(role, resource, action)).toBe(
              held.has(`${resource}:${action}`)
            );
          }
        }
      }
    });
  });
});
