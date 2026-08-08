# RTL audit checklist — Phase 3

**Date:** 2026-08-08 · **Branch:** `claude/mena-saas-postiz-conversion-7el9fk`
**Locales in scope:** `ar`, `ar-AE`, `ar-SA` (and `he`, which benefits from the same fixes)

---

## ⚠️ Method — read this before trusting any row below

**Everything in this document is STATIC SOURCE INSPECTION. Nothing was rendered in a
browser.** There is no browser or headless renderer in this environment, so no row here is
a claim about observed visual behaviour.

What *was* mechanically verified, with real command output:

| Check | How | Result |
|---|---|---|
| Frontend typecheck | `npx tsc --noEmit -p tsconfig.json` | **0 errors** |
| Frontend production build | `npx next build` | **succeeded**, all 29 routes emitted |
| RTL CSS reaches the bundle | grepped `.next/static/chunks/*.css` | 23 `html[dir=rtl]` rules present |
| Logical Tailwind utilities compile | grepped compiled CSS | `margin-inline-start` ×15, `padding-inline-start` ×23, `padding-inline-end` ×18 |
| `rtl:` variants compile | grepped compiled CSS | `.rtl\:translate-x-\[50\%\]:where([dir=rtl],[dir=rtl] *)` present |
| Logical corner radii compile | grepped compiled CSS | `border-end-start-radius`, `border-start-start-radius`, `border-start-end-radius` present |

So: the code compiles, and the CSS that *should* produce correct RTL is provably in the
output bundle. Whether it *looks* right still needs a human with an Arabic session.

**A native-Arabic visual QA pass on a running instance is still required before launch.**
See "What still needs a human" at the end.

---

## Summary of what was actually broken

The audit report credited the fork with "99 `rtl` references" in the frontend. That number
does not survive contact with the source: `grep -rni rtl apps/frontend/src` returns 62
lines, and **all but 6 of them are substring matches on `shortlink` / `shortLink`**. The
genuine pre-existing RTL support was:

* `rtl:rotate-180` on four calendar navigation arrows (`filters.tsx`),
* one `rtl:rotate-180` in `launches.component.tsx`,
* three `html[dir='rtl']` escape-hatch rules in `global.scss`,
* a partial conversion of `calendar.tsx` to `start-`/`end-`/`text-start` (upstream work).

That is considerably less than the audit implied, and the highest-impact problems were all
still open.

### The five that actually mattered

1. **`<html>` had no `dir` and no `lang` at all.** Direction was applied only by a
   client-side `useEffect`, so the first paint of every Arabic session was laid out
   left-to-right and visibly snapped after hydration. `lang` was never set, so CSS
   `:lang(ar)` selectors could never match.
2. **The toast notification was positioned off-screen in RTL.** `start-[50%]` is logical
   (`right: 50%` in RTL) but `-translate-x-[50%]` is physical and always moves left — so
   in Arabic the toast was displaced by its own full width instead of being centred.
3. **Both context menus anchored by measured `left`.** `menu.tsx` and `select.customer.tsx`
   read `getBoundingClientRect().left` and set `style={{ left }}` on a `fixed`/`absolute`
   panel. In RTL the trigger sits near the right edge, so the panel opened rightwards and
   ran off the viewport.
4. **`dayjs.locale('ar-AE')` silently no-ops.** Only base-language dayjs bundles are
   imported. `dayjs.locale()` does not throw on an unloaded locale — it keeps the previous
   one. An `ar-AE` user's calendar would have rendered English month and weekday names.
5. **Tables and the composer placeholder were hard-left.** `.table1 th/td { text-align:
   left }` and `.tiptap ...::before { float: left }` — every table and the empty-editor
   placeholder hugged the wrong edge in Arabic.

Plus a content-level bug: the Arabic `agent_welcome_message` told users to look in
"القائمة اليسرى" (the **left** menu) and "القائمة اليمنى" (the **right** menu) — a literal
translation that is factually wrong once the layout mirrors.

---

## Component-by-component

**Legend** — ✅ fixed · ✔︎ already correct, no change · ⚠︎ partial / known limitation ·
➖ inspected, out of scope

### Document shell & direction plumbing

| Component | Status | Finding / fix |
|---|---|---|
| `app/(app)/layout.tsx` | ✅ | `<html>` had neither `lang` nor `dir`. Now emits both server-side from the resolved cookie locale, killing the flash-of-wrong-direction. |
| `app/(provider)/layout.tsx` | ✅ | Hardcodes `language="en"`; added static `lang="en" dir="ltr"`. |
| `app/(extension)/layout.tsx` | ✅ | Same. |
| `app/global-error.tsx` | ➖ | Also has a bare `<html>`. Left alone — it is the last-resort crash screen and another workstream is editing it. Low value, noted for completeness. |
| `new-layout/change.dir.tsx` | ✅ | `useEffect` had an **empty dependency array**, so it never reacted to a language switch — direction went stale until a hard navigation. Now depends on the cookie, sets `lang` as well as `dir`, and routes through `dirOfLanguage()` so regional tags work. |
| `layout/html.component.tsx` | ✅ | Used i18next's own `dir()`, which only knows base languages. Now uses `dirOfLanguage()` (normalises the region away) and also sets `lang`. Also fixed a real leak: the `languageChanged` listener was registered without a cleanup. |
| `layout/language.component.tsx` | ✅ | Hardcoded `rtlLanguages = ['he','ar']` missed every regional tag, so switching to `ar-AE` left the document LTR. Now uses the shared helper. Flag badge was centred with physical `left: 50%` + `translate(-50%)`; switched to `inset-inline-start` with a direction-aware half-step var. |

### Notifications

| Component | Status | Finding / fix |
|---|---|---|
| `react-shared-libraries/toaster/toaster.tsx` | ✅ | **The worst single bug found.** `start-[50%]` (logical) combined with `-translate-x-[50%]` (physical) pushed the toast a full width off-centre in RTL. Added `rtl:translate-x-[50%]`. Verified the variant compiles into the bundle. |
| Toaster decorative glow SVG | ✅ | Ellipse is drawn bleeding off the SVG's left edge and pinned to `start-0`; added `rtl:-scale-x-100` so it bleeds off the correct edge when mirrored. |

### Modals

| Component | Status | Finding / fix |
|---|---|---|
| `layout/new-modal.tsx` | ✅ | Four `left-0` on overlay/positioning wrappers → `start-0`. Close button already used `end-[20px]` ✔︎. Backdrop is full-viewport so `left-0` was not *visibly* broken, but `start-0` is correct and removes the trap for future `min-w` changes. |
| `new-launch/manage.modal.tsx` | ✅ | One `left-0` on a full-height scroll pane → `start-0`. The rest of this file already used `ps-`/`pe-` ✔︎. |
| `new-launch/modal.wrapper.component.tsx` | ✅ | Scroll-anchor element `left-0` → `start-0`. |
| `onboarding/onboarding.modal.tsx` | ✅ | Overlay `left-0` → `start-0`. |
| `billing/finish.trial.tsx` | ✅ | Overlay `left-0` → `start-0`. |
| `launches/ai.video.tsx` | ✅ | Overlay `left-0` → `start-0`. |
| `third-parties/third-party.media-library.tsx` | ✅ | Overlay `left-0` → `start-0`; two `text-left` → `text-start`. |
| `launches/import-debug-post.modal.tsx` | ✅ | `ml-[8px]` → `ms-[8px]`, `ml-auto` → `ms-auto`. |
| Modal close/Escape/focus behaviour | ✔︎ | Direction-independent. |

### Menus

| Component | Status | Finding / fix |
|---|---|---|
| `launches/menu/menu.tsx` | ✅ | Anchored by measured `left` → opened off-screen in RTL. Now measures `rect.right` and anchors by `right` when `dir=rtl`. |
| `launches/select.customer.tsx` | ✅ | Same bug, same fix. Also `pl-/pr-` → `ps-/pe-`. |
| `new-launch/mention.component.tsx` | ✔︎ | Uses floating-ui `computePosition` with `placement: 'bottom-start'`. floating-ui resolves `start` against the element's computed direction, so this is already correct. **No change made.** |
| `new-layout/menu-item.tsx` | ✔︎ | Pure flex column, centred content, no physical offsets. |
| `layout/top.menu.tsx` | ✔︎ | Data/config only; renders through `MenuItem`. |
| `new-layout/layout.component.tsx` | ✔︎ | Side rail already uses `start-[17px]`. (The `id="left-menu"` is a DOM id, not a style — harmless.) |
| `layout/organization.selector.tsx` | ✔︎ | Dropdown already uses `end-0`. |
| `layout/support.tsx` | ✔︎ | Already uses `end-[20px]`. |
| `new-launch/select.current.tsx` | ✅ | `left-0` on an absolutely positioned panel → `start-0`. |

### Calendar — the hardest case

| Component | Status | Finding / fix |
|---|---|---|
| `launches/calendar.tsx` — week view grid | ✔︎ | `[grid-template-columns:136px_repeat(7,...)]` with `start-0`. CSS Grid reverses column order under `dir=rtl`, which is exactly what an Arabic calendar wants: first day of the week on the right, and the 136px time gutter moves to the right edge with it. Upstream had already converted this. |
| `launches/calendar.tsx` — month view grid | ✔︎ | `grid-cols-7` + `start-0`. Same reasoning. |
| `launches/calendar.tsx` — day / list views | ✔︎ | `absolute start-0` already. |
| `launches/calendar.tsx` — loading shimmer | ✅ | `absolute left-0` → `start-0`. |
| `launches/calendar.tsx` — post error badge | ✅ | `-left-[6px]` → `-start-[6px]` so it stays on the chip's outer corner after mirroring. |
| `launches/calendar.tsx` — creation-method badge | ✅ | `-right-[4px]` → `-end-[4px]`. |
| `launches/calendar.tsx` — chip corner radii | ✔︎ | `rounded-tr+rounded-tl` and `rounded-br+rounded-bl` are used in symmetric pairs, so they are direction-neutral. |
| `launches/calendar.tsx` — dayjs locale | ✅ | See bug #4 above. Added `dayjsLocaleFor()` narrowing `ar-AE` → `ar`, applied at all 3 call sites. |
| `launches/filters.tsx` — date nav arrows | ✔︎ | All four already carry `rtl:rotate-180`. |
| `launches/helpers/date.picker.tsx` | ✅ | `ml-[7px]` → `ms-[7px]`. |
| `launches/up.down.arrow.tsx` | ✅ | `rounded-bl-[20px]` → `rounded-es-[20px]`. |
| Week start day | ⚠︎ | `filters.tsx` uses `startOf('isoWeek')` — Monday. Correct for the UAE (Sat–Sun weekend) but **wrong for KSA/KW/QA/BH/OM/EG/JO**, where the working week is Sun–Thu and calendars start Sunday. `MARKETS[*].firstDayOfWeek` in `@gitroom/nashr-i18n` carries the right value per market and `weekdayNames()` orders accordingly — but wiring the calendar to it changes scheduling semantics, which is beyond a direction fix. **Left for a follow-up phase; flagged as a real product gap.** |

### Tables

| Component | Status | Finding / fix |
|---|---|---|
| `global.scss` `.table1 thead th / tbody td` | ✅ | `text-align: left` → `start`. This governs every `.table1` in the product. |
| `layout/impersonate.tsx` | ✅ | `text-left` → `text-start` on the header row. |
| `admin/admin-stats.component.tsx` | ✅ | Two numeric `text-right` → `text-end`. |
| `admin/admin-errors.component.tsx` | ✅ | Actions column `text-right` → `text-end`. |
| `launches/statistics.tsx` | ✅ | 3-column grid header used `rounded-tl-lg` / `rounded-tr-lg`. Grid columns reverse in RTL, so those landed on **interior** corners. → `rounded-ss-lg` / `rounded-se-lg`. |

### Buttons & form controls

| Component | Status | Finding / fix |
|---|---|---|
| `new-launch/add.post.button.tsx` | ✅ | `pl-[16px] pr-[20px]` → `ps-/pe-` (the asymmetry is intentional — it balances the icon). |
| `agents/agent.tsx` | ✅ | `pl-[14px] pr-[24px]` → `ps-/pe-`. |
| `new-launch/editor.tsx` | ✅ | `pl-[12px]` → `ps-[12px]`. |
| `layout/announcement.banner.tsx` | ✅ | `ml-[8px]` → `ms-[8px]`. |
| Native `input` / `textarea` / `select` | ✅ | Added a `global.scss` rule forcing `direction: rtl; text-align: start` under `html[dir=rtl]` — these do not reliably inherit direction across engines. |
| `global.scss` react-tags widget | ✅ | 9 physical properties converted (`padding-left`→`padding-inline-start`, `margin-right`→`margin-inline-end`, symmetric pairs collapsed to `padding-inline`). This widget is the tag input on the YouTube/Medium composers. |

### Editor

| Component | Status | Finding / fix |
|---|---|---|
| `global.scss` `.tiptap` empty placeholder | ✅ | `float: left` → `float: inline-start`. The Arabic placeholder was parked on the left of a right-aligned editor. Verified `float:inline-start` ×2 in the compiled bundle. |
| `global.scss` `.ProseMirror ul` / `.preview ul` | ✅ | `padding-left: 20px` → `padding-inline-start` — bullet indentation was on the wrong side. |
| `global.scss` slash-command menu buttons | ✅ | `text-align: left` → `start`. |

### Media / misc

| Component | Status | Finding / fix |
|---|---|---|
| `media/media.component.tsx` | ✅ | `rounded-bl-[8px]` → `rounded-es-[8px]`; `left-0` → `start-0`. |
| `agents/agent.chat.tsx` | ✅ | `left-0` → `start-0`. |
| `third-parties/third-party.list.component.tsx`, `third-party.media.tsx` | ✅ | `text-left` → `text-start`. |
| `auth/testimonial.component.tsx` | ➖ | Three `left-0` on full-width gradient overlays — direction-neutral (`w-full`), no visual difference. Left alone to limit blast radius. |
| `new-launch/providers/*/`*.preview.tsx` | ➖ | Social-network post previews (TikTok, YouTube, Pinterest) deliberately mimic each platform's own chrome. Mirroring them would make the preview *less* faithful. **Intentionally not converted** — 6 `left-0` and 4 `mr-*` remain here by design. |

---

## New global CSS (in `global.scss`, marked `Nashr: RTL + Arabic`)

Canonical copy is exported as `arabicTypographyCss` from
`libraries/nashr-i18n/src/typography.ts` for consumers that don't build through
`global.scss` (browser extension, email rendering).

* `--nashr-center-x` — direction-aware `-50%` / `+50%` half-step for centring an element
  pinned with `inset-inline-start: 50%`. `translateX` is physical; this is the fix.
* **Arabic font stack** — IBM Plex Sans Arabic → Noto Kufi Arabic → Noto Sans Arabic →
  platform Arabic UI fonts. Prevents a Latin font's poor Arabic fallback from rendering.
* **`letter-spacing: normal !important`** on everything under `dir=rtl` / `:lang(ar)`.
  Arabic is cursive; positive tracking **severs the letter joins** and renders words as
  loose disconnected glyphs. Latin UI kits apply tracking to buttons and labels by
  default, hence the `!important`.
* **`line-height: 1.7`** body / `1.4` headings — Arabic ascenders, descenders and
  diacritics clip at the 1.2–1.3 that suits Latin.
* **`text-transform: none !important`** — Arabic has no letter case; `uppercase` is a
  semantic no-op that still forces reflow and can trigger font substitution artefacts.
* **`.ltr-embed` / `code` / `pre` / `.tabular-nums`** — `direction: ltr; unicode-bidi:
  isolate` so numerals, URLs, code and handles stay LTR inside Arabic prose.
* **`.dir-flip`** — opt-in icon mirroring. Deliberately opt-in: blanket-flipping every SVG
  would also mirror the logo and brand marks.

---

## Locale / i18n changes

* `i18n.config.ts` — added `en-AE`, `ar-AE`, `en-SA`, `ar-SA`; explicit `fallbackLngMap`
  (`ar-AE → ar → en`, `en-SA → en`); `rtlLanguages`, `isRtl()`, `dirOfLanguage()`,
  `baseLanguageOf()`, `resolveSupportedLanguage()`.
* `i18next.ts` — object-form `fallbackLng`, `nonExplicitSupportedLngs: true`, and a
  defensive resource loader that falls back region → base → `en` rather than letting a
  missing overlay reject the whole namespace.
* The four regional locales ship as **thin overlays** (9–10 market-specific keys each:
  currency name, national day, weekend days, working week). They are **excluded from the
  lingo.dev bucket** in `i18n.json` so a translation run can never overwrite hand-written
  market copy with machine output.

---

## What still needs a human

### Native Arabic review — required before launch

1. **The whole existing `ar` catalogue.** 739 keys, machine-generated by lingo.dev +
   gpt-4.1, **unreviewed**. This phase hand-corrected only the 14 strings that contained
   the brand name (plus 22 new backend-error keys). The other ~700 have not been read by
   anyone.
2. **Brand rendering in Arabic.** "نشر" is also the ordinary Arabic noun for
   *publishing*, so a bare occurrence mid-sentence is genuinely ambiguous. The convention
   adopted here is Arabic guillemets — «نشر» — which reads unambiguously as a name and
   avoids a Latin token causing bidi churn. **This is a brand decision and should be
   confirmed by the brand owner**, not left to an engineer.
3. **The 22 `backend_error_*` Arabic strings** added in this phase — written carefully,
   but a native reviewer should confirm register (they are user-facing error copy).
4. **Campaign and vertical content** in `@gitroom/nashr-content` — the Arabic is
   hand-written and idiomatic, but Ramadan/Eid/national-day copy is exactly the material
   where a subtle register mistake is most costly. Have a native Gulf marketer read it.

### Visual QA — required, not done here

Nothing in this repo was rendered. A human should open an `ar-AE` session and check, at
minimum: the calendar in all four views, the composer with mixed Arabic + Latin + URLs,
the toast, both context menus, the modal stack, every table, and the media uploader
(Uppy ships its own `[dir=rtl]` rules that were not audited).

### Known gaps

* **Hebrew (`he`) has the same "left menu / right menu" content bug** in
  `agent_welcome_message` that was fixed in Arabic. Not fixed — no confident Hebrew.
* **English source copy says "left menu" / "right menu"** in `agent_welcome_message`.
  Correct in LTR, but it is the root cause of the bug in every RTL locale. Recommend
  rewriting the English to be direction-neutral ("the channels menu" / "the conversations
  menu") so the problem cannot recur on the next translation run.
* **`bn` and `ka_ge` locale files exist but are not in the `languages` array** in
  `i18n.config.ts` — a pre-existing upstream inconsistency, so those two locales are
  unreachable in the UI. Not touched (out of scope, and fixing it adds locales rather than
  fixing RTL).
* **Uppy dashboard** ships its own RTL stylesheet. Not audited.
* **Polotno** (`polonto.css`, ~16k lines, Blueprint-based design editor) contains
  `flex-direction: row-reverse` and `.bp5-rtl` rules. Not audited — it is a vendored
  third-party editor.
* **Week start day per market** — see the calendar table above.
