import type { Page } from '@playwright/test';

/** Range covering Arabic, Arabic Supplement and Arabic Presentation Forms. */
export const ARABIC_RE =
  /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/;

export interface OverflowReport {
  scrollWidth: number;
  clientWidth: number;
  /** Positive => the document scrolls sideways, which it never should. */
  overflowPx: number;
  hasHorizontalOverflow: boolean;
}

export interface StrayElement {
  selector: string;
  text: string;
  left: number;
  right: number;
  width: number;
}

export interface FontUsage {
  /** Sample of elements that actually contain Arabic text. */
  sample: {
    tag: string;
    text: string;
    fontFamily: string;
    letterSpacing: string;
    textAlign: string;
    direction: string;
    lineHeight: string;
  }[];
  /** Families registered via `document.fonts` (i.e. actually downloaded). */
  loadedFontFamilies: string[];
}

export interface RtlDiagnostics {
  htmlDir: string;
  htmlLang: string;
  bodyDirection: string;
  centerXVar: string;
  overflow: OverflowReport;
  strays: StrayElement[];
  fonts: FontUsage;
  arabicCharCount: number;
}

/**
 * Reads `document.documentElement`'s scroll vs client width.
 *
 * This is the cheap automatic catch for the whole off-screen-element class of
 * RTL bug (the Phase 3 toaster bug being the canonical example): an element
 * pushed past the inline-end edge widens the scrollable area even when it is
 * invisible in a screenshot.
 */
export async function measureOverflow(page: Page): Promise<OverflowReport> {
  return page.evaluate(() => {
    const el = document.documentElement;
    const overflowPx = el.scrollWidth - el.clientWidth;
    return {
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
      overflowPx,
      hasHorizontalOverflow: overflowPx > 1,
    };
  });
}

/**
 * Finds visible elements whose box escapes the viewport horizontally.
 *
 * Deliberately ignores:
 *  - zero-area and `visibility/display`-hidden nodes,
 *  - elements that are intentionally full-bleed *and* wider than the viewport
 *    only because an ancestor clips them (`overflow: hidden`),
 * because both produce noise rather than real bugs. A 2px tolerance absorbs
 * sub-pixel layout rounding.
 */
export async function findStrayElements(
  page: Page,
  tolerance = 2
): Promise<StrayElement[]> {
  return page.evaluate((tol) => {
    const vw = document.documentElement.clientWidth;
    const out: StrayElement[] = [];

    const describe = (el: Element) => {
      const id = el.id ? `#${el.id}` : '';
      const cls =
        typeof el.className === 'string' && el.className.trim()
          ? '.' + el.className.trim().split(/\s+/).slice(0, 3).join('.')
          : '';
      return `${el.tagName.toLowerCase()}${id}${cls}`;
    };

    /** True when some ancestor clips horizontal overflow, so escaping is invisible. */
    const clippedByAncestor = (el: Element) => {
      let p = el.parentElement;
      while (p && p !== document.documentElement) {
        const o = getComputedStyle(p).overflowX;
        if (o === 'hidden' || o === 'clip' || o === 'auto' || o === 'scroll') {
          return true;
        }
        p = p.parentElement;
      }
      return false;
    };

    for (const el of Array.from(document.body.querySelectorAll('*'))) {
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') {
        continue;
      }
      const r = el.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) continue;

      const escapesStart = r.left < -tol;
      const escapesEnd = r.right > vw + tol;
      if (!escapesStart && !escapesEnd) continue;
      if (clippedByAncestor(el)) continue;

      out.push({
        selector: describe(el),
        text: (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60),
        left: Math.round(r.left),
        right: Math.round(r.right),
        width: Math.round(r.width),
      });
    }
    return out;
  }, tolerance);
}

/**
 * Samples elements that actually contain Arabic text and reports the typography
 * the browser resolved for them, plus every webfont family the document loaded.
 *
 * `loadedFontFamilies` is the load-bearing part: the Nashr Arabic stack is
 * declared purely as a `font-family` list with no `@font-face` behind it, so if
 * no Arabic family appears here the glyphs are being drawn by whatever the host
 * OS happens to have.
 */
export async function inspectFonts(page: Page): Promise<FontUsage> {
  return page.evaluate(() => {
    const AR =
      /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const sample: FontUsage['sample'] = [];
    let n: Node | null;
    while ((n = walker.nextNode())) {
      const v = n.nodeValue || '';
      if (!AR.test(v) || !n.parentElement) continue;
      const el = n.parentElement;
      const cs = getComputedStyle(el);
      sample.push({
        tag: el.tagName,
        text: v.trim().slice(0, 40),
        fontFamily: cs.fontFamily,
        letterSpacing: cs.letterSpacing,
        textAlign: cs.textAlign,
        direction: cs.direction,
        lineHeight: cs.lineHeight,
      });
      if (sample.length >= 12) break;
    }
    const loaded = new Set<string>();
    document.fonts.forEach((f) => {
      if (f.status === 'loaded') loaded.add(f.family);
    });
    return { sample, loadedFontFamilies: [...loaded] };
  }) as Promise<FontUsage>;
}

/** Everything the RTL specs assert on, in one round trip. */
export async function collectRtlDiagnostics(
  page: Page
): Promise<RtlDiagnostics> {
  const [base, overflow, strays, fonts] = await Promise.all([
    page.evaluate(() => {
      const AR =
        /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/g;
      return {
        htmlDir: document.documentElement.dir,
        htmlLang: document.documentElement.lang,
        bodyDirection: getComputedStyle(document.body).direction,
        centerXVar: getComputedStyle(document.documentElement)
          .getPropertyValue('--nashr-center-x')
          .trim(),
        arabicCharCount: (document.body.innerText.match(AR) || []).length,
      };
    }),
    measureOverflow(page),
    findStrayElements(page),
    inspectFonts(page),
  ]);
  return { ...base, overflow, strays, fonts };
}

/**
 * Asks Chrome (via CDP) which font files actually rasterised a node's glyphs.
 * Computed `font-family` only tells you what was *requested*; this tells you
 * what was *used*, which is the only way to prove a declared Arabic face is
 * missing. Chromium-only.
 */
export async function platformFontsFor(
  page: Page,
  selector: string
): Promise<{ familyName: string; isCustomFont: boolean; glyphCount: number }[]> {
  const cdp = await page.context().newCDPSession(page);
  try {
    await cdp.send('DOM.enable');
    await cdp.send('CSS.enable');
    const { root } = (await cdp.send('DOM.getDocument', { depth: -1 })) as any;
    const { nodeId } = (await cdp.send('DOM.querySelector', {
      nodeId: root.nodeId,
      selector,
    })) as any;
    if (!nodeId) return [];
    const { fonts } = (await cdp.send('CSS.getPlatformFontsForNode', {
      nodeId,
    })) as any;
    return fonts;
  } finally {
    await cdp.detach().catch(() => undefined);
  }
}

/**
 * Marks the first element containing Arabic text so `platformFontsFor` can
 * target it. Returns the selector, or null when the page has no Arabic at all.
 */
export async function tagFirstArabicElement(
  page: Page,
  attr = 'data-e2e-arabic'
): Promise<string | null> {
  const found = await page.evaluate((a) => {
    const AR =
      /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let n: Node | null;
    while ((n = walker.nextNode())) {
      if (AR.test(n.nodeValue || '') && n.parentElement) {
        n.parentElement.setAttribute(a, '1');
        return true;
      }
    }
    return false;
  }, attr);
  return found ? `[${attr}="1"]` : null;
}

/**
 * Settles the page for a deterministic screenshot: fonts done, network idle,
 * CSS transitions and animations frozen, caret hidden.
 */
export async function stabilise(page: Page) {
  await page.addStyleTag({
    content: `*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}`,
  });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForLoadState('networkidle').catch(() => undefined);
}
