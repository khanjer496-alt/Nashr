/**
 * Numeral-system handling for Arabic locales.
 *
 * This is the single most common i18n mistake in MENA products, so it lives in
 * one place:
 *
 * `Intl` defaults the `ar` locale to the `arab` numbering system, so
 * `new Intl.NumberFormat('ar-AE').format(1234)` returns `١٬٢٣٤` — Arabic-Indic
 * digits. That is correct for literary/print Arabic but is NOT what Gulf
 * commercial and digital interfaces use: prices, follower counts, dates and
 * analytics are overwhelmingly rendered in Western digits even inside Arabic
 * copy, and mixing the two inside one dashboard reads as a bug to users.
 *
 * So Nashr defaults Arabic locales to Western digits by appending the
 * `-u-nu-latn` Unicode extension, and exposes an explicit opt-in for the
 * places where Arabic-Indic is genuinely wanted.
 */

export type NumeralSystem = 'latn' | 'arab';

/** Nashr default. Overridable per market via `Market.prefersArabicIndicDigits`. */
export const DEFAULT_NUMERAL_SYSTEM: NumeralSystem = 'latn';

const NU_EXTENSION = /-u-(.*-)?nu-[a-z0-9]+/i;

/**
 * Return `locale` with an explicit numbering system.
 *
 * `withNumeralSystem('ar-AE', 'latn')` -> `'ar-AE-u-nu-latn'`
 *
 * A locale that already pins `nu` is returned untouched — an explicit caller
 * choice always wins over the default.
 */
export const withNumeralSystem = (
  locale: string,
  system: NumeralSystem = DEFAULT_NUMERAL_SYSTEM
): string => {
  if (!locale) return `en-u-nu-${system}`;
  if (NU_EXTENSION.test(locale)) return locale;
  return locale.includes('-u-')
    ? `${locale}-nu-${system}`
    : `${locale}-u-nu-${system}`;
};

/**
 * Normalise a locale for number/date formatting. Non-Arabic locales pass
 * through unchanged (no need to pin `latn` — it is already their default).
 */
export const formattingLocale = (
  locale: string,
  system: NumeralSystem = DEFAULT_NUMERAL_SYSTEM
): string => {
  if (!locale) return 'en';
  return locale.toLowerCase().startsWith('ar')
    ? withNumeralSystem(locale, system)
    : locale;
};

const ARABIC_INDIC = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];

/** Convert Arabic-Indic digits in a string back to Western digits. */
export const toWesternDigits = (value: string): string =>
  value.replace(/[٠-٩]/g, (d) =>
    String(d.charCodeAt(0) - 0x0660)
  );

/** Convert Western digits in a string to Arabic-Indic digits. */
export const toArabicIndicDigits = (value: string): string =>
  value.replace(/[0-9]/g, (d) => ARABIC_INDIC[Number(d)]);
