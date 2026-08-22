import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '../../..');
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

describe('global repository documentation', () => {
  it('introduces the fork and its approved direction', () => {
    const readme = read('README.md');
    expect(readme).toContain(
      'Social publishing infrastructure for humans and AI agents'
    );
    expect(readme).toContain('Postiz');
    expect(readme).toContain('AGPL-3.0');
    expect(readme).toContain('FORK_CUSTOMIZATIONS.md');
  });

  it('labels superseded regional launch assumptions', () => {
    expect(read('PRICING_RECOMMENDATIONS.md')).toMatch(
      /historical|superseded/i
    );
    expect(read('LAUNCH_READINESS.md')).toMatch(/global-first/i);
  });

  it('documents the approved hybrid Cloudflare deployment', () => {
    const deployment = read('DEPLOYMENT.md');
    expect(deployment).toMatch(/Cloudflare/i);
    expect(deployment).toMatch(/R2/);
    expect(deployment).toMatch(/Docker/);
    expect(deployment).toMatch(/PostgreSQL/);
    expect(deployment).toMatch(/Redis/);
    expect(deployment).toMatch(/Temporal/);
  });
});
