'use client';

import useCookie from 'react-use-cookie';
import {
  cookieName,
  fallbackLng,
  dirOfLanguage,
  resolveSupportedLanguage,
} from '@gitroom/react/translation/i18n.config';
import i18next from 'i18next';
import { FC, useEffect } from 'react';

/**
 * Keeps `<html lang>` / `<html dir>` in sync with the active locale.
 *
 * The server already emits both attributes (see `app/(app)/layout.tsx`), so
 * this is a reconciliation pass rather than the source of truth — it exists to
 * catch the cases the server render cannot:
 *
 *   • the user switches language without a full page reload,
 *   • i18next's language detector resolves to something other than the cookie.
 *
 * It re-runs whenever the cookie changes; the previous implementation had an
 * empty dependency array and so never reacted to a language switch, leaving the
 * document direction stale until the next hard navigation.
 */
export const ChangeDir: FC = () => {
  const currentLanguage = i18next.resolvedLanguage || fallbackLng;
  const [language] = useCookie(cookieName, currentLanguage || fallbackLng);

  useEffect(() => {
    const resolved = resolveSupportedLanguage(language || currentLanguage);
    const root = document.documentElement;
    root.setAttribute('dir', dirOfLanguage(resolved));
    root.setAttribute('lang', resolved);
  }, [language, currentLanguage]);

  return null;
};
