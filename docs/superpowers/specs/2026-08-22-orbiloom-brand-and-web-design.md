# Orbiloom brand and web design

**Date:** 2026-08-22  
**Status:** Approved  
**Supersedes:** The temporary Nashr customer-facing identity described in
`2026-08-22-global-first-postiz-direction-design.md`

## 1. Decision

The permanent customer-facing product name is **Orbiloom** (pronounced
“OR-bee-loom”; Arabic: **أوربيلوم**).

The name combines *orbit* and *loom*: one publishing system weaving people,
agents, content and channels into coordinated motion. It is an invented global
name rather than a regional or narrowly descriptive name.

The product category and primary positioning remain:

> Social publishing infrastructure for humans and AI agents.

The short campaign line is:

> Every channel. One intelligent orbit.

The working domain is not encoded into product copy. Preliminary RDAP checks on
2026-08-22 returned not-found for `orbiloom.ai` and `getorbiloom.com`; domain
availability can change and neither result constitutes a purchase or trademark
clearance. `orbiloom.com` is registered. Runtime URLs continue to come from
environment configuration.

## 2. Brand strategy

### 2.1 Purpose

Give every team and trusted agent a dependable way to create, coordinate,
approve and publish across social channels.

### 2.2 Promise

Create once, coordinate clearly and publish everywhere from one governed
system.

### 2.3 Audience

- Creators who want a capable publishing workspace without operational drag.
- Social teams and agencies that require collaboration, approvals and client
  separation.
- Developers and automation teams integrating through API, MCP, SDK and CLI.
- AI agents operating under the same workspace permissions and audit trail as
  people.

### 2.4 Positioning pillars

1. **One governed publishing system.** Web, API, MCP, SDK and CLI use the same
   organizations, permissions, drafts, approvals and publishing pipeline.
2. **Agent-ready by design.** Agents are first-class operators, not a novelty
   chat feature, and remain accountable to explicit policy.
3. **Global from the first screen.** English is the default without making one
   market the norm; Arabic, RTL, dialect, bilingual and Hijri campaign features
   remain deep localization capabilities.
4. **Open and extensible.** Postiz remains the underlying AGPL engine, with a
   visible source offer and an upstream-friendly customization strategy.

## 3. Verbal identity

### 3.1 Personality

Orbiloom is precise, capable, kinetic, inclusive and candid. It speaks like an
experienced operator who understands both creative work and infrastructure.

### 3.2 We are / we are not

| We are | We are not |
| --- | --- |
| Clear and direct | Vague or padded with hype |
| Technically credible | Needlessly technical |
| Energetic and in motion | Frenetic or childish |
| Human and agent inclusive | Robot-centric or dehumanizing |
| Globally aware | Regionless or culturally generic |
| Confident about shipped capability | Speculative about future capability |

### 3.3 Copy rules

- Lead with the user outcome, then explain the system.
- Use short active sentences and concrete verbs: create, connect, approve,
  schedule, publish, measure.
- Call the browser product the **workspace** and the shared backend the
  **publishing system** or **publishing infrastructure**.
- Use **AI agents** on first reference and **agents** thereafter.
- Say **channels** for connected social destinations and **interfaces** for web,
  API, MCP, SDK and CLI.
- Do not call unshipped functionality available. Use “planned”, “in preview” or
  “being completed” when accurate.
- Do not use “revolutionary”, “game-changing”, “effortless”, “magic”, “AI-
  powered” as a generic modifier, or fabricated social proof.
- Arabic copy should be naturally rewritten for Arabic rather than translated
  word-for-word. Mixed Latin technical terms preserve their standard spelling
  and direction isolation.

### 3.4 Message hierarchy

1. **Hero:** “Put every channel in motion.”
2. **Primary descriptor:** “Social publishing infrastructure for humans and AI
   agents.”
3. **Campaign line:** “Every channel. One intelligent orbit.”
4. **Product proof:** Plan, approve, schedule and analyze from the workspace—or
   operate the same system through API, MCP and CLI.

## 4. Visual identity

### 4.1 Concept

The visual system is **orbital editorial infrastructure**: a dark, precise
canvas with bright signals, oversized editorial type, thin orbital paths,
connected nodes and modular product surfaces. Its memorable gesture is content
and channels moving along a single woven orbit.

It may use Postiz’s proven information architecture and application patterns,
but it must not reproduce Postiz’s marketing copy, proprietary website assets,
testimonials, trademarks or distinctive pink hand-drawn decoration.

### 4.2 Logo

The primary mark is a continuous orbital **O** made from two interwoven paths.
A small signal node sits on the upper-right trajectory. The geometry communicates
orbit, coordination and a loom without depicting a robot, megaphone, speech
bubble or generic sparkle.

Required assets:

- primary horizontal wordmark (`orbiloom` in lowercase);
- standalone mark;
- Arabic companion wordmark (`أوربيلوم`);
- monochrome light and dark-safe behavior;
- favicon and social preview derived from the same mark.

Minimum clear space is the diameter of the signal node on every side. Do not
rotate, stretch, add drop shadows, recolor individual paths outside approved
variants, or place the mark on a low-contrast field.

### 4.3 Color tokens

| Token | Hex | Role |
| --- | --- | --- |
| Void | `#080A0F` | Primary canvas and dark surfaces |
| Deep Space | `#11141C` | Elevated panels |
| Cloud | `#F7F7F2` | Primary text and light surfaces |
| Steel | `#9299AA` | Secondary text and quiet controls |
| Orbit Violet | `#7357FF` | Primary brand field and active state |
| Orbit Violet Hover | `#6043F2` | Primary action hover |
| Signal Lime | `#C8FF4D` | High-priority CTA, success and live signal |
| Pulse Coral | `#FF5F74` | Alerts, emphasis and warm counterpoint |
| Path | `#2A2F3B` | Rules, orbital paths and borders |

Signal Lime is an accent, not a body-text color on light backgrounds. Violet
and coral never encode success or failure without a text/icon cue. All UI color
pairs must meet WCAG 2.1 AA contrast requirements.

### 4.4 Typography

- **Manrope**: Latin product UI, marketing display and body copy.
- **IBM Plex Sans Arabic**: Arabic UI and marketing copy.
- **JetBrains Mono**: code, terminal, API and MCP examples.

Fonts are self-hosted through the application build where possible. Display
headings use tight tracking and strong scale; body copy remains calm and highly
readable. Arabic sizing and line-height are tuned independently rather than
forced into Latin metrics.

### 4.5 Graphic language

- Thin elliptical paths, signal nodes and woven crossings.
- Grid-aligned cards that can break the grid at one deliberate focal point.
- Atmospheric violet fields with restrained lime signals.
- Motion follows paths: nodes travel, cards enter in sequence, and status
  changes pulse once. Respect `prefers-reduced-motion`.
- Product screenshots and real interface simulations are preferred over generic
  3D blobs, robot imagery or stock photography.

## 5. Public website

### 5.1 Routing

The signed-out root route becomes a public landing page rather than redirecting
directly to authentication. `/about`, `/terms`, `/privacy` and `/licenses`
remain public. Authenticated users may still enter the workspace from the
primary CTA.

### 5.2 Landing-page structure

1. Slim announcement/status strip.
2. Navigation with Orbiloom wordmark, Product, Interfaces, Channels, Open Source,
   Pricing, Sign in and “Start free”.
3. Hero with “Put every channel in motion,” the primary descriptor, platform
   signals and two CTAs.
4. Interactive-looking publishing orbit demonstrating one draft moving through
   human/agent review to multiple channels.
5. Audience modes: Workspace, Agents and Developers.
6. Capability grid: scheduling, approval, analytics, media, localization and
   automation.
7. Interface parity section for Web, API, MCP and CLI with honest availability
   labels.
8. Localization section presenting Arabic/RTL and regional calendars as global
   product depth.
9. Open-source/Postiz attribution section.
10. Pricing principles or real configured plans; no invented prices.
11. FAQ and final CTA.

The page uses original Orbiloom copy and graphics while matching the clarity,
confidence and product-proof density the user selected in the Postiz reference.

### 5.3 Responsive and accessible behavior

- Full functionality from 320px upward.
- Logical reading order remains correct without visual positioning.
- Navigation collapses to a semantic disclosure/menu on narrow screens.
- Interactive elements have visible keyboard focus and at least 44px touch
  targets where layout permits.
- Decorative orbit SVGs are hidden from assistive technology; meaningful status
  text remains available.
- English and Arabic page shells render the correct `lang` and `dir` on first
  paint.

## 6. Product application

The application keeps Postiz layout and workflow behavior. The rebrand changes
centralized strings, metadata, product logos, authentication surfaces, colors,
typography and customer-facing copy. Internal database tables, migration names,
package paths and tested `nashr-*` implementation modules remain unchanged until
a separate migration is justified.

No rebrand change may weaken tenant isolation, approval gates, audit behavior,
R2 storage behavior, Arabic/RTL support or upstream mergeability.

## 7. Deliverables

1. Versioned brand bible in `docs/brand/`.
2. SVG mark, English wordmark and Arabic companion wordmark in frontend public
   assets.
3. Updated centralized brand configuration and token tests.
4. Public Orbiloom landing page and responsive public navigation/footer.
5. Updated authentication and application chrome through centralized brand
   assets.
6. Updated metadata/favicon/social-preview references without fabricating a
   production URL.
7. Automated copy/token tests, frontend build and desktop/mobile visual capture.

## 8. Acceptance criteria

- Customer-facing primary surfaces identify the product as Orbiloom, not Nashr.
- The landing page communicates the human-and-agent position above the fold.
- Logo assets are original, code-native SVGs and legible at favicon size.
- Colors and typography match the approved token set.
- English and Arabic shells preserve first-paint direction and readable type.
- The workspace, API, MCP and CLI are described as interfaces to one system;
  unshipped parity is not implied.
- Public source attribution remains visible and correct under AGPL-3.0.
- Existing brand, localization, approval and integration tests pass.
- The production frontend build succeeds.
- Desktop and mobile screenshots show no overflow, broken navigation or
  unreadable contrast.

## 9. Evidence and confidence

The name, position, audience, primary palette and design direction have **high
decision confidence** because the owner explicitly approved them in the product
conversation. Verbal tone, detailed copy patterns and commercial messaging have
**medium evidence confidence** because the product has no customer-call corpus,
established content library or conversion data yet. The first edition should be
treated as a deliberate founding system and revised after real launch evidence,
not as a reconstruction of an existing voice.
