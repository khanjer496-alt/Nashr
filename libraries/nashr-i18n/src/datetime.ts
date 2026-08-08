import {
  DEFAULT_NUMERAL_SYSTEM,
  NumeralSystem,
  formattingLocale,
} from './numerals';
import { DEFAULT_TIMEZONE, resolveTimezone } from './timezone';
import { IsoWeekday, getMarket } from './markets';

export interface DateTimeOptions {
  locale?: string;
  timezone?: string;
  numerals?: NumeralSystem;
}

const base = (o: DateTimeOptions = {}) => ({
  locale: formattingLocale(
    o.locale ?? 'en-AE',
    o.numerals ?? DEFAULT_NUMERAL_SYSTEM
  ),
  timeZone: resolveTimezone(o.timezone ?? DEFAULT_TIMEZONE),
});

const safeFormat = (
  date: Date | number | string,
  locale: string,
  opts: Intl.DateTimeFormatOptions
): string => {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  try {
    return new Intl.DateTimeFormat(locale, opts).format(d);
  } catch {
    return d.toISOString();
  }
};

/** "8 August 2026" / "٨ أغسطس ٢٠٢٦" (Western digits by default). */
export const formatDate = (
  date: Date | number | string,
  options: DateTimeOptions & { dateStyle?: Intl.DateTimeFormatOptions['dateStyle'] } = {}
): string => {
  const { locale, timeZone } = base(options);
  return safeFormat(date, locale, {
    dateStyle: options.dateStyle ?? 'medium',
    timeZone,
  });
};

/**
 * Time of day. Arabic locales get a 12-hour clock with localised ص/م markers
 * from `Intl`; pass `hour12: false` for scheduling grids where a 24-hour clock
 * is less ambiguous.
 */
export const formatTime = (
  date: Date | number | string,
  options: DateTimeOptions & { hour12?: boolean } = {}
): string => {
  const { locale, timeZone } = base(options);
  return safeFormat(date, locale, {
    hour: '2-digit',
    minute: '2-digit',
    ...(options.hour12 === undefined ? {} : { hour12: options.hour12 }),
    timeZone,
  });
};

export const formatDateTime = (
  date: Date | number | string,
  options: DateTimeOptions & {
    dateStyle?: Intl.DateTimeFormatOptions['dateStyle'];
    timeStyle?: Intl.DateTimeFormatOptions['timeStyle'];
  } = {}
): string => {
  const { locale, timeZone } = base(options);
  return safeFormat(date, locale, {
    dateStyle: options.dateStyle ?? 'medium',
    timeStyle: options.timeStyle ?? 'short',
    timeZone,
  });
};

/** "in 3 days" / "خلال ٣ أيام". Uses `Intl.RelativeTimeFormat`. */
export const formatRelative = (
  date: Date | number | string,
  options: DateTimeOptions & { now?: Date } = {}
): string => {
  const { locale } = base(options);
  const target = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(target.getTime())) return '';
  const now = options.now ?? new Date();
  const diffSeconds = (target.getTime() - now.getTime()) / 1000;

  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['year', 60 * 60 * 24 * 365],
    ['month', 60 * 60 * 24 * 30],
    ['week', 60 * 60 * 24 * 7],
    ['day', 60 * 60 * 24],
    ['hour', 60 * 60],
    ['minute', 60],
    ['second', 1],
  ];

  try {
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
    for (const [unit, seconds] of units) {
      if (Math.abs(diffSeconds) >= seconds || unit === 'second') {
        return rtf.format(Math.round(diffSeconds / seconds), unit);
      }
    }
    return rtf.format(0, 'second');
  } catch {
    return formatDateTime(target, options);
  }
};

/** Localised weekday names, ordered for the market's calendar week. */
export const weekdayNames = (
  options: DateTimeOptions & {
    market?: string;
    width?: 'long' | 'short' | 'narrow';
  } = {}
): { iso: IsoWeekday; label: string; isWeekend: boolean }[] => {
  const { locale } = base(options);
  const market = getMarket(options.market);
  const width = options.width ?? 'short';

  // 2024-01-01 was a Monday, so index i maps cleanly onto ISO weekday i+1.
  const reference = Date.UTC(2024, 0, 1);
  const order: IsoWeekday[] = [];
  for (let i = 0; i < 7; i++) {
    order.push((((market.firstDayOfWeek - 1 + i) % 7) + 1) as IsoWeekday);
  }

  return order.map((iso) => ({
    iso,
    label: safeFormat(new Date(reference + (iso - 1) * 86400000), locale, {
      weekday: width,
      timeZone: 'UTC',
    }),
    isWeekend: market.weekend.includes(iso),
  }));
};

/** Month names for a locale, January-first. */
export const monthNames = (
  options: DateTimeOptions & { width?: 'long' | 'short' } = {}
): string[] => {
  const { locale } = base(options);
  return Array.from({ length: 12 }, (_, m) =>
    safeFormat(Date.UTC(2024, m, 15), locale, {
      month: options.width ?? 'long',
      timeZone: 'UTC',
    })
  );
};

/** True when the given date falls on the market's weekend. */
export const isWeekend = (
  date: Date | number | string,
  market?: string,
  timezone?: string
): boolean => {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return false;
  const tz = resolveTimezone(timezone ?? getMarket(market).timezone);
  const weekdayShort = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    timeZone: tz,
  }).format(d);
  const map: Record<string, IsoWeekday> = {
    Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7,
  };
  return getMarket(market).weekend.includes(map[weekdayShort]);
};
