import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezonePlugin from 'dayjs/plugin/timezone';
import {
  DEFAULT_MARKET,
  MARKETS,
  MARKET_CODES,
  MarketCode,
  getMarket,
  marketFromLocale,
} from './markets';

/**
 * dayjs' utc + timezone plugins are extended once, at module load. Both are
 * idempotent, so importing this module from several entry points is safe.
 */
dayjs.extend(utc);
dayjs.extend(timezonePlugin);

/**
 * Product-wide neutral timezone. Explicit organization, user, locale, or
 * market settings take precedence over this fallback.
 */
export const DEFAULT_TIMEZONE = 'UTC';

export const MARKET_TIMEZONES: Record<MarketCode, string> = MARKET_CODES.reduce(
  (acc, code) => {
    acc[code] = MARKETS[code].timezone;
    return acc;
  },
  {} as Record<MarketCode, string>
);

/** Timezone for a market code (`'AE'`), falling back to the global default. */
export const timezoneForMarket = (market?: string | null): string =>
  getMarket(market).timezone;

/**
 * Best-effort timezone for a locale tag. `ar-AE` -> `Asia/Dubai`.
 * A bare `ar` carries no region, so it resolves to the default rather than
 * silently picking one Arabic-speaking country over another.
 */
export const timezoneForLocale = (locale?: string | null): string =>
  marketFromLocale(locale)?.timezone ?? DEFAULT_TIMEZONE;

/** The viewer's own IANA timezone, or the global default if unavailable. */
export const detectBrowserTimezone = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_TIMEZONE;
  } catch {
    return DEFAULT_TIMEZONE;
  }
};

/** True when `timezone` is a valid IANA identifier in this runtime. */
export const isValidTimezone = (timezone?: string | null): boolean => {
  if (!timezone) return false;
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
};

/** Coerce anything to a usable IANA timezone. */
export const resolveTimezone = (timezone?: string | null): string =>
  isValidTimezone(timezone) ? (timezone as string) : DEFAULT_TIMEZONE;

/** A dayjs instance for `date` rendered in `timezone`. */
export const inTimezone = (
  date: dayjs.ConfigType,
  timezone: string = DEFAULT_TIMEZONE
) => dayjs(date).tz(resolveTimezone(timezone));

/**
 * Current UTC offset of a timezone in minutes (e.g. `Asia/Dubai` -> 240).
 * Computed live so DST markets (Africa/Cairo, Asia/Amman both observe DST
 * again as of 2023+) report the offset in effect on `at`, not a stale constant.
 */
export const utcOffsetMinutes = (
  timezone: string = DEFAULT_TIMEZONE,
  at: dayjs.ConfigType = new Date()
): number => dayjs(at).tz(resolveTimezone(timezone)).utcOffset();

/** `Asia/Dubai` -> `GMT+4`, localised for the given locale. */
export const timezoneLabel = (
  timezone: string = DEFAULT_TIMEZONE,
  locale = 'en'
): string => {
  const tz = resolveTimezone(timezone);
  try {
    const parts = new Intl.DateTimeFormat(locale, {
      timeZone: tz,
      timeZoneName: 'shortOffset',
    }).formatToParts(new Date());
    return parts.find((p) => p.type === 'timeZoneName')?.value ?? tz;
  } catch {
    return tz;
  }
};

/** Markets ordered for a timezone picker, neutral global option first. */
export const marketTimezoneOptions = (locale = 'en') =>
  [DEFAULT_MARKET, ...MARKET_CODES.filter((c) => c !== DEFAULT_MARKET)].map(
    (code) => {
      const market = MARKETS[code];
      return {
        market: code,
        timezone: market.timezone,
        label: locale.startsWith('ar') ? market.nameAr : market.nameEn,
        offsetLabel: timezoneLabel(market.timezone, locale),
      };
    }
  );
