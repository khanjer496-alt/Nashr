import { CurrencyCode, getMarket } from './markets';
import {
  DEFAULT_NUMERAL_SYSTEM,
  NumeralSystem,
  formattingLocale,
} from './numerals';


/** Neutral billing/display currency when nothing else is known. */
export const DEFAULT_CURRENCY: CurrencyCode = 'USD';

/**
 * Minor-unit counts. `Intl` already knows these, so this table is only for
 * code that has to do arithmetic on integer minor units (Stripe amounts,
 * ledger rows). Note the three-decimal Gulf currencies — a hardcoded `* 100`
 * silently under-charges Kuwaiti, Bahraini and Omani customers by 10x.
 */
export const CURRENCY_MINOR_UNITS: Record<CurrencyCode, number> = {
  AED: 2,
  SAR: 2,
  QAR: 2,
  EGP: 2,
  JOD: 3,
  KWD: 3,
  BHD: 3,
  OMR: 3,
  USD: 2,
};

export interface FormatCurrencyOptions {
  /** BCP-47 tag, e.g. `ar-AE`. Defaults to `en-US`. */
  locale?: string;
  currency?: CurrencyCode;
  /** `symbol` -> "AED 1,200.00", `code` -> "AED 1,200.00", `name` -> "1,200.00 UAE dirhams". */
  display?: 'symbol' | 'code' | 'name' | 'narrowSymbol';
  /** Drop `.00` on whole amounts. Useful for pricing tables. */
  trimZeroDecimals?: boolean;
  /** Force a numbering system. Defaults to Western digits — see numerals.ts. */
  numerals?: NumeralSystem;
}

/**
 * Format a major-unit amount (1200.5 = $1,200.50 by default).
 *
 * Arabic locales are pinned to Western digits by default; pass
 * `numerals: 'arab'` for Arabic-Indic. Currency placement, the
 * right-to-left mark and the Arabic currency name all come from `Intl`, so
 * `ar-AE` correctly yields `‏١٢٠٠٫٥٠ د.إ.‏`-style ordering rather than a
 * hand-built string.
 */
export const formatCurrency = (
  amount: number,
  options: FormatCurrencyOptions = {}
): string => {
  const {
    locale = 'en-US',
    currency = DEFAULT_CURRENCY,
    display = 'symbol',
    trimZeroDecimals = false,
    numerals = DEFAULT_NUMERAL_SYSTEM,
  } = options;

  const digits = CURRENCY_MINOR_UNITS[currency] ?? 2;
  const fractionDigits =
    trimZeroDecimals && Number.isInteger(amount) ? 0 : digits;

  try {
    return new Intl.NumberFormat(formattingLocale(locale, numerals), {
      style: 'currency',
      currency,
      currencyDisplay: display,
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    }).format(amount);
  } catch {
    // Unknown currency or an Intl build without the data — never throw in a
    // render path, degrade to a readable string.
    return `${currency} ${amount.toFixed(fractionDigits)}`;
  }
};

/** Format an integer minor-unit amount (120050 -> "$1,200.50" by default). */
export const formatCurrencyMinor = (
  minorAmount: number,
  options: FormatCurrencyOptions = {}
): string => {
  const currency = options.currency ?? DEFAULT_CURRENCY;
  const factor = 10 ** (CURRENCY_MINOR_UNITS[currency] ?? 2);
  return formatCurrency(minorAmount / factor, options);
};

/** Plain number formatting with the same Arabic numeral policy. */
export const formatNumber = (
  value: number,
  locale = 'en-US',
  options: Intl.NumberFormatOptions = {},
  numerals: NumeralSystem = DEFAULT_NUMERAL_SYSTEM
): string => {
  try {
    return new Intl.NumberFormat(
      formattingLocale(locale, numerals),
      options
    ).format(value);
  } catch {
    return String(value);
  }
};

/** Compact counts for analytics tiles: 12300 -> "12K" / "١٢ ألف". */
export const formatCompactNumber = (
  value: number,
  locale = 'en-US',
  numerals: NumeralSystem = DEFAULT_NUMERAL_SYSTEM
): string =>
  formatNumber(
    value,
    locale,
    { notation: 'compact', maximumFractionDigits: 1 },
    numerals
  );

/** Default display currency for a market code. */
export const currencyForMarket = (market?: string | null): CurrencyCode =>
  getMarket(market).currency;
