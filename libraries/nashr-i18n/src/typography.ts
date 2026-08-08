/**
 * Arabic typography.
 *
 * Three things go wrong when a Latin-first design is switched to Arabic, and
 * all three are handled here:
 *
 * 1. LETTER-SPACING. Arabic is a cursive, connected script. Applying positive
 *    `letter-spacing` (very common in Latin UI kits for buttons, labels and
 *    all-caps headings) breaks the joins between letters and renders the word
 *    as disconnected glyphs. Arabic must always get `letter-spacing: normal`.
 *
 * 2. LINE-HEIGHT. Arabic has tall ascenders and deep descenders plus optional
 *    diacritics. A 1.2–1.3 line-height that looks tight-and-clean in Latin
 *    clips Arabic. 1.6–1.75 for body text, ~1.4 for headings.
 *
 * 3. TEXT-TRANSFORM. `text-transform: uppercase` is meaningless in Arabic
 *    (no case) but still triggers reflow and, with some fonts, substitution
 *    artefacts. It should be disabled.
 *
 * A fourth, subtler one: font-size. At the same nominal px size Arabic reads
 * smaller than Latin because its x-height equivalent is lower. A ~5–8% bump
 * is applied to body copy.
 */

/**
 * Preferred Arabic UI stack.
 *
 * IBM Plex Sans Arabic is the first choice — it is open-licensed (SIL OFL),
 * has a real weight range, and its Latin companion matches the product's
 * existing Plus Jakarta Sans reasonably. Noto Kufi Arabic is the fallback for
 * display/headings. The tail is the platform Arabic UI font on each OS, so
 * text is never rendered by a Latin font's poor Arabic fallback.
 */
export const ARABIC_FONT_STACK = [
  '"IBM Plex Sans Arabic"',
  '"Noto Kufi Arabic"',
  '"Noto Sans Arabic"',
  // Platform defaults
  '"SF Arabic"',
  '"Geeza Pro"',        // macOS / iOS
  '"Segoe UI"',         // Windows (carries Arabic)
  '"Dubai"',            // Widely installed in the UAE
  '"Tahoma"',           // Long-standing safe Arabic fallback
  'sans-serif',
].join(', ');

/** Display/headline stack — Kufi first for a more editorial Arabic voice. */
export const ARABIC_DISPLAY_FONT_STACK = [
  '"Noto Kufi Arabic"',
  '"IBM Plex Sans Arabic"',
  '"Noto Sans Arabic"',
  '"SF Arabic"',
  'sans-serif',
].join(', ');

export const ARABIC_TYPOGRAPHY = {
  bodyLineHeight: 1.7,
  headingLineHeight: 1.4,
  /** Multiplier applied to the Latin font size so Arabic reads at parity. */
  sizeAdjust: 1.06,
  /** Never anything but `normal`. See note 1 above. */
  letterSpacing: 'normal',
} as const;

/**
 * The same rules as a standalone stylesheet, for consumers that do not build
 * through the frontend's `global.scss` (browser extension, email renderer,
 * embedded preview). The frontend gets these rules from `global.scss` directly
 * — do not inject both.
 */
export const arabicTypographyCss = `
:root {
  --nashr-font-arabic: ${ARABIC_FONT_STACK};
  --nashr-font-arabic-display: ${ARABIC_DISPLAY_FONT_STACK};
}

:lang(ar), [lang^="ar"], html[dir="rtl"] {
  font-family: var(--nashr-font-arabic);
  line-height: ${ARABIC_TYPOGRAPHY.bodyLineHeight};
}

/* Arabic is cursive: any positive tracking severs the letter joins. */
:lang(ar), :lang(ar) *,
html[dir="rtl"], html[dir="rtl"] * {
  letter-spacing: normal !important;
  font-feature-settings: "liga" 1, "calt" 1;
}

/* Arabic has no letter case; uppercase transforms are noise at best. */
html[dir="rtl"] * {
  text-transform: none !important;
}

html[dir="rtl"] h1,
html[dir="rtl"] h2,
html[dir="rtl"] h3,
html[dir="rtl"] h4 {
  font-family: var(--nashr-font-arabic-display);
  line-height: ${ARABIC_TYPOGRAPHY.headingLineHeight};
}
`;

/** Inline style object for a React node that should render as Arabic. */
export const arabicTextStyle = (display = false) => ({
  fontFamily: display ? ARABIC_DISPLAY_FONT_STACK : ARABIC_FONT_STACK,
  lineHeight: display
    ? ARABIC_TYPOGRAPHY.headingLineHeight
    : ARABIC_TYPOGRAPHY.bodyLineHeight,
  letterSpacing: ARABIC_TYPOGRAPHY.letterSpacing,
});
