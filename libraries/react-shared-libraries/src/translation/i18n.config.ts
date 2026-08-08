export const fallbackLng = 'en';

/**
 * Base (language-only) locales shipped with the product.
 * These each have a full `locales/<lng>/translation.json`.
 */
export const baseLanguages = [
  fallbackLng,
  'he',
  'ru',
  'zh',
  'fr',
  'es',
  'pt',
  'de',
  'it',
  'ja',
  'ko',
  'ar',
  'tr',
  'vi',
];

/**
 * Nashr MENA regional locales.
 *
 * These are *thin overlays*: their `translation.json` only carries the strings
 * that genuinely differ per market (currency wording, national-day naming,
 * regulator/market specific copy). Everything else resolves through
 * `fallbackLngMap` down to the base language file.
 *
 * Keep `<lang>-<REGION>` casing exactly as written — it is what
 * `Intl.*`, `navigator.language` and the `Accept-Language` header emit.
 */
export const regionalLanguages = ['en-AE', 'ar-AE', 'en-SA', 'ar-SA'];

export const languages = [...baseLanguages, ...regionalLanguages];

/**
 * Explicit fallback chains. i18next accepts an object here: the key is the
 * requested language, the value the ordered list of locales to try next.
 *
 *   ar-AE -> ar -> en
 *   en-SA -> en
 */
export const fallbackLngMap: Record<string, string[]> = {
  'ar-AE': ['ar', fallbackLng],
  'ar-SA': ['ar', fallbackLng],
  'en-AE': ['en', fallbackLng],
  'en-SA': ['en', fallbackLng],
  default: [fallbackLng],
};

/**
 * Languages whose script runs right-to-left.
 * Listed as base languages; `isRtl()` normalises regional variants first, so
 * `ar-AE` and `ar-SA` are covered without needing their own entries.
 */
export const rtlLanguages = ['ar', 'he', 'fa', 'ur'];

/** `ar-AE` -> `ar`; `en` -> `en`; falsy -> fallbackLng. */
export const baseLanguageOf = (language?: string | null): string => {
  if (!language) return fallbackLng;
  return language.split(/[-_]/)[0].toLowerCase();
};

/** True when the given locale (regional or base) is written right-to-left. */
export const isRtl = (language?: string | null): boolean =>
  rtlLanguages.includes(baseLanguageOf(language));

/**
 * Document direction for a locale. Used by the `<html dir>` attribute both
 * server-side (no flash of wrong direction) and client-side on language change.
 */
export const dirOfLanguage = (language?: string | null): 'rtl' | 'ltr' =>
  isRtl(language) ? 'rtl' : 'ltr';

/**
 * Resolve an arbitrary incoming locale (cookie value, `Accept-Language`
 * fragment, `navigator.language`) onto a locale we actually ship.
 * Falls back through the region -> base -> `fallbackLng` chain.
 */
export const resolveSupportedLanguage = (language?: string | null): string => {
  if (!language) return fallbackLng;

  const normalized = language.replace('_', '-');
  const exact = languages.find(
    (l) => l.toLowerCase() === normalized.toLowerCase()
  );
  if (exact) return exact;

  const base = baseLanguageOf(normalized);
  if (languages.includes(base)) return base;

  return fallbackLng;
};

export const defaultNS = 'translation';
export const cookieName = 'i18next';
export const headerName = 'x-i18next-current-language';
