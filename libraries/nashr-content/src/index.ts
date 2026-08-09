/**
 * @gitroom/nashr-content
 *
 * Bilingual (en/ar) campaign templates and MENA sample content, expressed as
 * typed data. No UI, no I/O — other phases consume it.
 *
 * Campaign anchor dates are declarative. Resolve Hijri anchors with
 * `fromHijri()` from `@gitroom/nashr-i18n`, and remember that every Hijri date
 * is approximate until the local moon sighting is announced.
 */
export * from './types';
export * from './tone';
export * from './campaigns';
export * from './verticals';
export * from './resolve';
