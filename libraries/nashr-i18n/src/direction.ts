/**
 * Direction helpers.
 *
 * The canonical RTL language list lives in
 * `@gitroom/react/translation/i18n.config` because the i18next layer needs it
 * at init time. This module re-exports it so backend / non-React consumers
 * (email rendering, PDF export, the browser extension) do not have to pull in
 * the i18next bundle.
 *
 * Keep the two in sync — `rtlLanguages` is defined once, in i18n.config.ts.
 */
export type Direction = 'ltr' | 'rtl';

export const RTL_LANGUAGES = ['ar', 'he', 'fa', 'ur'];

export const baseLanguageOf = (locale?: string | null): string =>
  locale ? locale.split(/[-_]/)[0].toLowerCase() : 'en';

export const isRtlLocale = (locale?: string | null): boolean =>
  RTL_LANGUAGES.includes(baseLanguageOf(locale));

export const directionOf = (locale?: string | null): Direction =>
  isRtlLocale(locale) ? 'rtl' : 'ltr';

/**
 * Pick between a start- and end-side value without writing `left`/`right`.
 * Useful for inline styles and canvas/image generation where CSS logical
 * properties are unavailable.
 */
export const startSide = (locale?: string | null): 'left' | 'right' =>
  isRtlLocale(locale) ? 'right' : 'left';

export const endSide = (locale?: string | null): 'left' | 'right' =>
  isRtlLocale(locale) ? 'left' : 'right';

/**
 * Unicode bidi isolate. Wrap a Latin token (a URL, a handle, a hashtag, a
 * brand name) that is embedded in Arabic prose so it does not scramble the
 * surrounding text order. Cheaper and more reliable than `<bdi>` for strings
 * that end up in plain-text contexts such as post previews and notifications.
 */
export const isolate = (text: string): string => `⁨${text}⁩`;

/** Right-to-left mark — nudges a trailing punctuation mark to the right side. */
export const RLM = '‏';
/** Left-to-right mark. */
export const LRM = '‎';
