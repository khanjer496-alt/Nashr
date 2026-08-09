import { test as base, expect, type BrowserContext } from '@playwright/test';

/**
 * Name of the cookie i18next reads to decide the UI language.
 *
 * Canonical source: `libraries/react-shared-libraries/src/translation/i18n.config.ts`
 * (`export const cookieName = 'i18next'`). `specs/config-contract.spec.ts`
 * asserts this copy has not drifted from that file, so a rename upstream fails
 * a test instead of silently making every "Arabic" screenshot English.
 */
export const LOCALE_COOKIE = 'i18next';

/** Locales this suite drives. Keep in step with `regionalLanguages` / `baseLanguages`. */
export type Locale = 'en' | 'ar' | 'en-AE' | 'ar-AE' | 'en-SA' | 'ar-SA';

export interface LocaleOptions {
  /** Value written into the `i18next` cookie before the first navigation. */
  nashrLocale: Locale;
  /** Direction the document is expected to render in for `nashrLocale`. */
  expectedDir: 'ltr' | 'rtl';
  /** Short tag used in screenshot filenames: `about-ar.png`. */
  langTag: string;
}

/**
 * Sets the locale cookie on the browser context *before* any page is created,
 * so the very first server response is already rendered in the target locale.
 * This is what makes the "is `dir` server-rendered?" assertion meaningful —
 * setting the cookie after navigating would only ever test hydration.
 */
export const test = base.extend<LocaleOptions>({
  nashrLocale: ['en', { option: true }],
  expectedDir: ['ltr', { option: true }],
  langTag: ['en', { option: true }],

  context: async ({ context, nashrLocale, baseURL }, use) => {
    await seedLocaleCookie(context, baseURL!, nashrLocale);
    await use(context);
  },
});

export async function seedLocaleCookie(
  context: BrowserContext,
  baseURL: string,
  locale: string
) {
  const { hostname } = new URL(baseURL);
  await context.addCookies([
    { name: LOCALE_COOKIE, value: locale, domain: hostname, path: '/' },
  ]);
}

export { expect };
