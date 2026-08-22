/**
 * Global market registry with optional regional overlays.
 *
 * One place that answers "for market X, what is the timezone / currency /
 * working week / locale?". Everything else in this library reads from here so
 * adding a market is a single edit.
 *
 * The neutral global entry is the fallback. Explicit organization, user, or
 * locale choices opt into the regional behavior below.
 */

export type MarketCode =
  | 'GLOBAL'
  | 'AE'
  | 'SA'
  | 'KW'
  | 'QA'
  | 'BH'
  | 'OM'
  | 'EG'
  | 'JO';

export type CurrencyCode =
  | 'AED'
  | 'SAR'
  | 'KWD'
  | 'QAR'
  | 'BHD'
  | 'OMR'
  | 'EGP'
  | 'JOD'
  | 'USD';

/** ISO-8601 day numbering: 1 = Monday … 7 = Sunday. */
export type IsoWeekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface Market {
  code: MarketCode;
  /** English display name. Prefer the `market_name` translation key in UI. */
  nameEn: string;
  /** Arabic display name. */
  nameAr: string;
  /** IANA timezone identifier. */
  timezone: string;
  currency: CurrencyCode;
  /** Preferred locale tag for English speakers in this market. */
  localeEn: string;
  /** Preferred locale tag for Arabic speakers in this market. */
  localeAr: string;
  /** Non-working days, ISO weekday numbers. */
  weekend: IsoWeekday[];
  /** First day shown in a calendar week view, ISO weekday number. */
  firstDayOfWeek: IsoWeekday;
  /**
   * Whether Arabic copy in this market conventionally renders numbers in
   * Arabic-Indic digits (٠١٢٣) rather than Western digits (0123).
   *
   * Gulf markets overwhelmingly use Western digits in commercial and digital
   * contexts even in Arabic text; Egypt still uses Arabic-Indic widely in
   * print but Western digits dominate online. Default therefore stays Western
   * everywhere — this flag exists so a market can opt in, not so we guess.
   */
  prefersArabicIndicDigits: boolean;
}

export const MARKETS: Record<MarketCode, Market> = {
  GLOBAL: {
    code: 'GLOBAL',
    nameEn: 'Global',
    nameAr: 'عالمي',
    timezone: 'UTC',
    currency: 'USD',
    localeEn: 'en',
    localeAr: 'ar',
    weekend: [6, 7],
    firstDayOfWeek: 1,
    prefersArabicIndicDigits: false,
  },
  AE: {
    code: 'AE',
    nameEn: 'United Arab Emirates',
    nameAr: 'الإمارات العربية المتحدة',
    timezone: 'Asia/Dubai',
    currency: 'AED',
    localeEn: 'en-AE',
    localeAr: 'ar-AE',
    weekend: [6, 7],
    firstDayOfWeek: 1,
    prefersArabicIndicDigits: false,
  },
  SA: {
    code: 'SA',
    nameEn: 'Kingdom of Saudi Arabia',
    nameAr: 'المملكة العربية السعودية',
    timezone: 'Asia/Riyadh',
    currency: 'SAR',
    localeEn: 'en-SA',
    localeAr: 'ar-SA',
    weekend: [5, 6],
    firstDayOfWeek: 7,
    prefersArabicIndicDigits: false,
  },
  KW: {
    code: 'KW',
    nameEn: 'Kuwait',
    nameAr: 'الكويت',
    timezone: 'Asia/Kuwait',
    currency: 'KWD',
    localeEn: 'en-KW',
    localeAr: 'ar-KW',
    weekend: [5, 6],
    firstDayOfWeek: 7,
    prefersArabicIndicDigits: false,
  },
  QA: {
    code: 'QA',
    nameEn: 'Qatar',
    nameAr: 'قطر',
    timezone: 'Asia/Qatar',
    currency: 'QAR',
    localeEn: 'en-QA',
    localeAr: 'ar-QA',
    weekend: [5, 6],
    firstDayOfWeek: 7,
    prefersArabicIndicDigits: false,
  },
  BH: {
    code: 'BH',
    nameEn: 'Bahrain',
    nameAr: 'البحرين',
    timezone: 'Asia/Bahrain',
    currency: 'BHD',
    localeEn: 'en-BH',
    localeAr: 'ar-BH',
    weekend: [5, 6],
    firstDayOfWeek: 7,
    prefersArabicIndicDigits: false,
  },
  OM: {
    code: 'OM',
    nameEn: 'Oman',
    nameAr: 'عُمان',
    timezone: 'Asia/Muscat',
    currency: 'OMR',
    localeEn: 'en-OM',
    localeAr: 'ar-OM',
    weekend: [5, 6],
    firstDayOfWeek: 7,
    prefersArabicIndicDigits: false,
  },
  EG: {
    code: 'EG',
    nameEn: 'Egypt',
    nameAr: 'مصر',
    timezone: 'Africa/Cairo',
    currency: 'EGP',
    localeEn: 'en-EG',
    localeAr: 'ar-EG',
    weekend: [5, 6],
    firstDayOfWeek: 7,
    prefersArabicIndicDigits: false,
  },
  JO: {
    code: 'JO',
    nameEn: 'Jordan',
    nameAr: 'الأردن',
    timezone: 'Asia/Amman',
    currency: 'JOD',
    localeEn: 'en-JO',
    localeAr: 'ar-JO',
    weekend: [5, 6],
    firstDayOfWeek: 7,
    prefersArabicIndicDigits: false,
  },
};

/** Neutral fallback used only when no explicit market is known. */
export const DEFAULT_MARKET: MarketCode = 'GLOBAL';

export const MARKET_CODES = Object.keys(MARKETS) as MarketCode[];

export const getMarket = (code?: string | null): Market =>
  MARKETS[(code || '').toUpperCase() as MarketCode] ?? MARKETS[DEFAULT_MARKET];

/**
 * Derive a market from a locale tag such as `ar-AE`. Returns undefined when the
 * tag carries no region or the region is not a configured market — callers should
 * then fall back to the organisation's configured market, not guess.
 */
export const marketFromLocale = (locale?: string | null): Market | undefined => {
  if (!locale) return undefined;
  const region = locale.replace('_', '-').split('-')[1];
  if (!region) return undefined;
  return MARKETS[region.toUpperCase() as MarketCode];
};
