'use client';
import { FC, useEffect, useState } from 'react';
import { useTranslationSettings } from '@gitroom/react/translation/get.transation.service.client';
import {
  dirOfLanguage,
  fallbackLng,
} from '@gitroom/react/translation/i18n.config';

/**
 * Mirrors i18next's own notion of direction onto `<html>`.
 *
 * i18next's `dir()` only knows the base-language RTL table, so a regional tag
 * such as `ar-AE` is resolved through `dirOfLanguage()` here instead — that
 * helper normalises the region away before checking. `lang` is set alongside
 * `dir` because CSS `:lang()` selectors (Arabic font stack, letter-spacing
 * reset) key off it.
 */
export const HtmlComponent: FC = () => {
  const settings = useTranslationSettings();
  const [language, setLanguage] = useState(
    () => settings.resolvedLanguage || fallbackLng
  );

  useEffect(() => {
    const onChange = (lng: string) => setLanguage(lng || fallbackLng);
    settings.on('languageChanged', onChange);
    return () => {
      settings.off('languageChanged', onChange);
    };
  }, [settings]);

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('dir', dirOfLanguage(language));
    root.setAttribute('lang', language);
  }, [language]);

  return null;
};
