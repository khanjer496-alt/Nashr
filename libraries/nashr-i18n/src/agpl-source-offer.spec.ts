/**
 * AGPL-3.0 section 13 regression guard.
 *
 * Because Nashr is offered over a network, every remote user must be offered
 * the Corresponding Source of THIS modified version. The billing FAQ carries
 * that offer.
 *
 * The bug this pins: the translated resource values hardcoded
 * `https://github.com/gitroomhq/postiz-app`. i18next prefers a resource value
 * over the React default, so the customer-facing "view the source code" link
 * pointed at upstream Postiz regardless of NEXT_PUBLIC_SOURCE_URL -- an unmet
 * section 13 obligation AND a customer-facing use of the Postiz trademark.
 * It was present in all 16 locales and survived the earlier branding sweep
 * because the sweep matched "Postiz", not the lowercase URL.
 */
import * as fs from 'fs';
import * as path from 'path';

const LOCALES_DIR = path.join(
  __dirname,
  '../../react-shared-libraries/src/translation/locales'
);
const SOURCE_OFFER_KEY = 'faq_postiz_gitroom_is_proudly_open_source';
const UPSTREAM_REPO = 'gitroomhq/postiz-app';

const locales = fs
  .readdirSync(LOCALES_DIR)
  .filter((d) => fs.statSync(path.join(LOCALES_DIR, d)).isDirectory());

const load = (locale: string): Record<string, string> =>
  JSON.parse(
    fs.readFileSync(path.join(LOCALES_DIR, locale, 'translation.json'), 'utf8')
  );

describe('AGPL section 13 source offer', () => {
  it('finds locale files to check', () => {
    expect(locales.length).toBeGreaterThan(0);
  });

  it.each(locales)(
    '[%s] source-offer link is interpolated, never a hardcoded upstream URL',
    (locale) => {
      const value = load(locale)[SOURCE_OFFER_KEY];
      if (value === undefined) return; // key absent is fine; the default applies
      expect(value).not.toContain(UPSTREAM_REPO);
      expect(value).toContain('{{sourceUrl}}');
    }
  );

  it.each(locales)(
    '[%s] no customer-facing string links to the upstream repository',
    (locale) => {
      const offenders = Object.entries(load(locale))
        .filter(([, v]) => typeof v === 'string' && v.includes(UPSTREAM_REPO))
        .map(([k]) => k);
      expect(offenders).toEqual([]);
    }
  );
});
