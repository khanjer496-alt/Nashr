/**
 * Nashr (نشر) — centralised brand configuration.
 *
 * This module is the SINGLE SOURCE OF TRUTH for every customer-facing brand
 * string, colour token and URL. Nothing in `apps/*` or `libraries/*` should
 * contain a hard-coded brand literal — import from here instead.
 *
 * Runtime notes
 * -------------
 * - Dependency free on purpose: it is imported from Next.js server components,
 *   Next.js client components, NestJS (backend + orchestrator) and plain Node
 *   scripts. Do not add imports to this file.
 * - `process.env.NEXT_PUBLIC_*` is read via direct member access so the Next.js
 *   compiler can statically inline the values into the client bundle. Never
 *   destructure or index `process.env` dynamically here.
 * - Every value has an empty-safe fallback so the app boots without any brand
 *   environment variables configured.
 *
 * Nashr is built on Postiz (https://github.com/gitroomhq/postiz-app) and is
 * distributed under the AGPL-3.0. See `brand.upstream` and `/licenses`.
 */

const env = (value: string | undefined, fallback: string): string =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback;

/**
 * Placeholder domain. The real domain is supplied through `NEXT_PUBLIC_APP_URL`.
 * Never replace this with a live domain — it is the documented fallback only.
 */
export const FALLBACK_APP_URL = 'https://nashr.example';

const appUrl = env(process.env.NEXT_PUBLIC_APP_URL, FALLBACK_APP_URL);

const domain = (() => {
  try {
    return new URL(appUrl).host;
  } catch {
    return 'nashr.example';
  }
})();

export interface BrandSocial {
  readonly x: string;
  readonly instagram: string;
  readonly linkedin: string;
  readonly tiktok: string;
  readonly youtube: string;
}

export interface BrandLegal {
  /**
   * Registered legal entity. Intentionally NOT hard-coded: supply via
   * `NEXT_PUBLIC_BRAND_LEGAL_NAME`. Empty string means "not yet decided" and
   * the legal pages render an explicit placeholder notice.
   */
  readonly entityName: string;
  /** e.g. "Dubai, United Arab Emirates". Supply via `NEXT_PUBLIC_BRAND_JURISDICTION`. */
  readonly jurisdiction: string;
  /** Governing-law wording. Supply via `NEXT_PUBLIC_BRAND_GOVERNING_LAW`. */
  readonly governingLaw: string;
  /** True when the legal identity has been configured by the operator. */
  readonly isConfigured: boolean;
}

export interface BrandUpstream {
  readonly name: string;
  readonly url: string;
  readonly license: string;
  readonly attribution: string;
}

export interface BrandColors {
  readonly primary: string;
  readonly primaryHover: string;
  readonly primarySoft: string;
  readonly accent: string;
  readonly accentHover: string;
  readonly gold: string;
  readonly ink: string;
  readonly surface: string;
  readonly surfaceRaised: string;
  readonly border: string;
  readonly textPrimary: string;
  readonly textMuted: string;
  readonly success: string;
  readonly warning: string;
  readonly danger: string;
  readonly info: string;
}

export interface Brand {
  readonly name: string;
  readonly nameAr: string;
  readonly nameLower: string;
  readonly legalName: string;
  readonly legal: BrandLegal;
  readonly tagline: string;
  readonly taglineAr: string;
  readonly description: string;
  readonly descriptionAr: string;
  readonly appUrl: string;
  readonly domain: string;
  readonly supportEmail: string;
  readonly privacyEmail: string;
  readonly termsUrl: string;
  readonly privacyUrl: string;
  readonly aboutUrl: string;
  readonly licensesUrl: string;
  readonly sourceUrl: string;
  readonly docsUrl: string;
  readonly defaultLocale: string;
  readonly locales: readonly string[];
  readonly defaultTimezone: string;
  readonly colors: BrandColors;
  readonly logo: {
    readonly mark: string;
    readonly wordmark: string;
    readonly wordmarkAr: string;
    readonly favicon: string;
    readonly faviconIco: string;
    readonly appleTouchIcon: string;
    readonly ogImage: string;
  };
  readonly social: BrandSocial;
  readonly upstream: BrandUpstream;
}

const legalEntityName = env(process.env.NEXT_PUBLIC_BRAND_LEGAL_NAME, '');

/**
 * MENA-oriented palette: a deep Gulf teal as the primary action colour with a
 * warm copper accent and a restrained gold for decorative detail. Both the
 * primary and the accent clear 4.5:1 against white text, so they are safe for
 * filled buttons in the dark theme the app ships with.
 */
const colors: BrandColors = {
  primary: '#0E7C74',
  primaryHover: '#0B655E',
  primarySoft: '#14A79B',
  accent: '#B4552D',
  accentHover: '#96431F',
  gold: '#C8912F',
  ink: '#0E0E0E',
  surface: '#1A1919',
  surfaceRaised: '#212020',
  border: '#2B2B2B',
  textPrimary: '#FFFFFF',
  textMuted: '#9C9C9C',
  success: '#2E9E6B',
  warning: '#D99A2B',
  danger: '#D6453D',
  info: '#2F80ED',
};

export const brand: Brand = {
  name: 'Nashr',
  nameAr: 'نشر',
  nameLower: 'nashr',

  /** Display name used in legal copy — falls back to the product name. */
  legalName: legalEntityName || 'Nashr',
  legal: {
    entityName: legalEntityName,
    jurisdiction: env(process.env.NEXT_PUBLIC_BRAND_JURISDICTION, ''),
    governingLaw: env(process.env.NEXT_PUBLIC_BRAND_GOVERNING_LAW, ''),
    isConfigured: legalEntityName.length > 0,
  },

  tagline: 'Social media management for the Middle East',
  taglineAr: 'إدارة وسائل التواصل الاجتماعي لمنطقة الشرق الأوسط',
  description:
    'Plan, approve and publish social content across every channel — in Arabic and English, on Gulf time.',
  descriptionAr:
    'خطّط للمحتوى واعتمده وانشره على جميع القنوات — بالعربية والإنجليزية، وبتوقيت الخليج.',

  appUrl,
  domain,

  supportEmail: env(process.env.NEXT_PUBLIC_SUPPORT_EMAIL, `support@${domain}`),
  privacyEmail: env(process.env.NEXT_PUBLIC_PRIVACY_EMAIL, `privacy@${domain}`),

  termsUrl: '/terms',
  privacyUrl: '/privacy',
  aboutUrl: '/about',
  licensesUrl: '/licenses',

  /**
   * AGPL-3.0 §13 source offer. Point this at the public mirror of THIS
   * deployment's source. Defaults to upstream so the offer is never a dead end.
   */
  sourceUrl: env(
    process.env.NEXT_PUBLIC_SOURCE_URL,
    'https://github.com/gitroomhq/postiz-app'
  ),
  docsUrl: env(process.env.NEXT_PUBLIC_DOCS_URL, ''),

  defaultLocale: 'en',
  locales: ['en', 'ar'],
  defaultTimezone: 'Asia/Dubai',

  colors,

  logo: {
    mark: '/nashr-mark.svg',
    wordmark: '/nashr-logo.svg',
    wordmarkAr: '/nashr-logo-ar.svg',
    favicon: '/favicon.svg',
    faviconIco: '/favicon.ico',
    appleTouchIcon: '/apple-touch-icon.png',
    ogImage: '/nashr-og.png',
  },

  social: {
    x: env(process.env.NEXT_PUBLIC_SOCIAL_X, ''),
    instagram: env(process.env.NEXT_PUBLIC_SOCIAL_INSTAGRAM, ''),
    linkedin: env(process.env.NEXT_PUBLIC_SOCIAL_LINKEDIN, ''),
    tiktok: env(process.env.NEXT_PUBLIC_SOCIAL_TIKTOK, ''),
    youtube: env(process.env.NEXT_PUBLIC_SOCIAL_YOUTUBE, ''),
  },

  /**
   * Upstream attribution. Required by the AGPL-3.0 and by
   * MENA_CUSTOMIZATIONS.md — do not remove.
   */
  upstream: {
    name: 'Postiz',
    url: 'https://github.com/gitroomhq/postiz-app',
    license: 'AGPL-3.0',
    attribution: 'Built on Postiz (AGPL-3.0)',
  },
};

/** Absolute URL helper — resolves a path against the configured app URL. */
export const brandUrl = (path = '/'): string =>
  `${brand.appUrl.replace(/\/+$/, '')}/${String(path).replace(/^\/+/, '')}`;

/**
 * Page title helper. Mirrors the upstream `${product} ${page}` convention used
 * across `apps/frontend/src/app/**` so titles stay consistent.
 */
export const brandTitle = (page?: string): string =>
  page ? `${brand.name} ${page}` : brand.name;

/** Social links that the operator has actually configured. */
export const activeSocialLinks = (): readonly { key: keyof BrandSocial; url: string }[] =>
  (Object.keys(brand.social) as (keyof BrandSocial)[])
    .filter((key) => brand.social[key].length > 0)
    .map((key) => ({ key, url: brand.social[key] }));

export default brand;
