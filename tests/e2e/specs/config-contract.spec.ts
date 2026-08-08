import { test, expect, LOCALE_COOKIE } from '../fixtures/locale';
import { PUBLIC_ROUTES } from '../pages';
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Guards the assumptions this suite hardcodes against the app source.
 *
 * Without these, a rename in the app would not fail a test — it would silently
 * make every "Arabic" screenshot English, which is the worst possible failure
 * mode for a visual QA suite.
 */

const REPO = path.resolve(__dirname, '../../..');

test('locale cookie name matches i18n.config.ts', () => {
  const src = fs.readFileSync(
    path.join(REPO, 'libraries/react-shared-libraries/src/translation/i18n.config.ts'),
    'utf8'
  );
  const m = src.match(/export const cookieName\s*=\s*['"]([^'"]+)['"]/);
  expect(m, 'could not find cookieName in i18n.config.ts').not.toBeNull();
  expect(m![1]).toBe(LOCALE_COOKIE);
});

test('public route allow-list matches proxy.ts', () => {
  const src = fs.readFileSync(path.join(REPO, 'apps/frontend/src/proxy.ts'), 'utf8');
  const m = src.match(/const publicPages\s*=\s*\[([^\]]+)\]/);
  expect(m, 'could not find publicPages in proxy.ts').not.toBeNull();
  const declared = [...m![1].matchAll(/['"]([^'"]+)['"]/g)].map((x) => x[1]).sort();

  const covered = PUBLIC_ROUTES.map((r) => r.path).filter((p) => !p.startsWith('/auth'));
  expect(
    covered.sort(),
    'proxy.ts allows a public page this suite never screenshots (or vice versa)'
  ).toEqual(declared);
});

test('rtl languages list still contains Arabic', () => {
  const src = fs.readFileSync(
    path.join(REPO, 'libraries/react-shared-libraries/src/translation/i18n.config.ts'),
    'utf8'
  );
  const m = src.match(/export const rtlLanguages\s*=\s*\[([^\]]+)\]/);
  expect(m).not.toBeNull();
  expect(m![1]).toContain("'ar'");
});
