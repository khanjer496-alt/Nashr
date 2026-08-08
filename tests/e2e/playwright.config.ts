import { defineConfig, devices } from '@playwright/test';
import type { LocaleOptions } from './fixtures/locale';

/**
 * Playwright config for the Nashr browser suite.
 *
 * Run:  npx playwright test -c tests/e2e/playwright.config.ts
 * See tests/e2e/README.md for the required environment.
 */

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:4200';

/**
 * Some sandboxes ship a Chromium build whose revision predates the one this
 * Playwright version expects, and `playwright install` is unavailable. Pointing
 * at the on-disk binary is the supported escape hatch; leave unset on a normal
 * machine so Playwright picks its own managed browser.
 */
const executablePath = process.env.PW_CHROMIUM_PATH || undefined;

/** Full-page desktop shots. 1440x900 is the reference design width. */
const DESKTOP = { width: 1440, height: 900 };
/** Narrow shots. 375px is the iPhone SE/12-mini class width. */
const MOBILE = { width: 375, height: 812 };

export default defineConfig<LocaleOptions>({
  testDir: './specs',
  // All generated output stays inside tests/e2e (see .gitignore here). The repo
  // root .gitignore does not cover a top-level Playwright directory, so writing
  // there would leave untracked build artefacts lying in the working tree.
  outputDir: './.output/results',
  snapshotDir: './__snapshots__',
  timeout: 60_000,
  expect: { timeout: 10_000 },

  /**
   * Serial by default. The specs write screenshots to fixed paths under
   * docs/screenshots, so parallel workers racing on the same file would produce
   * torn PNGs.
   */
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,

  reporter: [
    ['list'],
    ['json', { outputFile: './.output/report.json' }],
    ['html', { outputFolder: './.output/html', open: 'never' }],
  ],

  use: {
    baseURL: BASE_URL,
    // Deterministic captures: freeze the clock-adjacent bits we can.
    timezoneId: process.env.E2E_TZ || 'Asia/Dubai',
    colorScheme: 'dark',
    deviceScaleFactor: 1,
    trace: 'retain-on-failure',
    screenshot: 'off', // specs capture explicitly; no implicit failure shots
    video: 'off',
    launchOptions: { executablePath },
    /**
     * The app renders the locale from the `i18next` cookie, not from
     * Accept-Language — but sending a matching header keeps the proxy's
     * header-based detection from disagreeing with the cookie.
     */
    ignoreHTTPSErrors: true,
  },

  projects: [
    {
      name: 'desktop-en',
      use: {
        ...devices['Desktop Chrome'],
        viewport: DESKTOP,
        locale: 'en-AE',
        nashrLocale: 'en',
        expectedDir: 'ltr',
        langTag: 'en',
      },
    },
    {
      name: 'desktop-ar',
      use: {
        ...devices['Desktop Chrome'],
        viewport: DESKTOP,
        locale: 'ar-AE',
        nashrLocale: 'ar',
        expectedDir: 'rtl',
        langTag: 'ar',
      },
    },
    {
      name: 'mobile-en',
      use: {
        ...devices['Desktop Chrome'],
        viewport: MOBILE,
        isMobile: false, // Chromium desktop build: mobile emulation needs the mobile channel
        locale: 'en-AE',
        nashrLocale: 'en',
        expectedDir: 'ltr',
        langTag: 'en',
      },
    },
    {
      name: 'mobile-ar',
      use: {
        ...devices['Desktop Chrome'],
        viewport: MOBILE,
        isMobile: false,
        locale: 'ar-AE',
        nashrLocale: 'ar',
        expectedDir: 'rtl',
        langTag: 'ar',
      },
    },
    /**
     * Regional overlay locales. `ar-AE` must resolve to dir=rtl and keep its
     * full regional tag in `lang`, which is what makes market-specific CSS
     * (`:lang(ar-AE)`) and `Intl` formatting behave.
     */
    {
      name: 'desktop-ar-AE',
      use: {
        ...devices['Desktop Chrome'],
        viewport: DESKTOP,
        locale: 'ar-AE',
        nashrLocale: 'ar-AE',
        expectedDir: 'rtl',
        langTag: 'ar-AE',
      },
      testMatch: /rtl\.direction\.spec\.ts/,
    },
  ],

  /**
   * Optional: let Playwright own the frontend process. Off unless
   * E2E_MANAGE_SERVER=1, because in most local runs the server is already up
   * and `reuseExistingServer` alone cannot supply the env the app needs.
   */
  webServer: process.env.E2E_MANAGE_SERVER
    ? {
        command: 'npx next start -p 4200',
        cwd: '../../apps/frontend',
        url: BASE_URL,
        reuseExistingServer: true,
        timeout: 120_000,
        env: {
          NODE_OPTIONS: '--max-old-space-size=5120',
          NOT_SECURED: 'true',
          IS_GENERAL: 'true',
          STORAGE_PROVIDER: 'local',
          FRONTEND_URL: BASE_URL,
          MAIN_URL: BASE_URL,
          NEXT_PUBLIC_BACKEND_URL:
            process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3000/api',
        },
      }
    : undefined,
});
