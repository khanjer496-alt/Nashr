import { CampaignTemplate, CampaignPost, ContentLocale, Vertical } from './types';

/**
 * Turning a template into dated, ready-to-schedule posts.
 *
 * This module deliberately takes the anchor date as an argument rather than
 * importing `@gitroom/nashr-i18n` — it keeps this library dependency-free and
 * lets the caller decide the Hijri calendar variant, the timezone, and whether
 * the user has manually shifted the campaign after the moon-sighting
 * announcement.
 */

export interface ResolvedPost {
  postId: string;
  campaignId: string;
  /** UTC date the post should go out. */
  date: Date;
  caption: string;
  hashtags: string[];
  mediaBrief: string;
  locale: ContentLocale;
  /** Mirrors the campaign flag — true means the date may shift by ±1–2 days. */
  approximate: boolean;
}

const MS_PER_DAY = 86400000;

const applies = (post: CampaignPost, vertical?: Vertical, market?: string) => {
  if (vertical && post.verticals && !post.verticals.includes(vertical)) {
    return false;
  }
  if (
    market &&
    post.markets &&
    !post.markets.includes(market.toUpperCase() as never)
  ) {
    return false;
  }
  return true;
};

/**
 * Expand a campaign into dated posts around `anchorDate`.
 *
 * `anchorDate` is the resolved Gregorian date of the campaign's anchor — for
 * Ramadan, the first day of the month; for the Eids, the day itself; for fixed
 * campaigns, the fixed day of that year.
 */
export const resolveCampaign = (
  campaign: CampaignTemplate,
  anchorDate: Date,
  options: {
    locale?: ContentLocale;
    vertical?: Vertical;
    market?: string;
  } = {}
): ResolvedPost[] => {
  const { locale = 'en', vertical, market } = options;

  return campaign.posts
    .filter((post) => applies(post, vertical, market))
    .map((post) => ({
      postId: post.id,
      campaignId: campaign.id,
      date: new Date(anchorDate.getTime() + post.offsetDays * MS_PER_DAY),
      caption: post.caption[locale],
      hashtags: post.hashtags[locale],
      mediaBrief: post.mediaBrief[locale],
      locale,
      approximate: campaign.approximate,
    }))
    .sort((a, b) => a.date.getTime() - b.date.getTime());
};

/**
 * Substitute `{{placeholder}}` tokens. Unknown placeholders are left in place
 * rather than blanked, so a half-configured template is obvious in review
 * instead of silently shipping "Eid Mubarak from  ." to production.
 */
export const fillPlaceholders = (
  text: string,
  values: Record<string, string | number | undefined>
): string =>
  text.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
    const value = values[key];
    return value === undefined || value === '' ? match : String(value);
  });

/** List every placeholder a template still needs bound. */
export const missingPlaceholders = (
  text: string,
  values: Record<string, string | number | undefined>
): string[] => {
  const found = text.match(/\{\{(\w+)\}\}/g) ?? [];
  return Array.from(
    new Set(
      found
        .map((token) => token.slice(2, -2))
        .filter((key) => values[key] === undefined || values[key] === '')
    )
  );
};
