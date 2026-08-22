import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '../../..');
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

describe('public product copy', () => {
  it('exposes an honest signed-out root landing page', () => {
    const proxy = read('apps/frontend/src/proxy.ts');
    const landing = read(
      'apps/frontend/src/components/marketing/landing.page.tsx'
    );

    expect(proxy).toContain("nextUrl.pathname === '/' && !authCookie");
    expect(landing).toContain('brand.heroLine');
    expect(landing).toContain('brand.tagline');
    expect(landing).toMatch(/Web/);
    expect(landing).toMatch(/API/);
    expect(landing).toMatch(/MCP/);
    expect(landing).toMatch(/CLI/);
    expect(landing).toMatch(/Arabic/);
    expect(landing).toMatch(/RTL/);
    expect(landing).not.toMatch(/\$\d+|\d+[,+] users|trusted by \d+/i);
  });

  it('keeps open-source positioning quiet and confined to the footer', () => {
    const landing = read(
      'apps/frontend/src/components/marketing/landing.page.tsx'
    );
    const shell = read('apps/frontend/src/components/layout/public.shell.tsx');
    const footer = read('apps/frontend/src/components/layout/brand.footer.tsx');

    expect(landing).not.toMatch(/open source|Postiz|AGPL|self-host/i);
    expect(shell).not.toMatch(/open source/i);
    expect(footer).toContain('Proudly open source');
    expect(footer).toContain('brand.sourceUrl');
  });

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

  it('contains no legacy customer-facing Nashr name', () => {
    const customerPages = [
      'apps/frontend/src/app/(app)/(site)/about/page.tsx',
      'apps/frontend/src/app/(app)/auth/layout.tsx',
      'apps/frontend/src/components/layout/public.shell.tsx',
      'apps/frontend/src/components/marketing/landing.page.tsx',
    ]
      .map(read)
      .join('\n');

    expect(customerPages).not.toMatch(/\bNashr\b/);
    expect(customerPages).toContain('brand.name');
  });

  it('describes a maintained Postiz fork without regional primacy', () => {
    const licenses = read(
      'apps/frontend/src/app/(app)/(site)/licenses/page.tsx'
    );

    expect(licenses).toContain('Postiz');
    expect(licenses).toContain('FORK_CUSTOMIZATIONS.md');
    expect(licenses).not.toContain(['MENA', 'CUSTOMIZATIONS.md'].join('_'));
  });
});

describe('global framework defaults', () => {
  it('uses UTC for browser tests unless a test overrides it', () => {
    const config = read('tests/e2e/playwright.config.ts');
    expect(config).toContain("process.env.E2E_TZ || 'UTC'");
    expect(config).not.toContain("process.env.E2E_TZ || 'Asia/Dubai'");
  });

  it('retains regional locale overlays without describing them as primary', () => {
    const config = read(
      'libraries/react-shared-libraries/src/translation/i18n.config.ts'
    );
    expect(config).toMatch(/en-AE/);
    expect(config).toMatch(/ar-AE/);
    expect(config).toMatch(/optional regional locale overlays/i);
    expect(config).not.toMatch(/Nashr MENA regional locales/i);
  });
});

describe('fork customization ledger', () => {
  it('uses a general ledger name and leaves no stale references', () => {
    const legacyLedger = ['MENA', 'CUSTOMIZATIONS.md'].join('_');
    expect(fs.existsSync(path.join(root, 'FORK_CUSTOMIZATIONS.md'))).toBe(true);
    expect(fs.existsSync(path.join(root, legacyLedger))).toBe(false);

    const trackedReferences = [
      'README.md',
      'FEATURES.md',
      'DEPLOYMENT.md',
      'LAUNCH_READINESS.md',
      'RISK_REGISTER.md',
      'OPEN_SOURCE_COMPLIANCE.md',
      'AUDIT_REPORT.md',
      'IMPLEMENTATION_PLAN.md',
      'TEST_PLAN.md',
    ]
      .filter((file) => fs.existsSync(path.join(root, file)))
      .map(read)
      .join('\n');

    expect(trackedReferences).not.toContain(legacyLedger);
    expect(read('FORK_CUSTOMIZATIONS.md')).toMatch(
      /^# Fork Customizations and Maintenance Ledger/m
    );
  });
});
