# Nashr browser (e2e) suite

Playwright specs that render the app in a real Chromium and assert its
right-to-left behaviour, plus the English/Arabic screenshot pairs used by the
launch documentation.

Findings from the first real run are written up in
[`RTL_VERIFICATION.md`](../../RTL_VERIFICATION.md) at the repo root.

---

## Quick start

```bash
# 1. Build the frontend once (this WILL OOM without the heap bump)
cd apps/frontend
NODE_OPTIONS=--max-old-space-size=5120 npx next build

# 2. Start it with the local-only env values
cd /path/to/repo
set -a && . tests/e2e/env.e2e.sh && set +a
(cd apps/frontend && npx next start -p 4200 &)

# 3. Run the suite
PW_CHROMIUM_PATH=/opt/pw-browsers/chromium \
NODE_OPTIONS=--max-old-space-size=5120 \
npx playwright test -c tests/e2e/playwright.config.ts
```

Screenshots land in `docs/screenshots/`. Per-page RTL diagnostics land in
`tests/e2e/.output/diagnostics/*.json`; the HTML report in `tests/e2e/.output/html`.

Run one project only:

```bash
npx playwright test -c tests/e2e/playwright.config.ts --project=desktop-ar
```

---

## Environment

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `E2E_BASE_URL` | no | `http://localhost:4200` | Where the frontend is listening. |
| `PW_CHROMIUM_PATH` | situational | unset | Absolute path to a Chromium binary. Needed only when the sandbox ships a browser revision older than the one this Playwright expects and `playwright install` is unavailable. Leave unset on a normal machine. |
| `NODE_OPTIONS` | yes for builds | — | Must include `--max-old-space-size=5120`; the Next build OOMs otherwise. |
| `E2E_MANAGE_SERVER` | no | unset | Set to `1` to let Playwright start `next start` itself. |
| `E2E_TZ` | no | `UTC` | Browser timezone; the neutral default keeps date rendering deterministic. Use `E2E_TZ=Asia/Dubai` for a UAE localization run. |
| `E2E_AUTH_COOKIE` | no | unset | Value of the app's `auth` cookie. **Unlocks the authenticated specs.** Without it, everything behind the auth gate is skipped and reported as unverified. |

`tests/e2e/env.e2e.sh` holds the frontend's own environment. Every value in it
is a deliberately fake local placeholder — there are no secrets in this
directory and none should ever be added.

### Frontend env the app needs

The public pages render with only these set (see `env.e2e.sh`):
`NOT_SECURED`, `IS_GENERAL`, `STORAGE_PROVIDER`, `FRONTEND_URL`, `MAIN_URL`,
`NEXT_PUBLIC_BACKEND_URL`. Everything else in `.env.example` is optional for
rendering; missing analytics/Sentry/Stripe keys just disable those features.

---

## What the suite covers

| Spec | What it proves |
|---|---|
| `config-contract.spec.ts` | The cookie name and public-route allow-list this suite hardcodes still match `i18n.config.ts` and `proxy.ts`. Without this a rename would silently make every "Arabic" screenshot English. |
| `rtl.direction.spec.ts` | `<html dir>`/`lang` come from the **server**, verified against the raw response body and again with JavaScript disabled. Also checks first-paint vs post-hydration `dir`, regional-locale narrowing (`ar-QA` → `ar`), junk-cookie fallback, and the `--nashr-center-x` flip. |
| `rtl.layout.spec.ts` | `scrollWidth` vs `clientWidth` (catches the off-screen-element class of bug automatically), no element escaping the viewport, Arabic text alignment/direction/letter-spacing, and — via CDP `CSS.getPlatformFontsForNode` — which font actually rasterised the Arabic glyphs. |
| `rtl.content.spec.ts` | When copy becomes Arabic (server render vs hydration), and that the hardcoded-English legal pages still mirror correctly. |
| `screenshots.spec.ts` | Writes the EN/AR pairs and asserts the auth gate still bounces every private route. |
| `rtl.authenticated.spec.ts` | Calendar, context menus, toast, tables. **Skipped without `E2E_AUTH_COOKIE`.** |

## Projects

| Project | Viewport | Locale cookie | Direction |
|---|---|---|---|
| `desktop-en` | 1440×900 | `en` | ltr |
| `desktop-ar` | 1440×900 | `ar` | rtl |
| `mobile-en` | 375×812 | `en` | ltr |
| `mobile-ar` | 375×812 | `ar` | rtl |
| `desktop-ar-AE` | 1440×900 | `ar-AE` | rtl (direction specs only) |

Locale is applied by writing the `i18next` cookie onto the browser context
**before the first navigation** (`fixtures/locale.ts`). That ordering is the
point: setting it after navigating would only ever exercise hydration and would
make the server-side-direction assertions vacuous.

---

## Extending to a full stack

Add routes to `AUTHENTICATED_ROUTES` in `pages.ts`; the overflow/stray-element
specs pick them up automatically. `pages.ts` already lists the eight
authenticated routes with a note recording which RTL-sensitive component each
one carries, so the coverage gap is legible from source.

---

## Arabic font regression

`rtl.layout.spec.ts › Arabic glyphs are drawn by a font the product actually ships`
guards the bundled Arabic typeface. IBM Plex Sans Arabic is loaded through
`next/font/google`; the test must pass even when the host operating system has no
Arabic font installed. See the 2026-08-09 update at the top of
`RTL_VERIFICATION.md` for the earlier finding and its resolution.
