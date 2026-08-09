# RTL_VERIFICATION.md — Phase 7 (browser)

**Date:** 2026-08-08 · **Branch:** `claude/mena-saas-postiz-conversion-7el9fk`
**Method:** real Chromium (Playwright 1.58.2, Chromium rev 1194) driving a production
`next start` of `apps/frontend` on `http://localhost:4200`.
**Suite:** `tests/e2e/` · **Screenshots:** `docs/screenshots/` (28 PNGs, all real captures)

> **Status update — 2026-08-09.** This file records the earlier browser run and
> remains useful as historical evidence. Two defects it reports are now fixed:
> IBM Plex Sans Arabic is loaded by `next/font/google` and applied through the
> Nashr typography variable, and untranslated legal pages have an explicit LTR
> wrapper. The repository's production build passes. Authenticated RTL surfaces
> and server-rendered Arabic copy still require a full-stack browser pass; the
> latter can still flash English until hydration. The old intentional font-test
> failures described in §§5.2 and 8 are therefore no longer current.

---

## 0. What this document is, and what it is not

`libraries/nashr-i18n/RTL_CHECKLIST.md` (Phase 3) was explicit that **nothing in it had
ever been rendered** — it was static source inspection. This document is the browser pass
it asked for, but only over the surface that is actually reachable here.

**The backend could not be started, so roughly two thirds of the RTL-sensitive UI remains
unverified.** That is stated up front rather than buried, because the reachable surface
(five signed-out page templates) is the *easy* part of RTL. The calendar, the composer,
the modal stack, the context menus and every table are behind the auth gate and are
**still exactly as unverified as they were at the end of Phase 3.**

Every row below is labelled **VERIFIED IN BROWSER** or **NOT REACHABLE**. Nothing is
labelled from source reading.

---

## 1. Environment actually achieved

| Component | Status | Evidence |
|---|---|---|
| `apps/frontend` (Next.js 16.2.6, `next start`) | **running** | `✓ Ready in 207ms`; all 7 public routes return HTTP 200 |
| PostgreSQL 16 | **running**, schema applied | `psql \dt` lists the full model set including `NashrBrandProfile` |
| Redis | **running** | `redis-cli ping` → `PONG` |
| `apps/backend` (NestJS) | **WILL NOT START** | see §1.1 |
| Temporal | **absent** | nothing listening on 7233; no `temporal` binary; Docker daemon unavailable |

### 1.1 Why the backend cannot start

The compiled backend bootstraps, connects to Postgres, and then blocks permanently in
`TemporalRegister.onModuleInit`:

```
code: 14,
details: 'No connection established. Last error: Error: connect ECONNREFUSED 127.0.0.1:7233.'
    at TemporalRegister.onModuleInit (.../libraries/nestjs-libraries/src/temporal/temporal.register.js:17:71)
    at async NestApplication.listen (.../@nestjs/core/nest-application.js:175:13)
```

`onModuleInit` runs **before** `NestApplication.listen` resolves, so the process never
binds port 3000 — it is not a degraded backend, it is no backend at all. Temporal is a
separate service (Go server + its own schema); it is not installed, and the Docker daemon
is unavailable, so `temporalio/auto-setup` is not an option either.

**Consequence:** `/user/self` never resolves → `LayoutComponent` renders nothing →
every authenticated route redirects to `/auth`. Verified, not assumed: the suite asserts
that all eight authenticated routes bounce, and all eight do.

---

## 2. The five Phase 3 bugs, re-checked in a browser

| # | Phase 3 claim | Verdict | Evidence |
|---|---|---|---|
| 1 | `<html>` had no `dir`/`lang`; Arabic first-painted LTR and snapped after hydration. Fixed server-side. | **VERIFIED IN BROWSER — genuinely fixed** | §3 |
| 2 | Toast pushed off-screen in RTL (`start-[50%]` + physical `-translate-x-[50%]`). | **PARTIALLY VERIFIED** — the `--nashr-center-x` variable flips correctly (`-50%` LTR → `50%` RTL) on every rendered page. The toast component itself never renders on a signed-out page, so the fix is **NOT REACHABLE**. | §3, §6 |
| 3 | Both context menus anchored by measured `left`, opening off-viewport in RTL. | **NOT REACHABLE** — `menu.tsx` and `select.customer.tsx` only exist inside the authenticated app. | §6 |
| 4 | `dayjs.locale('ar-AE')` silently no-ops → English month names. | **NOT REACHABLE** — calendar is authenticated-only. | §6 |
| 5 | Tables and composer placeholder hard-left. | **NOT REACHABLE** — no `.table1` and no TipTap editor on any public page. | §6 |

So: **one of the five is confirmed fixed in a browser. Four are still unverified.**

---

## 3. Direction plumbing — VERIFIED IN BROWSER

This is the strongest result in the document, and it was checked three independent ways
so that a client-side `useEffect` could not fake a pass.

### 3.1 Raw HTTP response body (no JavaScript involved)

```
$ curl -s http://localhost:4200/about            | grep -o '<html[^>]*>'
<html lang="en" dir="ltr">
$ curl -s -b 'i18next=ar'    http://localhost:4200/about | grep -o '<html[^>]*>'
<html lang="ar" dir="rtl">
$ curl -s -b 'i18next=ar-AE' http://localhost:4200/about | grep -o '<html[^>]*>'
<html lang="ar-AE" dir="rtl">
$ curl -s -b 'i18next=ar-QA' http://localhost:4200/about | grep -o '<html[^>]*>'
<html lang="ar" dir="rtl">          # unshipped region narrows to base, as designed
$ curl -s -b 'i18next=zz-ZZ' http://localhost:4200/about | grep -o '<html[^>]*>'
<html lang="en" dir="ltr">          # junk falls back safely
```

Asserted for all 7 public routes × 5 locales in `rtl.direction.spec.ts`.

### 3.2 With JavaScript disabled

Rendered in a `javaScriptEnabled: false` context: `documentElement.dir === 'rtl'`,
`lang === 'ar'`, and `getComputedStyle(body).direction === 'rtl'`. Nothing but the server
can have produced those.

### 3.3 First paint vs post-hydration

`dir` read at `waitUntil: 'commit'` (before scripts execute) and again after hydration
settles: **identical**. There is no flash of wrong direction.

**Conclusion: the Phase 3 fix is real.** `resolveSupportedLanguage()` +
`dirOfLanguage()` in `app/(app)/layout.tsx` behave exactly as documented, including
regional-tag narrowing and junk-input safety.

---

## 4. Layout integrity in RTL — VERIFIED IN BROWSER

The automated overflow assertion the brief asked for, across 7 pages × 2 languages ×
2 viewports (1440×900 and 375×812) — 28 measurements:

| Metric | Result |
|---|---|
| `documentElement.scrollWidth` vs `clientWidth` | **0px overflow on every page, both languages, both viewports** |
| Elements with `getBoundingClientRect().left < 0` or `right > viewport width` | **zero**, every page |
| Computed `direction` on Arabic text nodes | `rtl` throughout |
| Computed `letter-spacing` on Arabic text | `normal` throughout (the cursive-join fix holds) |
| Computed `text-align` on Arabic text | `start` / `right` — no physical `left` survived |
| `--nashr-center-x` | `-50%` in LTR, `50%` in RTL |
| Arabic line-height | 23.8px on 14px text = 1.7, as specified |

Raw per-page JSON: `tests/e2e/.output/diagnostics/*.json`.

Visual confirmation (`login-en.png` vs `login-ar.png`): the sign-in card moves from the
left half to the right half, the logo flips to the right of its wordmark, form labels
right-align, and the footer item order reverses. The mirroring is correct.

Two things I checked because they *looked* wrong in the screenshots and turned out to be
fine — recorded so nobody re-raises them:

* **Footer `© 2026 Nashr` renders as `Nashr 2026 ©` in Arabic.** Correct. Read
  right-to-left that is `© 2026 Nashr`. Standard bidi reordering, not a bug.
* **The Google button loses its text label at 375px in Arabic.** It does the same in
  English. Responsive design, not RTL.

---

## 5. NEW BUGS FOUND IN THE BROWSER

Three issues that static inspection did not and could not catch.

### 5.1 🔴 English legal-page prose is bidi-mangled in Arabic sessions

**Severity: high — and it lands on the AGPL-3.0 §13 compliance page.**

`/about`, `/terms`, `/privacy` and `/licenses` contain **no `useT()` call anywhere**. They
are hardcoded English JSX. In an Arabic session they still inherit `dir="rtl"` from
`<html>`, and nothing wraps them in an LTR isolate — verified on the rendered page:

```
ltr-embed elements: 0      elements with dir="ltr": 0      (of 1035 elements on /licenses)
```

`global.scss` ships a `.ltr-embed` utility (`direction: ltr; unicode-bidi: isolate`)
for exactly this situation. These pages never use it.

The Unicode bidi algorithm therefore throws every sentence-final period, colon and
parenthesis to the wrong edge. From `docs/screenshots/licenses-ar.png`:

| Rendered in Arabic session | Should read |
|---|---|
| `.Nashr is free software. Here is what it is built from, and how to get the source` | `Nashr is free software. …how to get the source.` |
| `:You can obtain the complete source code of Nashr at` | `You can obtain the complete source code of Nashr at:` |
| `.gnu.org/licenses/agpl-3.0.html` | `gnu.org/licenses/agpl-3.0.html.` |
| `.of the exact version they are interacting with — including our modifications` | `…including our modifications.` |

And from `docs/screenshots/about-ar.png`, the opening sentence is scrambled outright:

> `is a social media management platform built for teams working in the Middle East. ("Arabic for "publishing —نشر) Nashr`

`/licenses` is the page carrying the AGPL §13 written source offer. It stays legible, but
a licence-compliance page that renders as visibly broken text to Arabic-locale users is
not a good place for this.

**Fix, cheapest first:** wrap the untranslated English blocks in `dir="ltr"` (one
attribute on `LegalPage`'s content container), or apply the existing `.ltr-embed` class.
Translating the four pages properly is the real answer, but the one-attribute fix removes
the mangling immediately.

**Regression test:** `rtl.content.spec.ts › legal page copy is language-independent`
currently asserts the copy is identical in both languages. It is designed to **fail** once
someone translates these pages, with a message telling them to update this document.

### 5.2 🟠 No Arabic typeface is ever shipped

**Severity: medium-high — affects every Arabic user on Linux/Android/ChromeOS.**

`global.scss` declares:

```scss
--nashr-font-arabic: 'IBM Plex Sans Arabic', 'Noto Kufi Arabic', 'Noto Sans Arabic',
                     'SF Arabic', 'Geeza Pro', 'Segoe UI', 'Dubai', Tahoma, sans-serif;
```

There is **no `@font-face` and no `next/font` loader behind any of those names** —
`grep` across `apps/frontend/src` and `libraries/nashr-i18n/src` finds no Arabic webfont
anywhere. The list is a request, not a delivery.

Confirmed with Chrome DevTools Protocol `CSS.getPlatformFontsForNode`, which reports the
faces actually used to rasterise glyphs:

```json
[{ "familyName": "DejaVu Sans", "isCustomFont": false, "glyphCount": 16 },
 { "familyName": "Liberation Sans", "isCustomFont": false, "glyphCount": 1 }]
```

`isCustomFont: false` = host OS font, nothing downloaded. Meanwhile the **Latin** font is
self-hosted properly — `document.fonts` contains `Plus Jakarta Sans` with
`status: "loaded"`, via `next/font/google` in `app/(app)/layout.tsx`.

So the fork loads a webfont for English and none for Arabic. The Arabic reading
experience is whatever the client OS happens to have: acceptable on macOS/iOS (SF Arabic)
and Windows (Tahoma/Segoe UI), but on Linux, many Android builds and ChromeOS it falls
through to a generic `sans-serif` with mediocre Arabic joining — which is what
`docs/screenshots/*-ar.png` show, since this container has none of the six named families
installed.

**This makes every Arabic screenshot in `docs/screenshots/` typographically
unrepresentative of a macOS or Windows user.** They are accurate captures of what a
Linux/Android user sees. Phase 8 should not present them as final design.

**Fix:** self-host IBM Plex Sans Arabic (SIL OFL, so redistribution is fine) through
`next/font/local` alongside Plus Jakarta Sans.

**Regression test:** `rtl.layout.spec.ts › Arabic glyphs are drawn by a font the product
actually ships` — **currently failing on purpose.** It is the only failing test in the
suite and it will stay red until an Arabic face is shipped.

### 5.3 🟡 Arabic sessions server-render English copy, then swap after hydration

**Severity: medium.** Direction is server-rendered; **text is not.**

`i18next.ts` configures `detection: { order: ['cookie', 'header'] }` using
`i18next-browser-languagedetector`, which cannot read `document.cookie` during SSR. So
`lng` is undefined on the server and every response falls back to English:

```
$ curl -s -b 'i18next=ar' http://localhost:4200/auth/login | <strip tags>
Nashr Sign In Continue With Google OR Email Password Sign in …     # 0 Arabic characters
```

After hydration the same page reads:

```
Nashr تسجيل الدخول المتابعة باستخدام جوجل أو البريد الإلكتروني كلمة المرور …
```

Both states verified in `rtl.content.spec.ts`. Practical effects:

* an Arabic user sees a **flash of English copy** on every full page load — the
  direction does not snap, but the words do;
* with JavaScript disabled the UI is **permanently English** inside an RTL document;
* crawlers and link unfurlers see English for Arabic URLs.

Phase 3 fixed the flash of wrong *direction*. The flash of wrong *language* is a separate
mechanism and is still present.

**Fix:** resolve the locale server-side from the cookie (the value is already read in
`app/(app)/layout.tsx` and passed to `VariableContextComponent`) and seed i18next with it
rather than relying on browser detection.

---

## 6. NOT REACHABLE — still unverified after this phase

Everything here needs a running backend, i.e. a Temporal server. **None of it was
rendered. None of it should be reported as passing.**

| Surface | RTL-sensitive work from Phase 3 | Status |
|---|---|---|
| Calendar — week / month / day / list | Grid mirroring, `start-0`, shimmer, error badge `-start-`, method badge `-end-` | **NOT REACHABLE** |
| Calendar — `dayjs` locale (bug #4) | `dayjsLocaleFor()` narrowing `ar-AE`→`ar` | **NOT REACHABLE** |
| Calendar — week start day per market | Known gap: `startOf('isoWeek')` is Monday; wrong for KSA/KW/QA/BH/OM/EG/JO | **NOT REACHABLE** (and still an open product gap) |
| Toaster (bug #2) | `rtl:translate-x-[50%]`, mirrored glow SVG | **NOT REACHABLE** — only the CSS variable was verified |
| `menu.tsx`, `select.customer.tsx` (bug #3) | `rect.right` anchoring under RTL | **NOT REACHABLE** |
| Modal stack (7 files) | `left-0` → `start-0` | **NOT REACHABLE** |
| Tables (bug #5) — `.table1`, impersonate, admin stats/errors, statistics | `text-start` / `text-end`, `rounded-ss/se` | **NOT REACHABLE** |
| Composer / TipTap placeholder (bug #5) | `float: inline-start`, list `padding-inline-start` | **NOT REACHABLE** |
| react-tags widget | 9 physical → logical properties | **NOT REACHABLE** |
| Uppy media uploader | Vendored `[dir=rtl]` stylesheet, never audited | **NOT REACHABLE** |
| Polotno design editor | ~16k lines vendored, `.bp5-rtl`, never audited | **NOT REACHABLE** |
| Mixed Arabic + Latin + URL composition | The highest-risk bidi case in the product | **NOT REACHABLE** |

The suite already covers these. `tests/e2e/specs/rtl.authenticated.spec.ts` holds the
specs and `pages.ts` lists all eight routes with the component each one exercises; they
skip with an explanatory message until `E2E_AUTH_COOKIE` is provided. Supplying a
backend and that cookie turns this table green or red without anyone writing new tests.

---

## 7. Screenshots

`docs/screenshots/` — 28 real captures, full-page, deterministic viewports, animations
frozen. Matched EN/AR pairs for all 7 reachable pages at both widths.

| Page | 1440×900 | 375×812 |
|---|---|---|
| `/auth` | `auth-en.png` · `auth-ar.png` | `auth-en-375.png` · `auth-ar-375.png` |
| `/auth/login` | `login-en.png` · `login-ar.png` | `login-en-375.png` · `login-ar-375.png` |
| `/auth/forgot` | `forgot-en.png` · `forgot-ar.png` | `forgot-en-375.png` · `forgot-ar-375.png` |
| `/about` | `about-en.png` · `about-ar.png` | `about-en-375.png` · `about-ar-375.png` |
| `/terms` | `terms-en.png` · `terms-ar.png` | `terms-en-375.png` · `terms-ar-375.png` |
| `/privacy` | `privacy-en.png` · `privacy-ar.png` | `privacy-en-375.png` · `privacy-ar-375.png` |
| `/licenses` | `licenses-en.png` · `licenses-ar.png` | `licenses-en-375.png` · `licenses-ar-375.png` |

**Caveats Phase 8 must carry with these images:**

1. Arabic glyphs are drawn by DejaVu Sans, not by any intended Nashr face (§5.2). They
   are accurate for Linux/Android, not for macOS/Windows.
2. `about/terms/privacy/licenses` in Arabic show **English copy** because those pages are
   untranslated (§5.1) — the visible mangling is the bug, not a capture error.
3. No authenticated screen appears. There is no calendar screenshot, and there cannot be
   one until Temporal runs.

---

## 8. Test suite

`tests/e2e/` — Playwright config, fixtures, helpers, 6 spec files, README with the exact
commands and environment. Latest full run:

```
$ PW_CHROMIUM_PATH=/opt/pw-browsers/chromium NODE_OPTIONS=--max-old-space-size=5120 \
  npx playwright test -c tests/e2e/playwright.config.ts

  2 failed
    [desktop-ar] › rtl.layout.spec.ts › Arabic glyphs are drawn by a font the product actually ships
    [mobile-ar]  › rtl.layout.spec.ts › Arabic glyphs are drawn by a font the product actually ships
  48 skipped     (authenticated surfaces — no backend)
  186 passed (11.9m)
```

The two failures are §5.2 and are intended to stay red until an Arabic webfont ships.
The 48 skips are the coverage gap in §6, and they report as skipped rather than passing
so that a green-looking run can never be mistaken for full coverage.

---

## 9. What a human still has to do

Unchanged from Phase 3, and this phase could not reduce it:

1. **Native Arabic review of ~700 machine-translated keys.** Untouched here.
2. **Visual QA of the authenticated app in an `ar-AE` session** — calendar in all four
   views, composer with mixed Arabic/Latin/URLs, toast, both context menus, modal stack,
   every table, media uploader. §6.
3. **Confirm the «نشر» guillemet brand convention** with the brand owner.
4. **Decide the per-market week start** (`MARKETS[*].firstDayOfWeek` exists; the calendar
   still hardcodes Monday).

New, from this phase:

5. **Ship an Arabic webfont** (§5.2) before any Arabic screenshot is used as design
   reference.
6. **Stop the legal pages rendering mangled English in RTL** (§5.1) — one `dir="ltr"`
   attribute buys the fix today; translation is the real answer.
7. **Resolve i18next server-side** (§5.3) to kill the flash of English.
