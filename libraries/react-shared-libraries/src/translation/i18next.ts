import i18next from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import resourcesToBackend from 'i18next-resources-to-backend';
import { initReactI18next } from 'react-i18next/initReactI18next';
import {
  fallbackLng,
  fallbackLngMap,
  languages,
  defaultNS,
  baseLanguageOf,
} from './i18n.config';
const runsOnServerSide = typeof window === 'undefined';

/**
 * Regional locales (`ar-AE`, `en-SA`, ...) ship as thin overlay files that only
 * contain the keys which genuinely differ per market. If an overlay file is
 * ever missing we must not let the dynamic import reject — i18next would mark
 * the whole namespace as failed instead of falling through to the base
 * language. So we resolve to the base language file on failure.
 */
const loadTranslation = async (language: string, namespace: string) => {
  try {
    return await import(`./locales/${language}/${namespace}.json`);
  } catch {
    const base = baseLanguageOf(language);
    if (base !== language) {
      try {
        return await import(`./locales/${base}/${namespace}.json`);
      } catch {
        /* fall through to the ultimate fallback below */
      }
    }
    return import(`./locales/${fallbackLng}/${namespace}.json`);
  }
};

i18next
  .use(initReactI18next)
  .use(LanguageDetector)
  .use(
    resourcesToBackend((language: any, namespace: any) =>
      loadTranslation(language, namespace)
    )
  )
  .init({
    supportedLngs: languages,
    // Object form: per-locale chains, e.g. ar-AE -> ar -> en. See i18n.config.ts
    fallbackLng: fallbackLngMap,
    // Treat `ar-AE` as supported even where only `ar` resources resolve.
    nonExplicitSupportedLngs: true,
    lng: undefined,
    fallbackNS: defaultNS,
    defaultNS,
    detection: {
      order: ['cookie', 'header'],
    },
    preload: runsOnServerSide ? languages : [],
  });

export default i18next;
