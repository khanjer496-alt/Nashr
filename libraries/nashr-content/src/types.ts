/**
 * Typed campaign + sample-content data for the MENA market.
 *
 * This library is DATA ONLY — no React, no rendering, no I/O. Other phases
 * (editor, scheduler, onboarding, agents) consume it. Keeping it inert means
 * it can be imported from the backend seeder, the frontend template picker and
 * the agent tooling without dragging in a UI dependency.
 */

/** The two content languages Nashr ships. */
export type ContentLocale = 'en' | 'ar';

/** Every user-visible string in this library is bilingual by construction. */
export interface LocalizedText {
  en: string;
  ar: string;
}

export interface LocalizedList {
  en: string[];
  ar: string[];
}

export type MarketCode = 'AE' | 'SA' | 'KW' | 'QA' | 'BH' | 'OM' | 'EG' | 'JO';

export type Vertical =
  | 'restaurants'
  | 'agencies'
  | 'salons'
  | 'clinics'
  | 'small_business';

export type CampaignId =
  | 'ramadan'
  | 'eid_al_fitr'
  | 'eid_al_adha'
  | 'uae_national_day'
  | 'saudi_national_day'
  | 'saudi_founding_day';

/**
 * How a campaign's anchor date is derived.
 *
 *  - `hijri`  — moves every Gregorian year; resolve with
 *               `@gitroom/nashr-i18n`'s `fromHijri()`. ALWAYS approximate:
 *               the observed date depends on moon sighting per country.
 *  - `fixed`  — a fixed Gregorian day/month. Exact.
 */
export type DateBasis = 'hijri' | 'fixed';

export interface HijriAnchor {
  basis: 'hijri';
  /** 1 = Muharram … 9 = Ramadan … 12 = Dhu al-Hijjah. */
  month: number;
  day: number;
}

export interface FixedAnchor {
  basis: 'fixed';
  /** 1-12. */
  month: number;
  day: number;
  /**
   * Year the thing being commemorated began, so a consumer can render the
   * ordinal ("the 55th National Day") instead of us hardcoding a number that
   * silently goes stale. Omit when there is no meaningful ordinal.
   */
  anchorYear?: number;
  /**
   * How the official ordinal is counted.
   *
   *  - `gregorian` — ordinal = gregorianYear - anchorYear. True for UAE
   *    National Day (1971 -> 2026 is the 55th).
   *  - `hijri_verified` — the official ordinal is counted in HIJRI years, so
   *    it drifts against the Gregorian gap by roughly one every 33 years.
   *    Saudi National Day works this way: 2025 was officially the 95th even
   *    though 2025 - 1932 = 93. Never compute these — look them up.
   *  - `none` — no official ordinal is used.
   */
  editionCounting?: 'gregorian' | 'hijri_verified' | 'none';
  /**
   * Officially announced ordinals by Gregorian year, for `hijri_verified`
   * campaigns. Extend this each year from the official announcement; do NOT
   * extrapolate. An unknown year returns null and the UI should omit the
   * ordinal rather than print a wrong one.
   */
  knownEditions?: Record<number, number>;
}

export type CampaignAnchor = HijriAnchor | FixedAnchor;

/** Where a post sits relative to the campaign anchor date. */
export type CampaignPhase = 'lead_up' | 'peak' | 'wind_down';

export interface CampaignPost {
  id: string;
  phase: CampaignPhase;
  /**
   * Days relative to the anchor date. Negative = before the anchor.
   * Ramadan's anchor is day 1, so its "during" posts have positive offsets.
   */
  offsetDays: number;
  /** Post body. Placeholders use `{{name}}` so any templating layer can bind. */
  caption: LocalizedText;
  hashtags: LocalizedList;
  /** What the accompanying image/video should show. Guidance, not a caption. */
  mediaBrief: LocalizedText;
  /** Restrict to certain verticals. Omitted = suitable for all. */
  verticals?: Vertical[];
  /** Restrict to certain markets. Omitted = all markets the campaign covers. */
  markets?: MarketCode[];
}

/**
 * Editorial guardrails. These are the difference between a campaign that
 * lands and one that reads as a foreign brand cosplaying a local occasion,
 * so they travel with the template rather than living in a separate doc.
 */
export interface ToneGuidance {
  summary: LocalizedText;
  /** Things to do. */
  do: LocalizedList;
  /** Things that will read badly, and why. */
  dont: LocalizedList;
  /** Set phrases that are correct and expected. */
  greetings: LocalizedList;
}

export interface CampaignTemplate {
  id: CampaignId;
  name: LocalizedText;
  description: LocalizedText;
  anchor: CampaignAnchor;
  /**
   * True when the calendar date cannot be guaranteed in advance. Every Hijri
   * campaign is approximate; UI must surface a "subject to moon sighting"
   * qualifier and let the user shift the schedule by ±1–2 days.
   */
  approximate: boolean;
  /** Markets where this campaign is relevant. */
  markets: MarketCode[];
  /** Typical campaign window, in days either side of the anchor. */
  window: { startOffsetDays: number; endOffsetDays: number };
  tone: ToneGuidance;
  posts: CampaignPost[];
}

export interface SamplePost {
  id: string;
  vertical: Vertical;
  /** Short label for the template picker. */
  title: LocalizedText;
  caption: LocalizedText;
  hashtags: LocalizedList;
  mediaBrief: LocalizedText;
  /** Best-fit posting slot, local time, 24h. Guidance for the scheduler. */
  suggestedTime?: string;
}

export interface VerticalProfile {
  id: Vertical;
  name: LocalizedText;
  /** Who the business is talking to. */
  audience: LocalizedText;
  tone: ToneGuidance;
  /** Recurring content pillars to rotate through. */
  contentPillars: LocalizedList;
  samples: SamplePost[];
}
