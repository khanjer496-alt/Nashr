/**
 * Hijri (Islamic) calendar helpers.
 *
 * Why this exists: Ramadan, Eid al-Fitr and Eid al-Adha are the two biggest
 * commercial moments in every Nashr market, and they move roughly 11 days
 * earlier in the Gregorian calendar every year. Campaign scheduling cannot
 * hardcode them.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * IMPORTANT CAVEAT — READ BEFORE SHOWING ANY OF THIS TO A CUSTOMER
 *
 * Every date produced here is an ASTRONOMICAL / CALENDRICAL ESTIMATE, not an
 * announcement.
 *
 *  • The default calendar is `islamic-umalqura` (Umm al-Qura), the civil
 *    calendar of Saudi Arabia. It is a *tabular* calendar computed in advance.
 *  • The observed start of a Hijri month depends on local moon sighting
 *    (رؤية الهلال), announced by each country's own authority. The UAE, KSA,
 *    Qatar, Oman, Egypt and Jordan regularly differ from one another and from
 *    Umm al-Qura by ±1 day, occasionally ±2.
 *  • Eid al-Fitr in particular is frequently confirmed only the evening before.
 *
 * Therefore: use these dates to *prepare* campaigns and to place content in a
 * planning calendar. Always surface them with a "subject to moon sighting"
 * qualifier, never auto-publish a "Eid Mubarak" post on an unconfirmed date,
 * and let the user shift a campaign by ±1–2 days.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { formattingLocale, DEFAULT_NUMERAL_SYSTEM, NumeralSystem } from './numerals';
import { resolveTimezone, DEFAULT_TIMEZONE } from './timezone';

export type IslamicCalendar =
  | 'islamic-umalqura'
  | 'islamic-civil'
  | 'islamic-tbla'
  | 'islamic';

/** Umm al-Qura: the civil calendar of KSA and the closest common denominator for the Gulf. */
export const DEFAULT_ISLAMIC_CALENDAR: IslamicCalendar = 'islamic-umalqura';

export interface HijriDate {
  year: number;
  /** 1 = Muharram … 12 = Dhu al-Hijjah. */
  month: number;
  day: number;
  monthNameEn: string;
  monthNameAr: string;
}

export const HIJRI_MONTHS_EN = [
  'Muharram', 'Safar', "Rabi' al-Awwal", "Rabi' al-Thani",
  'Jumada al-Ula', 'Jumada al-Akhirah', 'Rajab', "Sha'ban",
  'Ramadan', 'Shawwal', "Dhu al-Qi'dah", 'Dhu al-Hijjah',
];

export const HIJRI_MONTHS_AR = [
  'محرّم', 'صفر', 'ربيع الأول', 'ربيع الآخر',
  'جمادى الأولى', 'جمادى الآخرة', 'رجب', 'شعبان',
  'رمضان', 'شوّال', 'ذو القعدة', 'ذو الحجة',
];

export const RAMADAN = 9;
export const SHAWWAL = 10;
export const DHU_AL_HIJJAH = 12;

const MS_PER_DAY = 86400000;
/** Mean length of a Hijri year in days — used only to seed a search. */
const MEAN_HIJRI_YEAR = 354.36707;
const MEAN_HIJRI_MONTH = 29.530589;

const partsFormatter = (calendar: IslamicCalendar, timeZone: string) =>
  new Intl.DateTimeFormat(`en-u-ca-${calendar}-nu-latn`, {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    timeZone,
  });

/** Convert a Gregorian date to its Hijri equivalent. */
export const toHijri = (
  date: Date | number | string = new Date(),
  calendar: IslamicCalendar = DEFAULT_ISLAMIC_CALENDAR,
  timezone: string = 'UTC'
): HijriDate => {
  const d = date instanceof Date ? date : new Date(date);
  const parts = partsFormatter(calendar, resolveTimezone(timezone)).formatToParts(d);
  const get = (type: string) =>
    parseInt(parts.find((p) => p.type === type)?.value ?? '0', 10);

  const month = get('month');
  return {
    year: get('year'),
    month,
    day: get('day'),
    monthNameEn: HIJRI_MONTHS_EN[month - 1] ?? '',
    monthNameAr: HIJRI_MONTHS_AR[month - 1] ?? '',
  };
};

/**
 * Convert a Hijri date to Gregorian.
 *
 * `Intl` only converts one way, so this seeds an estimate from the mean Hijri
 * year/month length and then walks day by day until the calendar agrees. The
 * seed is accurate to within a few days, so the walk is short and bounded.
 * Returns a UTC midnight `Date`, or `null` if no match is found (which would
 * mean the requested date does not exist in that calendar).
 */
export const fromHijri = (
  hijriYear: number,
  hijriMonth: number,
  hijriDay = 1,
  calendar: IslamicCalendar = DEFAULT_ISLAMIC_CALENDAR
): Date | null => {
  // Gregorian date of 1 Muharram 1 AH under Umm al-Qura (~16 July 622 CE).
  const epoch = Date.UTC(622, 6, 16);
  const estimate =
    epoch +
    Math.round(
      ((hijriYear - 1) * MEAN_HIJRI_YEAR +
        (hijriMonth - 1) * MEAN_HIJRI_MONTH +
        (hijriDay - 1)) *
        MS_PER_DAY
    );

  const fmt = partsFormatter(calendar, 'UTC');
  const read = (ms: number) => {
    const parts = fmt.formatToParts(new Date(ms));
    const get = (type: string) =>
      parseInt(parts.find((p) => p.type === type)?.value ?? '0', 10);
    return { y: get('year'), m: get('month'), d: get('day') };
  };

  const target = hijriYear * 10000 + hijriMonth * 100 + hijriDay;
  // Widen generously: the seed can drift by a couple of weeks over 1400 years.
  for (let offset = 0; offset <= 60; offset++) {
    for (const sign of offset === 0 ? [0] : [-1, 1]) {
      const ms = estimate + sign * offset * MS_PER_DAY;
      const { y, m, d } = read(ms);
      if (y * 10000 + m * 100 + d === target) {
        return new Date(ms);
      }
    }
  }
  return null;
};

/** Format a Gregorian date as a localised Hijri string, e.g. "١ رمضان ١٤٤٧ هـ". */
export const formatHijri = (
  date: Date | number | string = new Date(),
  options: {
    locale?: string;
    calendar?: IslamicCalendar;
    timezone?: string;
    numerals?: NumeralSystem;
    dateStyle?: Intl.DateTimeFormatOptions['dateStyle'];
  } = {}
): string => {
  const {
    locale = 'ar-AE',
    calendar = DEFAULT_ISLAMIC_CALENDAR,
    timezone = DEFAULT_TIMEZONE,
    numerals = DEFAULT_NUMERAL_SYSTEM,
    dateStyle = 'long',
  } = options;
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return '';

  const tagged = `${formattingLocale(locale, numerals)}${
    formattingLocale(locale, numerals).includes('-u-') ? '-ca-' : '-u-ca-'
  }${calendar}`;

  try {
    return new Intl.DateTimeFormat(tagged, {
      dateStyle,
      timeZone: resolveTimezone(timezone),
    }).format(d);
  } catch {
    const h = toHijri(d, calendar, timezone);
    return `${h.day} ${
      locale.startsWith('ar') ? h.monthNameAr : h.monthNameEn
    } ${h.year}`;
  }
};

export interface IslamicOccasion {
  /** Stable identifier, matches the campaign template ids in @gitroom/nashr-content. */
  id: 'ramadan_start' | 'ramadan_end' | 'eid_al_fitr' | 'arafah' | 'eid_al_adha';
  hijriYear: number;
  /** UTC midnight of the estimated Gregorian date. */
  date: Date;
  /** Always true here — kept explicit so UI cannot forget the qualifier. */
  approximate: true;
}

/**
 * Estimated key Islamic dates for a Hijri year.
 *
 * Eid al-Fitr = 1 Shawwal. Eid al-Adha = 10 Dhu al-Hijjah. Day of Arafah is
 * the 9th, the day before. All subject to the moon-sighting caveat at the top
 * of this file.
 */
export const islamicOccasionsForHijriYear = (
  hijriYear: number,
  calendar: IslamicCalendar = DEFAULT_ISLAMIC_CALENDAR
): IslamicOccasion[] => {
  const build = (
    id: IslamicOccasion['id'],
    month: number,
    day: number
  ): IslamicOccasion | null => {
    const date = fromHijri(hijriYear, month, day, calendar);
    return date ? { id, hijriYear, date, approximate: true } : null;
  };

  const ramadanStart = build('ramadan_start', RAMADAN, 1);
  const eidFitr = build('eid_al_fitr', SHAWWAL, 1);
  // Last day of Ramadan is the day before 1 Shawwal, whatever its length.
  const ramadanEnd: IslamicOccasion | null = eidFitr
    ? {
        id: 'ramadan_end',
        hijriYear,
        date: new Date(eidFitr.date.getTime() - MS_PER_DAY),
        approximate: true,
      }
    : null;

  return [
    ramadanStart,
    ramadanEnd,
    eidFitr,
    build('arafah', DHU_AL_HIJJAH, 9),
    build('eid_al_adha', DHU_AL_HIJJAH, 10),
  ].filter((o): o is IslamicOccasion => o !== null);
};

/**
 * Estimated Islamic occasions falling inside a Gregorian year. A Gregorian
 * year can straddle two Hijri years, so both are queried and filtered.
 */
export const islamicOccasionsForGregorianYear = (
  gregorianYear: number,
  calendar: IslamicCalendar = DEFAULT_ISLAMIC_CALENDAR
): IslamicOccasion[] => {
  const startHijri = toHijri(Date.UTC(gregorianYear, 0, 1), calendar).year;
  const endHijri = toHijri(Date.UTC(gregorianYear, 11, 31), calendar).year;

  const years = startHijri === endHijri ? [startHijri] : [startHijri, endHijri];
  return years
    .flatMap((y) => islamicOccasionsForHijriYear(y, calendar))
    .filter((o) => o.date.getUTCFullYear() === gregorianYear)
    .sort((a, b) => a.date.getTime() - b.date.getTime());
};

/** True when `date` falls inside Ramadan. */
export const isRamadan = (
  date: Date | number | string = new Date(),
  calendar: IslamicCalendar = DEFAULT_ISLAMIC_CALENDAR,
  timezone: string = DEFAULT_TIMEZONE
): boolean => toHijri(date, calendar, timezone).month === RAMADAN;

/** Whole days from `from` until the next occurrence of `id`; null if unknown. */
export const daysUntilOccasion = (
  id: IslamicOccasion['id'],
  from: Date = new Date(),
  calendar: IslamicCalendar = DEFAULT_ISLAMIC_CALENDAR
): number | null => {
  const hijriYear = toHijri(from, calendar).year;
  for (const y of [hijriYear, hijriYear + 1]) {
    const match = islamicOccasionsForHijriYear(y, calendar).find(
      (o) => o.id === id
    );
    if (match && match.date.getTime() >= from.getTime() - MS_PER_DAY) {
      return Math.ceil((match.date.getTime() - from.getTime()) / MS_PER_DAY);
    }
  }
  return null;
};
