/**
 * Barrel for `@gitroom/nashr-brand`.
 *
 * Import brand strings from here (or from `@gitroom/nashr-brand/brand.config`)
 * — never re-declare a brand literal in application code.
 *
 * Note: the `@gitroom/*` scope is kept deliberately. Renaming the internal
 * import scope would conflict with every future upstream Postiz merge, so
 * Nashr libraries live under the same scope. See FORK_CUSTOMIZATIONS.md.
 */
export * from './brand.config';
export { brand as default } from './brand.config';
