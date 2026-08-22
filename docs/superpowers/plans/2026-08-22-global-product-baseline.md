# Global Product Baseline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the existing Postiz-based product global-first in its positioning and default behavior while retaining Arabic, RTL, regional calendars, and MENA market support as optional localization capabilities.

**Architecture:** Keep the current Postiz application and the `nashr-*` libraries intact. Change only the product-level defaults and public narrative in this phase: the brand module owns positioning, `nashr-i18n` owns neutral market/timezone/currency defaults, and source-reading contract tests protect customer-facing copy and fork documentation. Later plans will implement API parity, MCP/SDK/CLI, agent workflows, R2 enforcement, global onboarding/pricing, and production launch validation.

**Tech Stack:** TypeScript, React/Next.js, Jest with ts-jest, pnpm, Git

**Spec:** [`docs/superpowers/specs/2026-08-22-global-first-postiz-direction-design.md`](../specs/2026-08-22-global-first-postiz-direction-design.md)

## Global Constraints

- Preserve Postiz as the underlying engine; do not rewrite application subsystems in this phase.
- Keep the temporary `Nashr` product name and existing assets until a permanent name is selected.
- Do not remove Arabic, RTL, dialect, Hijri, Ramadan/Eid, bilingual approval, or regional market support.
- Use global defaults only when an organization, user, locale, or market has not supplied a more specific choice.
- Do not imply that CLI parity, Cloudflare R2 enforcement, or global billing already exists; identify those as approved subsequent work where status is mentioned.
- Preserve the AGPL-3.0 license, Postiz attribution, and the deployment source-code offer.
- Use tests first for every behavior or documentation contract, then make the smallest implementation change that passes.
- Commit each task separately with the commit messages specified below.

---

## Task 1: Establish the global brand contract

**Files:**

- Create: `libraries/nashr-brand/jest.config.js`
- Create: `libraries/nashr-brand/tsconfig.spec.json`
- Create: `libraries/nashr-brand/src/product-positioning.spec.ts`
- Modify: `libraries/nashr-brand/src/brand.config.ts`
- Modify: `libraries/nashr-brand/README.md`
- Modify: `package.json`

- [ ] **Step 1: Add a self-contained Jest project for the brand library**

Create `libraries/nashr-brand/jest.config.js`:

```js
const path = require('path');
const root = path.resolve(__dirname, '../..');

module.exports = {
  rootDir: root,
  displayName: 'nashr-brand',
  testEnvironment: 'node',
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      { tsconfig: path.join(__dirname, 'tsconfig.spec.json') },
    ],
  },
  testMatch: ['<rootDir>/libraries/nashr-brand/src/**/*.spec.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
};
```

Create `libraries/nashr-brand/tsconfig.spec.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "module": "commonjs",
    "target": "ES2021",
    "lib": ["ES2021"],
    "types": ["jest", "node"],
    "skipLibCheck": true,
    "noEmit": true
  },
  "include": ["src/**/*.ts"]
}
```

- [ ] **Step 2: Write the failing positioning tests**

Create `libraries/nashr-brand/src/product-positioning.spec.ts`:

```ts
import { brand } from './brand.config';

describe('global product positioning', () => {
  it('positions the product for humans and AI agents', () => {
    expect(brand.tagline).toBe(
      'Social publishing infrastructure for humans and AI agents'
    );
    expect(brand.description).toBe(
      'Plan, approve, automate and publish social content across every channel from one workspace.'
    );
  });

  it('uses neutral defaults while preserving Arabic localization', () => {
    expect(brand.defaultLocale).toBe('en');
    expect(brand.defaultTimezone).toBe('UTC');
    expect(brand.locales).toEqual(expect.arrayContaining(['en', 'ar']));
    expect(brand.taglineAr).toContain('وكلاء الذكاء الاصطناعي');
  });

  it('does not make a region the primary product identity', () => {
    const primaryCopy = `${brand.tagline} ${brand.description}`;
    expect(primaryCopy).not.toMatch(/Middle East|MENA|Gulf time/i);
  });

  it('retains the temporary name and Postiz attribution', () => {
    expect(brand.name).toBe('Nashr');
    expect(brand.upstream.name).toBe('Postiz');
    expect(brand.upstream.license).toBe('AGPL-3.0');
  });
});
```

- [ ] **Step 3: Run the new test and confirm it fails for the old positioning**

Run:

```bash
pnpm exec jest -c libraries/nashr-brand/jest.config.js --runInBand
```

Expected: FAIL because the current tagline is region-first and the timezone is `Asia/Dubai`.

- [ ] **Step 4: Implement the global brand values**

In `libraries/nashr-brand/src/brand.config.ts`, keep `name`, `nameAr`, `nameLower`, URLs, assets, colors, and upstream attribution unchanged. Replace the positioning fields with:

```ts
tagline: 'Social publishing infrastructure for humans and AI agents',
taglineAr: 'بنية تحتية للنشر الاجتماعي للبشر ووكلاء الذكاء الاصطناعي',
description:
  'Plan, approve, automate and publish social content across every channel from one workspace.',
descriptionAr:
  'خطّط للمحتوى واعتمده وأتمته وانشره عبر جميع القنوات من مساحة عمل واحدة.',
```

Set:

```ts
defaultTimezone: 'UTC',
```

Replace the palette comment with a neutral accessibility description. The values remain unchanged because this phase is not the permanent rebrand.

- [ ] **Step 5: Document the brand lifecycle**

Update `libraries/nashr-brand/README.md` to state:

- `Nashr` is the temporary working name.
- A later rebrand must update this central module rather than scattering literals.
- Product defaults are global; Arabic and regional features are optional localization layers.
- Postiz attribution and the AGPL source offer must survive any rebrand.

- [ ] **Step 6: Add the brand suite to the normal unit command**

Prepend this command to `test:nashr:unit` in `package.json`:

```text
pnpm exec jest -c libraries/nashr-brand/jest.config.js --runInBand
```

- [ ] **Step 7: Run the focused and aggregate tests**

Run:

```bash
pnpm exec jest -c libraries/nashr-brand/jest.config.js --runInBand
pnpm run test:nashr:unit
```

Expected: PASS, including the new `nashr-brand` project.

- [ ] **Step 8: Commit**

```bash
git add libraries/nashr-brand package.json
git commit -m "feat: establish global product positioning"
```

---

## Task 2: Make market, timezone, and currency defaults global

**Files:**

- Create: `libraries/nashr-i18n/src/global-defaults.spec.ts`
- Modify: `libraries/nashr-i18n/src/markets.ts`
- Modify: `libraries/nashr-i18n/src/timezone.ts`
- Modify: `libraries/nashr-i18n/src/currency.ts`

- [ ] **Step 1: Write the failing global-default tests**

Create `libraries/nashr-i18n/src/global-defaults.spec.ts`:

```ts
import { DEFAULT_CURRENCY, currencyForMarket, formatCurrency } from './currency';
import { DEFAULT_MARKET, getMarket, marketFromLocale } from './markets';
import { DEFAULT_TIMEZONE, timezoneForLocale } from './timezone';

describe('global defaults with regional overlays', () => {
  it('uses a neutral global market when no market is known', () => {
    expect(DEFAULT_MARKET).toBe('GLOBAL');
    expect(getMarket()).toMatchObject({
      code: 'GLOBAL',
      timezone: 'UTC',
      currency: 'USD',
      localeEn: 'en',
      localeAr: 'ar',
    });
  });

  it('uses UTC and USD as product defaults', () => {
    expect(DEFAULT_TIMEZONE).toBe('UTC');
    expect(DEFAULT_CURRENCY).toBe('USD');
    expect(timezoneForLocale('ar')).toBe('UTC');
    expect(currencyForMarket()).toBe('USD');
    expect(formatCurrency(12)).toMatch(/\$|USD/);
  });

  it('preserves explicit regional behavior', () => {
    expect(marketFromLocale('ar-AE')?.code).toBe('AE');
    expect(timezoneForLocale('ar-AE')).toBe('Asia/Dubai');
    expect(currencyForMarket('AE')).toBe('AED');
    expect(currencyForMarket('SA')).toBe('SAR');
  });
});
```

- [ ] **Step 2: Run the focused test and confirm the old defaults fail**

Run:

```bash
pnpm exec jest -c libraries/nashr-i18n/jest.config.js --runInBand global-defaults
```

Expected: FAIL because the current defaults are UAE, Dubai, and AED.

- [ ] **Step 3: Add the neutral global market**

In `libraries/nashr-i18n/src/markets.ts`:

- Add `'GLOBAL'` to `MarketCode`.
- Add this first entry to `MARKETS`:

```ts
GLOBAL: {
  code: 'GLOBAL',
  nameEn: 'Global',
  nameAr: 'عالمي',
  timezone: 'UTC',
  currency: 'USD',
  localeEn: 'en',
  localeAr: 'ar',
  weekend: [6, 7],
  firstDayOfWeek: 1,
  prefersArabicIndicDigits: false,
},
```

- Set `DEFAULT_MARKET` to `'GLOBAL'`.
- Rewrite comments so AE, SA, and the other current markets are described as optional regional overlays, not the launch expansion set.
- Keep `marketFromLocale('ar')` returning `undefined`; callers continue to fall back to the neutral global market.

- [ ] **Step 4: Change timezone and currency fallbacks**

In `libraries/nashr-i18n/src/timezone.ts`, set:

```ts
export const DEFAULT_TIMEZONE = 'UTC';
```

Update comments from “launch market” to “global default.”

In `libraries/nashr-i18n/src/currency.ts`, set:

```ts
export const DEFAULT_CURRENCY: CurrencyCode = 'USD';
```

Change the default locale in `formatCurrency`, `formatNumber`, and `formatCompactNumber` from `en-AE` to `en-US`, and update their comments and examples without changing explicit Arabic or regional formatting behavior.

- [ ] **Step 5: Run the i18n regression suite**

Run:

```bash
pnpm exec jest -c libraries/nashr-i18n/jest.config.js --runInBand
```

Expected: PASS for global defaults, Hijri behavior, and AGPL source-offer checks.

- [ ] **Step 6: Commit**

```bash
git add libraries/nashr-i18n
git commit -m "feat: use global locale and billing defaults"
```

---

## Task 3: Rewrite the public product narrative

**Files:**

- Create: `libraries/nashr-brand/src/public-copy.spec.ts`
- Modify: `apps/frontend/src/app/(app)/(site)/about/page.tsx`
- Modify: `apps/frontend/src/app/(app)/(site)/licenses/page.tsx`

- [ ] **Step 1: Add failing source-level copy contracts**

Create `libraries/nashr-brand/src/public-copy.spec.ts`:

```ts
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '../../..');
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

describe('public product copy', () => {
  it('presents a global product with first-class interfaces', () => {
    const about = read('apps/frontend/src/app/(app)/(site)/about/page.tsx');

    expect(about).toContain('Social publishing infrastructure');
    expect(about).toContain('humans and AI agents');
    expect(about).toContain('One publishing system, every interface');
    expect(about).toMatch(/API/);
    expect(about).toMatch(/MCP/);
    expect(about).toMatch(/CLI/);
    expect(about).not.toMatch(
      /built for teams working in the Middle East|Gulf time by default|Initial market:/
    );
  });

  it('keeps Arabic and regional workflows as localization strengths', () => {
    const about = read('apps/frontend/src/app/(app)/(site)/about/page.tsx');

    expect(about).toMatch(/Arabic/);
    expect(about).toMatch(/right-to-left|RTL/);
    expect(about).toMatch(/Ramadan|Eid|Hijri/);
  });

  it('describes a maintained Postiz fork without regional primacy', () => {
    const licenses = read(
      'apps/frontend/src/app/(app)/(site)/licenses/page.tsx'
    );

    expect(licenses).toContain('Postiz');
    expect(licenses).toContain('FORK_CUSTOMIZATIONS.md');
    expect(licenses).not.toContain('MENA_CUSTOMIZATIONS.md');
  });
});
```

- [ ] **Step 2: Run the copy contract and confirm it fails**

Run:

```bash
pnpm exec jest -c libraries/nashr-brand/jest.config.js --runInBand public-copy
```

Expected: FAIL on the region-first about page and old customization-ledger name.

- [ ] **Step 3: Rewrite the About page**

In `apps/frontend/src/app/(app)/(site)/about/page.tsx`:

- Lead with the exact approved line: “Social publishing infrastructure for humans and AI agents.”
- Describe the complete browser product for creators, teams, and agencies worldwide.
- Add a section headed “One publishing system, every interface” and describe Web, API, MCP, SDK, and CLI as the interface strategy. State that command-line and deeper agent parity are being completed; do not present unfinished interfaces as production-ready.
- Replace “Built for the region” with “Global by default, local when it matters.”
- Describe Arabic, RTL, bilingual approvals, dialect-aware content, and Ramadan/Eid/Hijri planning as optional localization capabilities.
- Remove the initial-UAE-market and Gulf-default claims.
- Keep the upstream Postiz attribution and use `brand` for product strings and URLs.

- [ ] **Step 4: Rewrite the Licenses page customization summary**

In `apps/frontend/src/app/(app)/(site)/licenses/page.tsx`:

- Keep the AGPL explanation, Postiz attribution, source link, and third-party-license notices intact.
- Describe the fork as adding global publishing infrastructure, human/agent workflows, and optional localization capabilities.
- Point maintainers to `FORK_CUSTOMIZATIONS.md`.
- Avoid claiming that subsequent implementation phases are already complete.

- [ ] **Step 5: Run the focused contract and frontend type/build check**

Run:

```bash
pnpm exec jest -c libraries/nashr-brand/jest.config.js --runInBand public-copy
pnpm run build:frontend
```

Expected: both commands PASS.

- [ ] **Step 6: Commit**

```bash
git add libraries/nashr-brand/src/public-copy.spec.ts \
  'apps/frontend/src/app/(app)/(site)/about/page.tsx' \
  'apps/frontend/src/app/(app)/(site)/licenses/page.tsx'
git commit -m "feat: present the product as global publishing infrastructure"
```

---

## Task 4: Align framework and browser-test defaults

**Files:**

- Modify: `libraries/react-shared-libraries/src/translation/i18n.config.ts`
- Modify: `tests/e2e/playwright.config.ts`
- Modify: `tests/e2e/README.md`
- Modify: `libraries/nashr-brand/src/public-copy.spec.ts`

- [ ] **Step 1: Add failing configuration assertions**

Append to `libraries/nashr-brand/src/public-copy.spec.ts`:

```ts
describe('global framework defaults', () => {
  it('uses UTC for browser tests unless a test overrides it', () => {
    const config = read('tests/e2e/playwright.config.ts');
    expect(config).toContain("process.env.E2E_TZ || 'UTC'");
    expect(config).not.toContain("process.env.E2E_TZ || 'Asia/Dubai'");
  });

  it('retains regional locale overlays without describing them as primary', () => {
    const config = read(
      'libraries/react-shared-libraries/src/translation/i18n.config.ts'
    );
    expect(config).toMatch(/en-AE/);
    expect(config).toMatch(/ar-AE/);
    expect(config).toMatch(/optional regional locale overlays/i);
    expect(config).not.toMatch(/Nashr MENA regional locales/i);
  });
});
```

- [ ] **Step 2: Run the focused test and confirm it fails**

Run:

```bash
pnpm exec jest -c libraries/nashr-brand/jest.config.js --runInBand public-copy
```

Expected: FAIL because Playwright still defaults to Dubai and the locale comment is region-first.

- [ ] **Step 3: Change only the unspecified defaults**

- In `tests/e2e/playwright.config.ts`, change the fallback timezone to `UTC`. Preserve `E2E_TZ`, allowing localization runs to use `E2E_TZ=Asia/Dubai` or another IANA timezone.
- In `tests/e2e/README.md`, document UTC as the default and give an explicit regional override example.
- In `libraries/react-shared-libraries/src/translation/i18n.config.ts`, change the comment to “Optional regional locale overlays.” Preserve the `en-AE`, `ar-AE`, `en-SA`, and `ar-SA` entries.

- [ ] **Step 4: Run the contract and inspect Playwright configuration**

Run:

```bash
pnpm exec jest -c libraries/nashr-brand/jest.config.js --runInBand public-copy
pnpm exec playwright test --config=tests/e2e/playwright.config.ts --list
```

Expected: the contract passes and Playwright lists the configured tests without a configuration error.

- [ ] **Step 5: Commit**

```bash
git add libraries/nashr-brand/src/public-copy.spec.ts \
  libraries/react-shared-libraries/src/translation/i18n.config.ts \
  tests/e2e/playwright.config.ts tests/e2e/README.md
git commit -m "chore: align framework defaults with global launch"
```

---

## Task 5: Generalize the fork customization ledger

**Files:**

- Rename: `MENA_CUSTOMIZATIONS.md` to `FORK_CUSTOMIZATIONS.md`
- Modify: every tracked source or Markdown file that references `MENA_CUSTOMIZATIONS.md`
- Modify: `libraries/nashr-brand/src/public-copy.spec.ts`

- [ ] **Step 1: Add the failing ledger contract**

Append to `libraries/nashr-brand/src/public-copy.spec.ts`:

```ts
describe('fork customization ledger', () => {
  it('uses a general ledger name and leaves no stale references', () => {
    const legacyLedger = ['MENA', 'CUSTOMIZATIONS.md'].join('_');
    expect(fs.existsSync(path.join(root, 'FORK_CUSTOMIZATIONS.md'))).toBe(true);
    expect(fs.existsSync(path.join(root, legacyLedger))).toBe(false);

    const trackedReferences = [
      'README.md',
      'FEATURES.md',
      'DEPLOYMENT.md',
      'LAUNCH_READINESS.md',
      'RISK_REGISTER.md',
      'OPEN_SOURCE_COMPLIANCE.md',
      'AUDIT_REPORT.md',
      'IMPLEMENTATION_PLAN.md',
      'TEST_PLAN.md',
    ]
      .filter((file) => fs.existsSync(path.join(root, file)))
      .map(read)
      .join('\n');

    expect(trackedReferences).not.toContain(legacyLedger);
    expect(read('FORK_CUSTOMIZATIONS.md')).toMatch(
      /^# Fork Customizations and Maintenance Ledger/m
    );
  });
});
```

- [ ] **Step 2: Run the test and confirm the old ledger contract fails**

Run:

```bash
pnpm exec jest -c libraries/nashr-brand/jest.config.js --runInBand public-copy
```

Expected: FAIL because `FORK_CUSTOMIZATIONS.md` does not exist yet.

- [ ] **Step 3: Rename and reframe the ledger**

Run:

```bash
git mv MENA_CUSTOMIZATIONS.md FORK_CUSTOMIZATIONS.md
```

Change its title to:

```md
# Fork Customizations and Maintenance Ledger
```

Add an opening note explaining that historical entries record the original regional build, while new work follows the global-first product direction. Preserve all historical implementation details because they are still needed for upstream rebases.

Add a dated entry for this baseline covering:

- global positioning and UTC/USD fallback defaults;
- retained Arabic, RTL, calendars, and market overlays;
- renamed ledger path;
- affected source and test files.

- [ ] **Step 4: Replace all references mechanically**

First identify references:

```bash
rg -l 'MENA_CUSTOMIZATIONS\.md' --glob '!docs/superpowers/**'
```

For every returned tracked file—including Markdown, TypeScript, TSX, and Prisma schema files—replace only the filename with `FORK_CUSTOMIZATIONS.md`. Do not rewrite historical statements that explain why a customization was originally introduced. The implementation plan itself is excluded because it records the migration procedure.

- [ ] **Step 5: Verify no stale filename remains**

Run:

```bash
if rg -n 'MENA_CUSTOMIZATIONS\.md' --glob '!docs/superpowers/**'; then
  exit 1
fi
pnpm exec jest -c libraries/nashr-brand/jest.config.js --runInBand public-copy
```

Expected: no `rg` output and the Jest contract passes.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "docs: generalize the fork customization ledger"
```

---

## Task 6: Update repository-facing product and launch documentation

**Files:**

- Modify: `README.md`
- Modify: `FEATURES.md`
- Modify: `DEPLOYMENT.md`
- Modify: `PRICING_RECOMMENDATIONS.md`
- Modify: `LAUNCH_READINESS.md`
- Create: `libraries/nashr-brand/src/documentation-contract.spec.ts`

- [ ] **Step 1: Add failing documentation contracts**

Create `libraries/nashr-brand/src/documentation-contract.spec.ts`:

```ts
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '../../..');
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

describe('global repository documentation', () => {
  it('introduces the fork and its approved direction', () => {
    const readme = read('README.md');
    expect(readme).toContain(
      'Social publishing infrastructure for humans and AI agents'
    );
    expect(readme).toContain('Postiz');
    expect(readme).toContain('AGPL-3.0');
    expect(readme).toContain('FORK_CUSTOMIZATIONS.md');
  });

  it('labels superseded regional launch assumptions', () => {
    expect(read('PRICING_RECOMMENDATIONS.md')).toMatch(
      /historical|superseded/i
    );
    expect(read('LAUNCH_READINESS.md')).toMatch(/global-first/i);
  });

  it('documents the approved hybrid Cloudflare deployment', () => {
    const deployment = read('DEPLOYMENT.md');
    expect(deployment).toMatch(/Cloudflare/i);
    expect(deployment).toMatch(/R2/);
    expect(deployment).toMatch(/Docker/);
    expect(deployment).toMatch(/PostgreSQL/);
    expect(deployment).toMatch(/Redis/);
    expect(deployment).toMatch(/Temporal/);
  });
});
```

- [ ] **Step 2: Run the documentation test and confirm it fails**

Run:

```bash
pnpm exec jest -c libraries/nashr-brand/jest.config.js --runInBand documentation-contract
```

Expected: FAIL until the root docs state the approved direction and deployment topology.

- [ ] **Step 3: Replace the repository introduction**

At the top of `README.md`, add a fork-specific introduction before retained upstream technical material:

- Temporary product name: Nashr.
- Exact approved positioning line.
- Postiz is the underlying engine and the project remains AGPL-3.0.
- Product model: complete web app plus first-class API, MCP, SDK, and CLI interfaces.
- Status language that distinguishes current capabilities from the approved later implementation phases.
- Arabic, RTL, bilingual, dialect, Ramadan/Eid, and Hijri features are optional localization strengths.
- Link to the approved design spec and `FORK_CUSTOMIZATIONS.md`.

Remove or relabel hosted Postiz registration/service links that could send Nashr users to an unrelated production service. Preserve upstream project attribution and technical credits.

- [ ] **Step 4: Update feature and deployment framing**

In `FEATURES.md`:

- Add a global-first overview.
- Group the inventory under publishing core, human collaboration, programmable interfaces, agent workflows, localization, and operations.
- Mark unimplemented API/MCP/CLI/agent/R2 work accurately rather than listing it as shipped.

In `DEPLOYMENT.md`:

- Replace the UAE-first target with a global controlled-beta target.
- State the approved launch topology: Docker host for the Postiz application services, PostgreSQL, Redis, and Temporal; Cloudflare for DNS/CDN/WAF/TLS; R2 for media and backups.
- Explicitly state that this is not a Cloudflare Workers-only rewrite.
- Preserve the existing operational steps that remain correct.

- [ ] **Step 5: Mark obsolete commercial assumptions without inventing prices**

At the top of `PRICING_RECOMMENDATIONS.md`, add a prominent note that the AED/SAR regional pricing analysis is historical and superseded by the approved global USD direction. State that executable global tiers will be specified in the later pricing/onboarding plan.

At the top of `LAUNCH_READINESS.md`, add a dated global-first pivot note linking to the approved design spec. Clarify that prior verification results remain useful engineering evidence but are not approval to launch under the new scope.

- [ ] **Step 6: Run documentation and unit contracts**

Run:

```bash
pnpm exec jest -c libraries/nashr-brand/jest.config.js --runInBand documentation-contract
pnpm run test:nashr:unit
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add README.md FEATURES.md DEPLOYMENT.md PRICING_RECOMMENDATIONS.md \
  LAUNCH_READINESS.md libraries/nashr-brand/src/documentation-contract.spec.ts
git commit -m "docs: align launch materials with global direction"
```

---

## Task 7: Verify the baseline as one coherent change

**Files:**

- Modify only if verification exposes a regression in a file changed above.

- [ ] **Step 1: Run all Nashr unit tests**

Run:

```bash
pnpm run test:nashr:unit
```

Expected: all brand, permissions, approval, agents, and i18n projects PASS.

- [ ] **Step 2: Run integration tests**

Run:

```bash
pnpm run test:nashr:integration
```

Expected: PASS. If a required local service is intentionally absent, start it using the repository's documented development setup and rerun; do not convert an environmental skip into a passing claim.

- [ ] **Step 3: Build all production applications**

Run:

```bash
pnpm run build
```

Expected: frontend, backend, and orchestrator builds PASS.

- [ ] **Step 4: Run repository hygiene checks**

Run:

```bash
git diff --check
if rg -n 'MENA_CUSTOMIZATIONS\.md' --glob '!docs/superpowers/**'; then
  exit 1
fi
git status --short
```

Expected: no whitespace errors, no stale ledger references, and no unexpected generated artifacts.

- [ ] **Step 5: Review the final diff against the approved boundaries**

Run:

```bash
git diff --stat HEAD~6..HEAD
git log --oneline -7
```

Confirm all of the following before declaring the phase complete:

- Global-first positioning is exact and tested.
- Neutral defaults are `en`, `UTC`, and `USD`.
- Explicit Arabic and regional behavior still works.
- The temporary name and Postiz engine remain.
- Documentation does not claim later interfaces or infrastructure are already shipped.
- No API, CLI, agent, billing, or storage subsystem was prematurely rewritten.

- [ ] **Step 6: Record any verification-only fix**

If verification required a correction, commit only that correction:

```bash
git add <corrected-files>
git commit -m "fix: resolve global baseline verification regressions"
```

If no correction was needed, do not create an empty commit.

---

## Subsequent Plans

After this baseline is merged and stable, create and execute separate plans in this order:

1. API contract parity and authentication hardening.
2. MCP and SDK stabilization, followed by the CLI.
3. Agent-first workflows, permissions, approvals, and auditability.
4. Cloudflare R2 media enforcement and backup/restore operations.
5. Global onboarding, USD pricing, billing, and entitlements.
6. End-to-end launch validation, security review, observability, and deployment runbook.

Each plan must preserve the global defaults and optional localization model established here.
