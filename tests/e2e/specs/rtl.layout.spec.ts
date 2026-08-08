import { test, expect } from '../fixtures/locale';
import { PUBLIC_ROUTES } from '../pages';
import {
  collectRtlDiagnostics,
  platformFontsFor,
  stabilise,
  tagFirstArabicElement,
} from '../helpers/rtl';
import * as path from 'node:path';
import * as fs from 'node:fs';

/**
 * Layout-level RTL assertions. These are the checks that catch bugs a
 * screenshot review would miss, because the offending element is off-screen.
 */

const DIAG_DIR = path.resolve(__dirname, '../.output/diagnostics');

test.beforeAll(() => fs.mkdirSync(DIAG_DIR, { recursive: true }));

for (const route of PUBLIC_ROUTES) {
  test(`no horizontal overflow: ${route.name}`, async ({
    page,
    langTag,
    expectedDir,
  }, testInfo) => {
    await page.goto(route.path, { waitUntil: 'domcontentloaded' });
    await stabilise(page);
    await page.waitForTimeout(1000);

    const d = await collectRtlDiagnostics(page);

    const width = testInfo.project.use.viewport?.width ?? 0;
    fs.writeFileSync(
      path.join(DIAG_DIR, `${route.name}-${langTag}-${width}.json`),
      JSON.stringify(d, null, 2)
    );
    await testInfo.attach(`diagnostics-${route.name}-${langTag}-${width}`, {
      body: JSON.stringify(d, null, 2),
      contentType: 'application/json',
    });

    expect(d.htmlDir).toBe(expectedDir);

    // The automatic catch for the off-screen-element class of bug.
    expect(
      d.overflow.overflowPx,
      `${route.path} scrolls horizontally by ${d.overflow.overflowPx}px ` +
        `(scrollWidth ${d.overflow.scrollWidth} vs clientWidth ${d.overflow.clientWidth})`
    ).toBeLessThanOrEqual(1);
  });

  test(`no element escapes the viewport: ${route.name}`, async ({ page }) => {
    await page.goto(route.path, { waitUntil: 'domcontentloaded' });
    await stabilise(page);
    await page.waitForTimeout(1000);

    const d = await collectRtlDiagnostics(page);
    expect(
      d.strays,
      `elements outside the viewport:\n${JSON.stringify(d.strays, null, 2)}`
    ).toEqual([]);
  });
}

test('Arabic text is right-aligned and keeps its letter joins', async ({
  page,
  expectedDir,
}) => {
  test.skip(expectedDir !== 'rtl', 'RTL projects only');

  await page.goto('/auth/login', { waitUntil: 'domcontentloaded' });
  await stabilise(page);
  await page.waitForTimeout(1500);

  const d = await collectRtlDiagnostics(page);
  expect(d.arabicCharCount, 'page must actually contain Arabic copy').toBeGreaterThan(10);

  for (const s of d.fonts.sample) {
    expect(s.direction, `${s.tag} "${s.text}" must compute direction:rtl`).toBe('rtl');
    // Arabic is cursive: any positive tracking severs the joins between
    // letters and renders a word as loose disconnected glyphs.
    expect(
      s.letterSpacing,
      `${s.tag} "${s.text}" has letter-spacing ${s.letterSpacing}; Arabic must be "normal"`
    ).toBe('normal');
    // `left` would mean a physical property survived the RTL conversion.
    expect(
      ['start', 'right', 'center', 'justify'],
      `${s.tag} "${s.text}" resolved text-align:${s.textAlign}`
    ).toContain(s.textAlign);
  }
});

/**
 * Does an Arabic *typeface* actually reach the user?
 *
 * `font-family` only records what was requested. `CSS.getPlatformFontsForNode`
 * reports the faces Chrome really used, and `isCustomFont` distinguishes a
 * downloaded webfont from a host-OS font. The Nashr Arabic stack ships no
 * `@font-face`, so on a machine without the named families installed this test
 * documents exactly which fallback the user gets.
 */
test('Arabic glyphs are drawn by a font the product actually ships', async ({
  page,
  expectedDir,
}, testInfo) => {
  test.skip(expectedDir !== 'rtl', 'RTL projects only');

  await page.goto('/auth/login', { waitUntil: 'domcontentloaded' });
  await stabilise(page);
  await page.waitForTimeout(1500);

  const selector = await tagFirstArabicElement(page);
  expect(selector, 'no Arabic text found to measure').not.toBeNull();

  const fonts = await platformFontsFor(page, selector!);
  const diagnostics = await collectRtlDiagnostics(page);

  await testInfo.attach('arabic-platform-fonts.json', {
    body: JSON.stringify(
      { platformFonts: fonts, loadedWebfonts: diagnostics.fonts.loadedFontFamilies },
      null,
      2
    ),
    contentType: 'application/json',
  });

  expect(fonts.length, 'Chrome reported no font for the Arabic text').toBeGreaterThan(0);

  const NAMED_ARABIC = [
    'IBM Plex Sans Arabic',
    'Noto Kufi Arabic',
    'Noto Sans Arabic',
    'SF Arabic',
    'Geeza Pro',
    'Dubai',
    'Tahoma',
  ];
  const usedNamed = fonts.filter((f) =>
    NAMED_ARABIC.some((n) => f.familyName.includes(n))
  );

  expect(
    usedNamed.length,
    `Arabic glyphs were rasterised by ${fonts
      .map((f) => `${f.familyName} (custom=${f.isCustomFont}, ${f.glyphCount} glyphs)`)
      .join(', ')} — none of the declared Nashr Arabic families. The stack in ` +
      `global.scss has no @font-face behind it, so the face depends entirely on ` +
      `what the client OS happens to have installed.`
  ).toBeGreaterThan(0);
});
