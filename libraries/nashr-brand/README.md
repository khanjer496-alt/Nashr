# nashr-brand

Single source of truth for Nashr (نشر) brand strings, URLs and design tokens.

Consumed by `apps/frontend`, `apps/backend` and `libraries/nestjs-libraries` via the
TypeScript path alias `@gitroom/nashr-brand/*` (see `tsconfig.base.json`).

```ts
import { brand, brandTitle } from '@gitroom/nashr-brand/brand.config';
```

Like `libraries/helpers`, this library has **no `package.json`** — it is not a pnpm
workspace package, it is resolved purely through `tsconfig.base.json` `paths`. Adding a
`package.json` would register a new pnpm workspace importer that is absent from
`pnpm-lock.yaml` and would break `pnpm install --frozen-lockfile` in CI.

## Environment variables

All are optional; every one has an empty-safe fallback so the app boots unconfigured.

| Variable | Fallback | Purpose |
|---|---|---|
| `NEXT_PUBLIC_APP_URL` | `https://nashr.example` | Public origin. **Placeholder** — never commit a real domain. |
| `NEXT_PUBLIC_SUPPORT_EMAIL` | `support@<domain>` | Support contact shown in-app and in legal pages. |
| `NEXT_PUBLIC_PRIVACY_EMAIL` | `privacy@<domain>` | Data-protection contact. |
| `NEXT_PUBLIC_BRAND_LEGAL_NAME` | *(empty)* | Registered legal entity. Empty ⇒ legal pages render a "needs review" placeholder. |
| `NEXT_PUBLIC_BRAND_JURISDICTION` | *(empty)* | e.g. `Dubai, United Arab Emirates`. |
| `NEXT_PUBLIC_BRAND_GOVERNING_LAW` | *(empty)* | Governing-law clause text. |
| `NEXT_PUBLIC_SOURCE_URL` | upstream Postiz repo | AGPL-3.0 §13 Corresponding Source offer. |
| `NEXT_PUBLIC_DOCS_URL` | *(empty)* | Documentation site. |
| `NEXT_PUBLIC_SOCIAL_X` / `_INSTAGRAM` / `_LINKEDIN` / `_TIKTOK` / `_YOUTUBE` | *(empty)* | Social profiles; empty entries are not rendered. |

No secrets belong in this file — it is bundled into the browser.

## Attribution

Nashr is built on [Postiz](https://github.com/gitroomhq/postiz-app) and distributed under
the AGPL-3.0. `brand.upstream` carries that attribution; do not remove it.
