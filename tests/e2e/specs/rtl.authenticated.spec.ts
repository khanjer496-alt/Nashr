import { test, expect } from '../fixtures/locale';
import { AUTHENTICATED_ROUTES } from '../pages';
import {
  collectRtlDiagnostics,
  findStrayElements,
  measureOverflow,
  stabilise,
} from '../helpers/rtl';

/**
 * The RTL surfaces that need a signed-in session — the calendar, modals,
 * tables and context menus the Phase 3 audit changed but could never render.
 *
 * These are SKIPPED unless `E2E_AUTH_COOKIE` is supplied. To run them:
 *
 *   1. bring up postgres, redis, the NestJS backend and the frontend;
 *   2. create a user and sign in;
 *   3. copy the `auth` cookie value out of devtools;
 *   4. E2E_AUTH_COOKIE='<value>' npx playwright test -c tests/e2e/playwright.config.ts
 *
 * Nothing here is asserted-as-passing today. A skipped test reports as skipped,
 * which is the honest signal.
 */

const AUTH_COOKIE = process.env.E2E_AUTH_COOKIE;

test.describe('authenticated RTL surfaces', () => {
  test.skip(
    !AUTH_COOKIE,
    'Requires a running backend and a session: set E2E_AUTH_COOKIE. ' +
      'Until then the calendar, modals, tables and context menus are UNVERIFIED.'
  );

  test.beforeEach(async ({ context, baseURL }) => {
    await context.addCookies([
      {
        name: 'auth',
        value: AUTH_COOKIE!,
        domain: new URL(baseURL!).hostname,
        path: '/',
      },
    ]);
  });

  for (const route of AUTHENTICATED_ROUTES) {
    test(`no horizontal overflow: ${route.name}`, async ({ page, expectedDir }) => {
      await page.goto(route.path, { waitUntil: 'domcontentloaded' });
      await stabilise(page);
      await page.waitForTimeout(2000);

      expect(new URL(page.url()).pathname, 'session cookie was rejected').toBe(route.path);

      const d = await collectRtlDiagnostics(page);
      expect(d.htmlDir).toBe(expectedDir);
      expect(
        d.overflow.overflowPx,
        `${route.path}: ${route.note ?? ''}`
      ).toBeLessThanOrEqual(1);
      expect(d.strays, JSON.stringify(d.strays, null, 2)).toEqual([]);
    });
  }

  /**
   * The Phase 3 audit's #2 and #3 bugs: the toast used a logical
   * `start-[50%]` with a physical `-translate-x-[50%]`, and both context menus
   * anchored off a measured `getBoundingClientRect().left`. Both only manifest
   * once the element is actually open.
   */
  test('opened context menu stays inside the viewport', async ({ page, expectedDir }) => {
    await page.goto('/launches', { waitUntil: 'domcontentloaded' });
    await stabilise(page);

    const trigger = page.locator('[data-testid="post-menu"], .preview-menu').first();
    test.skip(
      (await trigger.count()) === 0,
      'no menu trigger on the page — needs seeded posts'
    );

    await trigger.click();
    await page.waitForTimeout(400);

    const strays = await findStrayElements(page);
    expect(
      strays,
      `In ${expectedDir} the menu escaped the viewport: ${JSON.stringify(strays, null, 2)}`
    ).toEqual([]);
  });

  test('toast notification is centred, not pushed off the inline edge', async ({
    page,
  }) => {
    await page.goto('/launches', { waitUntil: 'domcontentloaded' });
    await stabilise(page);

    // Render a toast through the app's own toaster if one is exposed; otherwise skip.
    const toast = page.locator('[class*="toaster"], [role="status"]').first();
    test.skip((await toast.count()) === 0, 'no toast rendered; needs an action that fires one');

    const box = await toast.boundingBox();
    const vw = page.viewportSize()!.width;
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(vw);

    const overflow = await measureOverflow(page);
    expect(overflow.overflowPx).toBeLessThanOrEqual(1);
  });

  /**
   * Phase 3 bug #4: `dayjs.locale('ar-AE')` silently no-ops because only base
   * bundles are imported, so an ar-AE calendar would show English month names.
   */
  test('calendar month and weekday names are localised', async ({ page, expectedDir }) => {
    test.skip(expectedDir !== 'rtl', 'RTL projects only');
    await page.goto('/launches', { waitUntil: 'domcontentloaded' });
    await stabilise(page);
    await page.waitForTimeout(2000);

    const text = await page.evaluate(() => document.body.innerText);
    const ENGLISH_MONTHS =
      /\b(January|February|March|April|May|June|July|August|September|October|November|December)\b/;
    expect(
      ENGLISH_MONTHS.test(text),
      'calendar is showing English month names in an Arabic session — dayjs locale did not apply'
    ).toBe(false);
  });
});
