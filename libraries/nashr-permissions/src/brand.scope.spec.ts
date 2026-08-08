import { resolveBrandScope } from './brand.scope';

describe('brand scope', () => {
  it('gives staff roles organization-wide access', () => {
    for (const role of ['OWNER', 'ADMIN', 'EDITOR', 'APPROVER', 'VIEWER']) {
      expect(resolveBrandScope(role, null, {}).allowedCustomerIds).toBeNull();
    }
  });

  it('restricts a CLIENT to the brand they are linked to', () => {
    const r = resolveBrandScope('CLIENT', { nashrCustomerId: 'cus_1' }, {});
    expect(r.allowedCustomerIds).toEqual(['cus_1']);
  });

  it('fails closed when a CLIENT has no brand link', () => {
    const r = resolveBrandScope('CLIENT', {}, {});
    expect(r.allowedCustomerIds).toEqual([]);
    expect(r.warning).toContain('fail closed');
  });

  it('fails closed for an unknown role', () => {
    expect(resolveBrandScope('HACKER', {}, {}).allowedCustomerIds).toEqual([]);
    expect(resolveBrandScope(null, null, {}).allowedCustomerIds).toEqual([]);
  });

  it('degrades to org scope only with the explicit escape hatch, and warns', () => {
    const r = resolveBrandScope('CLIENT', {}, {
      NASHR_CLIENT_SCOPE_ENFORCEMENT: 'org',
    });
    expect(r.allowedCustomerIds).toBeNull();
    expect(r.warning).toContain('Unsafe');
  });

  it('ignores an empty-string brand link', () => {
    expect(
      resolveBrandScope('CLIENT', { nashrCustomerId: '' }, {}).allowedCustomerIds
    ).toEqual([]);
  });
});
