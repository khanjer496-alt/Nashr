import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '../../..');
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

describe('public product copy', () => {
  it('presents a global product with first-class interfaces', () => {
    const about = read('apps/frontend/src/app/(app)/(site)/about/page.tsx');

    expect(about).toContain('Social publishing infrastructure');
    expect(about).toContain('humans and AI agents');
    expect(about).toContain('One publishing system, every interface');
    expect(about).toMatch(/API/);
    expect(about).toMatch(/MCP/);
    expect(about).toMatch(/CLI/);
    expect(about).not.toMatch(
      /built for teams working in the Middle East|Gulf time by default|Initial market:/
    );
  });

  it('keeps Arabic and regional workflows as localization strengths', () => {
    const about = read('apps/frontend/src/app/(app)/(site)/about/page.tsx');

    expect(about).toMatch(/Arabic/);
    expect(about).toMatch(/right-to-left|RTL/);
    expect(about).toMatch(/Ramadan|Eid|Hijri/);
  });

  it('describes a maintained Postiz fork without regional primacy', () => {
    const licenses = read(
      'apps/frontend/src/app/(app)/(site)/licenses/page.tsx'
    );

    expect(licenses).toContain('Postiz');
    expect(licenses).toContain('FORK_CUSTOMIZATIONS.md');
    expect(licenses).not.toContain('MENA_CUSTOMIZATIONS.md');
  });
});
