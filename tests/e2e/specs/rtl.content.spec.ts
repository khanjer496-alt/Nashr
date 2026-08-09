import { test, expect, LOCALE_COOKIE } from '../fixtures/locale';
import { stabilise } from '../helpers/rtl';

/**
 * Content-level checks: is the page actually *in* the selected language, and
 * when does it become so?
 *
 * Direction and translation are separate mechanisms in this app:
 *  - `dir`/`lang` come from `next/headers` cookies in `app/(app)/layout.tsx`
 *    and are therefore server-rendered;
 *  - the strings come from `useT()` -> i18next with
 *    `detection: { order: ['cookie', 'header'] }` and the *browser* language
 *    detector, which cannot read `document.cookie` during SSR.
 *
 * So the server render is English even for an Arabic session. These tests pin
 * that behaviour down rather than assuming it.
 */

const ARABIC = /[؀-ۿ]/;

test('server-rendered body copy language', async ({ request, nashrLocale }, testInfo) => {
  const res = await request.get('/auth/login', {
    headers: { cookie: `${LOCALE_COOKIE}=${nashrLocale}` },
  });
  const html = await res.text();
  const body = html.slice(html.indexOf('<body'));
  const visible = body
    .replace(/<script[\s\S]*?<\/script>/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const arabicChars = (visible.match(/[؀-ۿ]/g) || []).length;
  await testInfo.attach('ssr-visible-text.txt', {
    body: `${nashrLocale}: arabicChars=${arabicChars}\n\n${visible.slice(0, 800)}`,
    contentType: 'text/plain',
  });

  if (nashrLocale.startsWith('ar')) {
    // Documents the known limitation: i18next resolves the locale in the
    // browser, so the first paint of an Arabic session is English copy inside
    // a correctly right-to-left document.
    expect(
      arabicChars,
      'If this now finds Arabic in the SSR output, server-side i18next ' +
        'resolution has been added — update RTL_VERIFICATION.md, this is an improvement.'
    ).toBe(0);
  }
});

test('copy is translated after hydration', async ({ page, nashrLocale }) => {
  await page.goto('/auth/login', { waitUntil: 'domcontentloaded' });
  await stabilise(page);
  await page.waitForTimeout(1500);

  const text = await page.evaluate(() => document.body.innerText);
  if (nashrLocale.startsWith('ar')) {
    expect(ARABIC.test(text), 'Arabic session must show Arabic copy once hydrated').toBe(
      true
    );
    // Spot-check real keys from the login form rather than "some Arabic exists".
    expect(text).toContain('تسجيل الدخول'); // sign_in
    expect(text).toContain('كلمة المرور'); // label_password
  } else {
    expect(text).toContain('Sign In');
  }
});

/**
 * The public legal pages are hardcoded English JSX (no `useT()` anywhere in
 * `app/(app)/(site)/{about,terms,privacy,licenses}/page.tsx`). They mirror
 * correctly but never translate. Asserted so the day someone wires them up,
 * this test fails and the docs get updated.
 */
/** Visible copy only: strips scripts (the RSC flight payload embeds the locale). */
const visibleText = (html: string) =>
  html
    .slice(html.indexOf('<body'))
    .replace(/<script[\s\S]*?<\/script>/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

for (const p of ['/about', '/terms', '/privacy', '/licenses']) {
  test(`legal page copy is language-independent: ${p}`, async ({ request }) => {
    const [en, ar] = await Promise.all([
      request.get(p, { headers: { cookie: `${LOCALE_COOKIE}=en` } }),
      request.get(p, { headers: { cookie: `${LOCALE_COOKIE}=ar` } }),
    ]);
    const enBody = await en.text();
    const arBody = await ar.text();

    // The document attributes and the serialised RSC props legitimately differ
    // (they carry the locale). The *visible copy* is what matters here: these
    // pages hold no `useT()` call, so it is identical in every language.
    expect(
      visibleText(enBody),
      `${p} now renders different copy in Arabic — it may have been translated. ` +
        `If so that is an improvement: update RTL_VERIFICATION.md and delete this test.`
    ).toBe(visibleText(arBody));

    // ...but the document must still mirror.
    expect(arBody).toContain('dir="rtl"');
    expect(enBody).toContain('dir="ltr"');
  });
}
