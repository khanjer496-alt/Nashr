/**
 * Hijri support for the Campaign Calendar agent.
 *
 * `libraries/nashr-i18n/src/hijri.ts` is owned by another engineer and may not
 * exist yet. Rather than import it and break the build, this module:
 *   - defines the narrow `HijriPort` contract it must satisfy (ports.ts), and
 *   - ships a self-contained fallback built on `Intl` with the
 *     `islamic-umalqura` calendar, which is what Saudi and UAE civil calendars
 *     follow.
 *
 * `resolveHijriPort()` prefers the shared implementation when it is present.
 * Swap-in is then a no-op for callers.
 *
 * Lunar dates are ANNOUNCED, not computed: Ramadan and both Eids depend on
 * moon sighting and can shift by a day. Every lunar observance is returned with
 * `approximate: true`, and the agent is instructed to say so rather than
 * present a calculated date as fact.
 */
import type { HijriDate, HijriPort, MenaObservance } from './ports';
import type { NashrMarketCode } from './types';

const HIJRI_MONTHS_EN = [
  'Muharram',
  'Safar',
  'Rabi al-Awwal',
  'Rabi al-Thani',
  'Jumada al-Awwal',
  'Jumada al-Thani',
  'Rajab',
  'Shaban',
  'Ramadan',
  'Shawwal',
  'Dhu al-Qadah',
  'Dhu al-Hijjah',
];

export function hijriMonthName(month: number): string {
  return HIJRI_MONTHS_EN[month - 1] ?? `Month ${month}`;
}

/** Convert a Gregorian date using the Umm al-Qura civil calendar. */
export function gregorianToHijri(date: Date): HijriDate {
  const formatter = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
  const parts = formatter.formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return { year: get('year'), month: get('month'), day: get('day') };
}

/** First Gregorian date whose Hijri value matches (month, day) in [from, to]. */
function findHijriDates(
  from: Date,
  to: Date,
  month: number,
  day: number
): string[] {
  const found: string[] = [];
  const cursor = new Date(
    Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate())
  );
  const end = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate());
  // Bounded scan: the calendar agent never plans more than ~400 days ahead.
  let guard = 0;
  while (cursor.getTime() <= end && guard < 800) {
    const h = gregorianToHijri(cursor);
    if (h.month === month && h.day === day) {
      found.push(cursor.toISOString().slice(0, 10));
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    guard += 1;
  }
  return found;
}

interface FixedObservance {
  key: string;
  nameEn: string;
  nameAr: string;
  /** 1-12 */
  gregorianMonth: number;
  gregorianDay: number;
  markets: NashrMarketCode[];
}

const FIXED_OBSERVANCES: FixedObservance[] = [
  { key: 'uae_national_day', nameEn: 'UAE National Day', nameAr: 'اليوم الوطني الإماراتي', gregorianMonth: 12, gregorianDay: 2, markets: ['AE'] },
  { key: 'uae_commemoration_day', nameEn: 'UAE Commemoration Day', nameAr: 'يوم الشهيد', gregorianMonth: 11, gregorianDay: 30, markets: ['AE'] },
  { key: 'saudi_national_day', nameEn: 'Saudi National Day', nameAr: 'اليوم الوطني السعودي', gregorianMonth: 9, gregorianDay: 23, markets: ['SA'] },
  { key: 'saudi_founding_day', nameEn: 'Saudi Founding Day', nameAr: 'يوم التأسيس', gregorianMonth: 2, gregorianDay: 22, markets: ['SA'] },
  { key: 'kuwait_national_day', nameEn: 'Kuwait National Day', nameAr: 'العيد الوطني الكويتي', gregorianMonth: 2, gregorianDay: 25, markets: ['KW'] },
  { key: 'kuwait_liberation_day', nameEn: 'Kuwait Liberation Day', nameAr: 'يوم التحرير', gregorianMonth: 2, gregorianDay: 26, markets: ['KW'] },
  { key: 'qatar_national_day', nameEn: 'Qatar National Day', nameAr: 'اليوم الوطني القطري', gregorianMonth: 12, gregorianDay: 18, markets: ['QA'] },
  { key: 'bahrain_national_day', nameEn: 'Bahrain National Day', nameAr: 'العيد الوطني البحريني', gregorianMonth: 12, gregorianDay: 16, markets: ['BH'] },
  { key: 'oman_national_day', nameEn: 'Oman National Day', nameAr: 'العيد الوطني العماني', gregorianMonth: 11, gregorianDay: 18, markets: ['OM'] },
  { key: 'egypt_revolution_day', nameEn: 'Egypt Revolution Day', nameAr: 'عيد ثورة 23 يوليو', gregorianMonth: 7, gregorianDay: 23, markets: ['EG'] },
  { key: 'jordan_independence_day', nameEn: 'Jordan Independence Day', nameAr: 'عيد الاستقلال الأردني', gregorianMonth: 5, gregorianDay: 25, markets: ['JO'] },
];

interface LunarObservance {
  key: string;
  nameEn: string;
  nameAr: string;
  hijriMonth: number;
  hijriDay: number;
}

const LUNAR_OBSERVANCES: LunarObservance[] = [
  { key: 'ramadan_start', nameEn: 'First day of Ramadan', nameAr: 'أول أيام رمضان', hijriMonth: 9, hijriDay: 1 },
  { key: 'laylat_al_qadr', nameEn: 'Laylat al-Qadr (commonly observed)', nameAr: 'ليلة القدر', hijriMonth: 9, hijriDay: 27 },
  { key: 'eid_al_fitr', nameEn: 'Eid al-Fitr', nameAr: 'عيد الفطر', hijriMonth: 10, hijriDay: 1 },
  { key: 'arafah', nameEn: 'Day of Arafah', nameAr: 'يوم عرفة', hijriMonth: 12, hijriDay: 9 },
  { key: 'eid_al_adha', nameEn: 'Eid al-Adha', nameAr: 'عيد الأضحى', hijriMonth: 12, hijriDay: 10 },
  { key: 'islamic_new_year', nameEn: 'Islamic New Year', nameAr: 'رأس السنة الهجرية', hijriMonth: 1, hijriDay: 1 },
];

/** Self-contained implementation used when nashr-i18n is unavailable. */
export class IntlHijriAdapter implements HijriPort {
  toHijri(date: Date): HijriDate {
    return gregorianToHijri(date);
  }

  observancesBetween(from: Date, to: Date, market: NashrMarketCode): MenaObservance[] {
    const results: MenaObservance[] = [];

    for (const fixed of FIXED_OBSERVANCES) {
      if (fixed.markets.length && !fixed.markets.includes(market)) continue;
      for (
        let year = from.getUTCFullYear();
        year <= to.getUTCFullYear();
        year += 1
      ) {
        const date = new Date(
          Date.UTC(year, fixed.gregorianMonth - 1, fixed.gregorianDay)
        );
        if (date >= from && date <= to) {
          results.push({
            key: fixed.key,
            nameEn: fixed.nameEn,
            nameAr: fixed.nameAr,
            date: date.toISOString().slice(0, 10),
            approximate: false,
            markets: fixed.markets,
          });
        }
      }
    }

    for (const lunar of LUNAR_OBSERVANCES) {
      for (const iso of findHijriDates(from, to, lunar.hijriMonth, lunar.hijriDay)) {
        results.push({
          key: lunar.key,
          nameEn: lunar.nameEn,
          nameAr: lunar.nameAr,
          date: iso,
          // Moon sighting can move this by a day. Always flagged.
          approximate: true,
          markets: [],
        });
      }
    }

    return results.sort((a, b) => a.date.localeCompare(b.date));
  }
}

/** Shape `libraries/nashr-i18n/src/hijri.ts` exposes today (function style). */
interface I18nHijriModule {
  toHijri?: (date: Date) => { year: number; month: number; day: number };
  islamicOccasionsForGregorianYear?: (
    year: number
  ) => Array<{ id: string; date: Date; approximate: boolean }>;
}

const I18N_LUNAR_NAMES: Record<string, { en: string; ar: string }> = {
  ramadan_start: { en: 'First day of Ramadan', ar: 'أول أيام رمضان' },
  ramadan_end: { en: 'Last day of Ramadan', ar: 'آخر أيام رمضان' },
  eid_al_fitr: { en: 'Eid al-Fitr', ar: 'عيد الفطر' },
  arafah: { en: 'Day of Arafah', ar: 'يوم عرفة' },
  eid_al_adha: { en: 'Eid al-Adha', ar: 'عيد الأضحى' },
};

/**
 * Wrap nashr-i18n's functions in the `HijriPort` shape. National days are not
 * that library's concern, so they still come from the fixed table here; only
 * the lunar dates are delegated. That keeps a single source of truth for the
 * moon-dependent dates, which is the part that must not disagree between
 * the calendar agent and the rest of the product.
 */
function adaptI18nModule(mod: I18nHijriModule): HijriPort | null {
  const toHijriFn = mod.toHijri;
  const occasionsFn = mod.islamicOccasionsForGregorianYear;
  if (typeof toHijriFn !== 'function' || typeof occasionsFn !== 'function') return null;

  const local = new IntlHijriAdapter();

  return {
    toHijri: (date: Date) => toHijriFn(date),
    observancesBetween(from: Date, to: Date, market: NashrMarketCode): MenaObservance[] {
      const fixed = local
        .observancesBetween(from, to, market)
        .filter((o) => !o.approximate);

      const lunar: MenaObservance[] = [];
      for (let year = from.getUTCFullYear(); year <= to.getUTCFullYear(); year += 1) {
        for (const occasion of occasionsFn(year)) {
          if (occasion.date < from || occasion.date > to) continue;
          const names = I18N_LUNAR_NAMES[occasion.id];
          if (!names) continue;
          lunar.push({
            key: occasion.id,
            nameEn: names.en,
            nameAr: names.ar,
            date: occasion.date.toISOString().slice(0, 10),
            approximate: true,
            markets: [],
          });
        }
      }

      return [...fixed, ...lunar].sort((a, b) => a.date.localeCompare(b.date));
    },
  };
}

/**
 * Prefer `libraries/nashr-i18n/src/hijri.ts` when it is resolvable; otherwise
 * use the local adapter.
 *
 * The require is dynamic and wrapped on purpose. That library is another
 * engineer's deliverable, and `tsconfig.base.json` (which this workstream does
 * not own) has no `@gitroom/nashr-i18n/*` path mapping yet — so today this
 * falls through to `IntlHijriAdapter`, which computes the same Umm al-Qura
 * dates. Once the mapping is added the shared implementation is picked up with
 * no change here.
 */
export function resolveHijriPort(): HijriPort {
  for (const specifier of ['@gitroom/nashr-i18n/hijri', '@gitroom/nashr-i18n']) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const mod = require(specifier);
      const candidate = mod?.hijriPort ?? mod?.default ?? mod;
      if (!candidate) continue;

      if (
        typeof candidate.toHijri === 'function' &&
        typeof candidate.observancesBetween === 'function'
      ) {
        return candidate as HijriPort;
      }

      const adapted = adaptI18nModule(candidate as I18nHijriModule);
      if (adapted) return adapted;
    } catch {
      // Not resolvable yet — expected. Try the next specifier, then fall back.
    }
  }
  return new IntlHijriAdapter();
}
