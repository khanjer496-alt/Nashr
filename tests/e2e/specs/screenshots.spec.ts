import { test, expect } from '../fixtures/locale';
import { PUBLIC_ROUTES, AUTHENTICATED_ROUTES } from '../pages';
import { stabilise } from '../helpers/rtl';
import * as path from 'node:path';
import * as fs from 'node:fs';

/**
 * Captures the EN/AR screenshot pairs Phase 8 needs.
 *
 * Filenames: `docs/screenshots/<page>-<lang>.png` at 1440x900, and
 * `docs/screenshots/<page>-<lang>-375.png` at the narrow viewport. Full-page
 * so a component that overflows below the fold still lands in the image.
 */

const SCREENSHOT_DIR = path.resolve(__dirname, '../../../docs/screenshots');

test.beforeAll(() => {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
});

for (const route of PUBLIC_ROUTES) {
  test(`screenshot ${route.name}`, async ({ page, langTag }, testInfo) => {
    const width = testInfo.project.use.viewport?.width ?? 0;
    const suffix = width <= 480 ? `-${width}` : '';
    const file = path.join(
      SCREENSHOT_DIR,
      `${route.name}-${langTag}${suffix}.png`
    );

    const response = await page.goto(route.path, { waitUntil: 'domcontentloaded' });
    expect(
      response?.status(),
      `${route.path} must render, not error or redirect to an error`
    ).toBeLessThan(400);

    // Translations are applied client-side by i18next, so the Arabic copy only
    // exists after hydration. Wait for that before capturing, otherwise every
    // "Arabic" screenshot would show the English server render.
    await stabilise(page);
    await page.waitForTimeout(1200);

    await page.screenshot({ path: file, fullPage: true });
    await testInfo.attach(`${route.name}-${langTag}${suffix}`, {
      path: file,
      contentType: 'image/png',
    });

    expect(fs.existsSync(file), `expected ${file} to be written`).toBe(true);
    expect(fs.statSync(file).size, 'screenshot must not be empty').toBeGreaterThan(1000);
  });
}

/**
 * Not skipped silently: this test *reports* the uncovered surface so a run's
 * output always states what was not captured and why.
 */
test('authenticated routes are not reachable without a backend session', async ({
  page,
}, testInfo) => {
  const unreachable: string[] = [];
  for (const route of AUTHENTICATED_ROUTES) {
    const res = await page.goto(route.path, { waitUntil: 'domcontentloaded' });
    const landedOn = new URL(page.url()).pathname;
    if (landedOn !== route.path) {
      unreachable.push(
        `${route.path} -> redirected to ${landedOn} (${res?.status()}). ${route.note ?? ''}`
      );
    }
  }
  await testInfo.attach('unreachable-routes.txt', {
    body: unreachable.join('\n'),
    contentType: 'text/plain',
  });
  // Assert the *gate*, not the pages: with no auth cookie every one of these
  // must bounce. If one ever does not, the auth gate has regressed.
  expect(unreachable.length).toBe(AUTHENTICATED_ROUTES.length);
});
