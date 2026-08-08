import { test, expect, LOCALE_COOKIE } from '../fixtures/locale';
import { PUBLIC_ROUTES } from '../pages';
import { collectRtlDiagnostics, stabilise } from '../helpers/rtl';

/**
 * The Phase 3 claim under test: `<html dir>`/`lang` are emitted *server-side*
 * from the locale cookie, so an Arabic session never first-paints
 * left-to-right and then snaps.
 *
 * Checking `document.documentElement.dir` in the DOM is not sufficient — a
 * client `useEffect` would satisfy that too. These tests read the raw response
 * body and additionally render with JavaScript switched off, which is the only
 * way to prove the attribute came from the server.
 */

for (const route of PUBLIC_ROUTES) {
  test(`raw server HTML carries dir/lang: ${route.name}`, async ({
    request,
    nashrLocale,
    expectedDir,
  }) => {
    const res = await request.get(route.path, {
      headers: { cookie: `${LOCALE_COOKIE}=${nashrLocale}` },
    });
    expect(res.status()).toBeLessThan(400);
    const body = await res.text();

    const htmlTag = body.match(/<html[^>]*>/i)?.[0] ?? '';
    expect(htmlTag, 'response must contain an <html> tag').not.toBe('');

    // Parsed out of the raw bytes: no JS has run at this point.
    expect(htmlTag, `raw HTML for ${route.path} must declare dir`).toContain(
      `dir="${expectedDir}"`
    );
    expect(htmlTag, `raw HTML for ${route.path} must declare lang`).toContain(
      `lang="${nashrLocale}"`
    );
  });
}

test('direction is correct with JavaScript disabled (no flash of wrong direction)', async ({
  browser,
  nashrLocale,
  expectedDir,
  baseURL,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  await context.addCookies([
    {
      name: LOCALE_COOKIE,
      value: nashrLocale,
      domain: new URL(baseURL!).hostname,
      path: '/',
    },
  ]);
  const page = await context.newPage();
  await page.goto('/auth/login', { waitUntil: 'domcontentloaded' });

  // With JS off, anything present here was produced by the server.
  expect(await page.evaluate(() => document.documentElement.dir)).toBe(expectedDir);
  expect(await page.evaluate(() => document.documentElement.lang)).toBe(nashrLocale);
  expect(
    await page.evaluate(() => getComputedStyle(document.body).direction)
  ).toBe(expectedDir);

  await context.close();
});

test('direction does not change between first paint and hydration', async ({
  page,
  expectedDir,
}) => {
  // `commit` resolves as soon as the response starts, before scripts execute.
  await page.goto('/auth/login', { waitUntil: 'commit' });
  const atCommit = await page.evaluate(() => document.documentElement.dir);

  await stabilise(page);
  await page.waitForTimeout(1500);
  const afterHydration = await page.evaluate(() => document.documentElement.dir);

  expect(atCommit, 'dir must already be set on the first response').toBe(expectedDir);
  expect(
    afterHydration,
    'dir must not change once React hydrates — a change here is a visible snap'
  ).toBe(atCommit);
});

test('unshipped regional locale degrades to its base language, not to English', async ({
  request,
}) => {
  // `ar-QA` is not in `languages`; `resolveSupportedLanguage` should land on `ar`.
  const res = await request.get('/auth/login', {
    headers: { cookie: `${LOCALE_COOKIE}=ar-QA` },
  });
  const htmlTag = (await res.text()).match(/<html[^>]*>/i)?.[0] ?? '';
  expect(htmlTag).toContain('dir="rtl"');
  expect(htmlTag).toContain('lang="ar"');
});

test('a junk locale cookie falls back to English rather than breaking the document', async ({
  request,
}) => {
  const res = await request.get('/auth/login', {
    headers: { cookie: `${LOCALE_COOKIE}=zz-ZZ` },
  });
  const htmlTag = (await res.text()).match(/<html[^>]*>/i)?.[0] ?? '';
  expect(htmlTag).toContain('dir="ltr"');
  expect(htmlTag).toContain('lang="en"');
});

test('direction-aware centring variable flips with the document', async ({
  page,
  expectedDir,
}) => {
  await page.goto('/auth/login', { waitUntil: 'domcontentloaded' });
  await stabilise(page);
  const d = await collectRtlDiagnostics(page);
  // `--nashr-center-x` is the fix for the off-screen toast: `translateX` is
  // physical, so the half-step has to invert under RTL.
  expect(d.centerXVar).toBe(expectedDir === 'rtl' ? '50%' : '-50%');
});
