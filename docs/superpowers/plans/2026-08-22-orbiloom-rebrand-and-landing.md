# Orbiloom Rebrand and Landing Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the temporary Nashr customer identity with Orbiloom and ship a responsive, original public landing page while preserving the Postiz product engine, localization, security and AGPL source offer.

**Architecture:** Keep internal `nashr-*` library and schema names stable, but make `libraries/nashr-brand/src/brand.config.ts` the customer-facing Orbiloom source of truth. Add deterministic SVG assets and focused landing-page components/styles inside the Next.js frontend. Change proxy/layout routing so signed-out `/` renders marketing while authenticated `/` retains the existing workspace redirect.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS, SCSS, Jest, next/font, inline/code-native SVG.

**Spec:** `docs/superpowers/specs/2026-08-22-orbiloom-brand-and-web-design.md`

## Global Constraints

- Product name: `Orbiloom`; Arabic companion: `أوربيلوم`; pronunciation: “OR-bee-loom”.
- Primary descriptor: `Social publishing infrastructure for humans and AI agents.`
- Campaign line: `Every channel. One intelligent orbit.`
- Hero: `Put every channel in motion.`
- Colors: Void `#080A0F`, Deep Space `#11141C`, Cloud `#F7F7F2`, Steel `#9299AA`, Orbit Violet `#7357FF`, hover `#6043F2`, Signal Lime `#C8FF4D`, Pulse Coral `#FF5F74`, Path `#2A2F3B`.
- Typography: Manrope for Latin, IBM Plex Sans Arabic for Arabic, JetBrains Mono for code-facing examples.
- Preserve Postiz attribution, AGPL source offer, Arabic/RTL first-paint behavior, tenant isolation, approval gates and internal `nashr-*` names.
- Do not claim unavailable features, prices, testimonials, customer counts or domain ownership.
- Do not copy Postiz marketing copy or proprietary marketing-site assets.

---

### Task 1: Brand Contract and Brand Bible

**Files:**
- Modify: `libraries/nashr-brand/src/brand.config.ts`
- Modify: `libraries/nashr-brand/src/product-positioning.spec.ts`
- Modify: `libraries/nashr-brand/src/public-copy.spec.ts`
- Modify: `libraries/nashr-brand/README.md`
- Create: `docs/brand/orbiloom-brand-bible.md` (now maintained at [`docs/brand/postdelegate-brand-bible.md`](../../brand/postdelegate-brand-bible.md))

**Interfaces:**
- Consumes: approved name, messages, tokens and usage rules from the spec.
- Produces: the existing `brand: Brand` interface populated with Orbiloom values; a versioned human-readable source for voice and visual guidance.

- [ ] **Step 1: Change the positioning tests to the approved contract**

Replace the temporary-name expectation with exact Orbiloom assertions:

```ts
expect(brand.name).toBe('Orbiloom');
expect(brand.nameAr).toBe('أوربيلوم');
expect(brand.nameLower).toBe('orbiloom');
expect(brand.tagline).toBe(
  'Social publishing infrastructure for humans and AI agents'
);
expect(brand.campaignLine).toBe('Every channel. One intelligent orbit.');
expect(brand.heroLine).toBe('Put every channel in motion.');
expect(brand.upstream.name).toBe('Postiz');
```

Add `heroLine`, `campaignLine`, `heroLineAr` and `campaignLineAr` to `Brand` so landing copy remains centralized. Assert the exact color values and new `/orbiloom-*` logo paths.

- [ ] **Step 2: Run the brand test and verify failure**

Run: `pnpm exec jest -c libraries/nashr-brand/jest.config.js --runInBand`

Expected: FAIL because the current brand is Nashr and the new fields do not exist.

- [ ] **Step 3: Update the centralized brand contract**

Set the fallback origin to `https://orbiloom.example`, update customer-facing name/copy/colors/logo paths, and retain environment-provided legal entity and runtime URLs. Keep Postiz attribution unchanged. Update comments and README to explain that internal package naming is intentionally stable.

- [ ] **Step 4: Create brand bible version 1.0**

Document purpose, promise, audience, personality, “we are/we are not”, message hierarchy, terminology, English/Arabic copy rules, tone-by-context matrix, logo construction/clear space/misuse, color accessibility, typography, motion, photography/illustration guidance, interface examples, confidence scores, data gaps and source appendix. Mark founding decisions high confidence and unvalidated conversion language medium confidence.

- [ ] **Step 5: Run the focused tests**

Run: `pnpm exec jest -c libraries/nashr-brand/jest.config.js --runInBand`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add libraries/nashr-brand docs/brand
git commit -m "feat: establish Orbiloom brand system"
```

### Task 2: Original Orbiloom Logo Assets

**Files:**
- Create: `apps/frontend/public/orbiloom-mark.svg`
- Create: `apps/frontend/public/orbiloom-logo.svg`
- Create: `apps/frontend/public/orbiloom-logo-ar.svg`
- Modify: `apps/frontend/public/favicon.svg`
- Modify: `apps/frontend/src/components/ui/brand.mark.tsx`
- Modify: `apps/frontend/src/components/ui/logo-text.component.tsx`
- Test: `libraries/nashr-brand/src/brand-assets.spec.ts`

**Interfaces:**
- Consumes: `brand.logo.*`, approved palette and logo geometry.
- Produces: deterministic SVG mark/lockups used by metadata, public pages, auth and workspace chrome; `BrandMark` remains API-compatible (`size`, `className`).

- [ ] **Step 1: Add failing asset-integrity tests**

Check that every configured SVG exists, contains a `viewBox`, references approved palette values, has no embedded raster data/script, and that the React `BrandMark` uses `aria-label={brand.name}` rather than a literal.

- [ ] **Step 2: Run the brand tests and verify failure**

Run: `pnpm exec jest -c libraries/nashr-brand/jest.config.js --runInBand`

Expected: FAIL because the Orbiloom assets do not exist.

- [ ] **Step 3: Draw the code-native mark and lockups**

Use a 64×64 viewBox: two violet elliptical strokes cross to form an orbital O; a lime signal node sits on the upper-right path. Keep stroke widths legible at 16px. Build English and Arabic horizontal lockups without external fonts by using the mark plus accessible `<text>` fallback only where the runtime component already renders live text; static wordmark SVGs may convert custom lettering to paths only if deterministic paths are authored in-repo.

- [ ] **Step 4: Update reusable React logo components**

Use `React.useId()` for collision-safe gradient IDs, `brand.name` for accessible labeling, and live brand text in `LogoTextComponent` so direction and localization remain correct.

- [ ] **Step 5: Run tests and commit**

Run: `pnpm exec jest -c libraries/nashr-brand/jest.config.js --runInBand`

```bash
git add apps/frontend/public apps/frontend/src/components/ui libraries/nashr-brand/src/brand-assets.spec.ts
git commit -m "feat: add Orbiloom logo system"
```

### Task 3: Global Tokens, Typography and Authentication Chrome

**Files:**
- Modify: `apps/frontend/src/app/(app)/layout.tsx`
- Modify: `apps/frontend/src/app/colors.scss`
- Modify: `apps/frontend/src/app/global.scss`
- Modify: `apps/frontend/tailwind.config.cjs`
- Modify: `apps/frontend/src/app/(app)/auth/layout.tsx`
- Modify: `apps/frontend/src/components/layout/public.shell.tsx`

**Interfaces:**
- Consumes: brand tokens and assets from Tasks 1–2.
- Produces: `--brand-*` CSS variables, Manrope/Arabic font variables and Orbiloom auth/public chrome without changing form behavior.

- [ ] **Step 1: Add token synchronization assertions**

Extend brand tests to read `colors.scss` and require each exact approved hex value plus comments naming Orbiloom, while rejecting legacy teal `#0E7C74` in brand-token declarations.

- [ ] **Step 2: Verify the assertions fail**

Run: `pnpm exec jest -c libraries/nashr-brand/jest.config.js --runInBand`

- [ ] **Step 3: Apply fonts and CSS tokens**

Replace `Plus_Jakarta_Sans` with `Manrope`, retain `IBM_Plex_Sans_Arabic`, and add `JetBrains_Mono` as `--orbiloom-font-mono`. Map dark product surfaces to Void/Deep Space/Path and primary actions to Orbit Violet. Use Signal Lime for high-salience signals, not body text.

- [ ] **Step 4: Restyle auth and public chrome**

Keep current forms and providers intact. Replace hard-coded Nashr-era panels with Orbiloom tokens, add a restrained orbital backdrop using CSS/SVG, and preserve hidden testimonials until genuine Orbiloom testimonials exist.

- [ ] **Step 5: Restore visible keyboard focus**

Replace the global `body * { outline: none !important; }` behavior with `:focus-visible` rules using Signal Lime and an offset that passes on both dark and light surfaces.

- [ ] **Step 6: Test and commit**

Run: `pnpm exec jest -c libraries/nashr-brand/jest.config.js --runInBand`

```bash
git add apps/frontend/src/app apps/frontend/src/components/layout apps/frontend/tailwind.config.cjs libraries/nashr-brand/src
git commit -m "feat: apply Orbiloom visual tokens"
```

### Task 4: Signed-Out Root Routing and Landing Page

**Files:**
- Modify: `apps/frontend/src/proxy.ts`
- Modify: `apps/frontend/src/app/(app)/(site)/layout.tsx`
- Create: `apps/frontend/src/app/(app)/(site)/page.tsx`
- Create: `apps/frontend/src/components/marketing/landing.page.tsx`
- Create: `apps/frontend/src/components/marketing/publishing.orbit.tsx`
- Create: `apps/frontend/src/components/marketing/platform.signals.tsx`
- Create: `apps/frontend/src/components/marketing/landing.module.scss`
- Modify: `apps/frontend/src/components/layout/public.shell.tsx`
- Test: `libraries/nashr-brand/src/public-copy.spec.ts`

**Interfaces:**
- Consumes: centralized messages, logo components and public platform icons.
- Produces: an SSR-safe `/` landing page for signed-out traffic; authenticated `/` continues to redirect to `/launches` or `/analytics` according to existing configuration.

- [ ] **Step 1: Add failing route and copy tests**

Assert `/` is included in exact public routes, the proxy only treats pathname `/` as public (not every prefix), the landing source contains the centralized hero/descriptor references, Web/API/MCP/CLI, Arabic/RTL, Postiz attribution and no invented numeric social proof or prices.

- [ ] **Step 2: Run the focused tests and verify failure**

Run: `pnpm exec jest -c libraries/nashr-brand/jest.config.js --runInBand`

- [ ] **Step 3: Make root public only when unauthenticated**

Add exact root handling before the unauthenticated redirect. Preserve the authenticated root branch and all integration/OAuth behavior. In the site layout, render the marketing shell for signed-out root/legal routes and existing `LayoutComponent` for authenticated product routes.

- [ ] **Step 4: Build the semantic landing page**

Implement the approved sections with semantic landmarks and honest interface availability labels. Use platform icons already shipped under `public/icons/platforms`, original orbital SVG graphics, CSS modules, logical properties and real links to `/auth`, `/auth/login`, `/about`, `/licenses` and configured docs/source URLs.

- [ ] **Step 5: Add restrained motion and responsive navigation**

Animate the orbit node and staged hero entrance with CSS only; disable all non-essential motion under `prefers-reduced-motion`. Use a native `<details>` menu for mobile so keyboard and no-JS behavior remain functional.

- [ ] **Step 6: Test and commit**

Run: `pnpm exec jest -c libraries/nashr-brand/jest.config.js --runInBand`

```bash
git add apps/frontend/src/proxy.ts apps/frontend/src/app/'(app)'/'(site)' apps/frontend/src/components/marketing apps/frontend/src/components/layout/public.shell.tsx libraries/nashr-brand/src/public-copy.spec.ts
git commit -m "feat: launch Orbiloom public landing page"
```

### Task 5: Customer-Facing Copy Cleanup and Metadata

**Files:**
- Modify: `apps/frontend/src/app/(app)/(site)/about/page.tsx`
- Modify: `apps/frontend/src/app/(app)/layout.tsx`
- Modify: customer-facing files returned by `rg -l 'Nashr|نشر' apps/frontend/src apps/frontend/public libraries/nashr-brand`
- Preserve: internal imports, package directories, migration identifiers and historical fork records where renaming would break compatibility.
- Test: `libraries/nashr-brand/src/public-copy.spec.ts`

**Interfaces:**
- Consumes: `brand` configuration and Orbiloom assets.
- Produces: consistent customer-facing Orbiloom copy while preserving intentional internal names.

- [ ] **Step 1: Add a scoped stale-brand test**

Scan customer-facing TSX and active public SVG assets for standalone `Nashr`/`نشر`, excluding documented internal comments, legacy migration/history paths and archival screenshots. Require About copy to describe Orbiloom without a false Arabic etymology.

- [ ] **Step 2: Verify the stale-brand test fails**

Run: `pnpm exec jest -c libraries/nashr-brand/jest.config.js --runInBand`

- [ ] **Step 3: Replace stale customer copy and metadata**

Use `brand.name` and centralized messages. Preserve `brand.upstream`, legal configuration notices and source URL. Point metadata to new SVG/favicon assets and do not invent an OG bitmap if a valid 1200×630 asset has not been produced.

- [ ] **Step 4: Run tests and commit**

Run: `pnpm exec jest -c libraries/nashr-brand/jest.config.js --runInBand`

```bash
git add apps/frontend libraries/nashr-brand
git commit -m "fix: complete customer-facing Orbiloom rename"
```

### Task 6: Verification and Visual QA

**Files:**
- Modify only files required by verified failures.
- Create screenshots under `docs/screenshots/orbiloom/` only if repository policy keeps visual baselines tracked; otherwise save them in the workspace visualization directory and link them in the handoff.

**Interfaces:**
- Consumes: all completed tasks.
- Produces: passing tests/build and reviewed desktop/mobile English/Arabic surfaces.

- [ ] **Step 1: Run brand and unit tests**

Run: `pnpm run test:nashr:unit`

Expected: all suites pass; internal script name remains stable.

- [ ] **Step 2: Run the production frontend build**

Run: `pnpm run build:frontend`

Expected: Next.js production build succeeds without type, route or asset errors.

- [ ] **Step 3: Start the production frontend locally**

Run: `pnpm --filter ./apps/frontend start`

Expected: server listens on port 4200 using the existing local environment.

- [ ] **Step 4: Capture and inspect critical surfaces**

Capture `/` at 1440×1000 and 375×812, `/auth/login` at desktop/mobile, and `/about` in English and Arabic. Inspect overflow, first-paint direction, focus, menu operation, mark legibility, contrast and reduced-motion behavior.

- [ ] **Step 5: Run repository-wide checks**

Run: `git diff --check`

Run: `rg -n 'Nashr|نشر|#0E7C74|#14A79B' apps/frontend/src apps/frontend/public libraries/nashr-brand`

Classify every remaining match as intentional internal history or fix it.

- [ ] **Step 6: Commit verified corrections**

```bash
git add -A
git commit -m "test: verify Orbiloom rebrand surfaces"
```

## Self-Review

- Spec coverage: brand bible, assets, tokens, landing routing, application/auth chrome, customer copy, localization, attribution and visual verification each map to a task.
- Placeholder scan: no implementation step contains TBD/TODO or delegates unspecified error handling.
- Interface consistency: `brand` remains the single source of truth; `BrandMark` retains its current component props; `/` behavior explicitly separates signed-out marketing from signed-in workspace routing.
- Scope boundary: no database, migration, authorization, R2 or Postiz engine rewrite is included.
