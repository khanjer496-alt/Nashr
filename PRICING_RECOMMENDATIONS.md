# PRICING_RECOMMENDATIONS.md — Nashr (نشر)

> **Historical analysis — superseded 2026-08-22.** The AED/SAR and MENA-first
> recommendations below are retained as research, not as executable pricing.
> The approved direction is global USD pricing and onboarding. Final tiers,
> entitlements, tax handling and billing copy require the dedicated global
> pricing/onboarding plan before they may be published.

**Phase 8 deliverable.** A recommendation, not a decision. Compiled 2026-08-08.

> **Nothing here has been agreed by anyone.** No price in this document is a
> committed price, and no legal entity, tax registration or payment provider has
> been decided. Every number below is a *starting point for the owner's
> judgement*, with the reasoning shown so it can be argued with.
>
> **This is not tax or legal advice.** §6 flags VAT because ignoring it would be
> worse; it is a prompt to talk to an accountant, nothing more.

---

## 1. Where pricing stands today

The product still ships **upstream Postiz's USD price list, unchanged**:

`libraries/nestjs-libraries/src/database/prisma/subscriptions/pricing.ts`

| Tier | USD/mo | USD/yr | Channels | Team members | AI | Image gen/mo | Videos/mo | Public API | Webhooks |
|---|---:|---:|---:|---|---|---:|---:|---|---:|
| FREE | 0 | 0 | 0 | ✗ | ✗ | 0 | 0 | ✗ | 0 |
| STANDARD | 29 | 278 | 5 | ✗ | ✓ | 20 | 3 | ✓ | 2 |
| TEAM | 39 | 374 | 10 | ✓ | ✓ | 100 | 10 | ✓ | 10 |
| PRO | 49 | 470 | 30 | ✓ | ✓ | 300 | 30 | ✓ | 30 |
| ULTIMATE | 99 | 950 | 100 | ✓ | ✓ | 500 | 60 | ✓ | 10000 |

Two observations before any repricing:

1. **The annual discount is a consistent 20%** across every paid tier
   (`278 / (29×12) = 0.799`). That is a sane convention and worth keeping.
2. **`posts_per_month` is `1000000` on every paid tier** — effectively
   unlimited. The real meter is **channels**, not posts. That is the correct
   meter for this market and should be preserved: an agency's cost to us scales
   with connected accounts, not with how often they post.

Currency formatting for AED and SAR already exists in `libraries/nashr-i18n`;
the tier values themselves have not been touched. **Repricing is a data change
in `pricing.ts` plus billing-UI copy, not new engineering.**

---

## 2. Straight conversion — the reference point, not the answer

The AED and SAR are **pegged**, not floating: AED 3.6725 = USD 1 and
SAR 3.75 = USD 1. Confirm both pegs are still in force at the time you price —
they have held for decades, but "it has always been true" is not a check.

| Tier | USD/mo | AED/mo | SAR/mo | USD/yr | AED/yr | SAR/yr |
|---|---:|---:|---:|---:|---:|---:|
| STANDARD | 29 | 106.50 | 108.75 | 278 | 1 020.95 | 1 042.50 |
| TEAM | 39 | 143.23 | 146.25 | 374 | 1 373.51 | 1 402.50 |
| PRO | 49 | 179.95 | 183.75 | 470 | 1 726.08 | 1 762.50 |
| ULTIMATE | 99 | 363.58 | 371.25 | 950 | 3 488.88 | 3 562.50 |

Do **not** ship these numbers. AED 106.50 reads as a converted foreign price,
which is exactly the impression a MENA-first product should avoid. Price in
round local figures that look native.

---

## 3. What a customer actually costs us

Two real per-tenant costs, plus one that is fixed.

### 3.1 Infrastructure — mostly fixed, and heavy for a small beta

`DEPLOYMENT.md` §2 gives the measured figures: the production stack is **eight
containers** totalling **≈6.6 GB** of memory limits, and **the image build alone
needs ~5 GB**. Minimum to run production is 8 GB / 4 vCPU / 80 GB SSD (building
elsewhere); **recommended 16 GB / 4–8 vCPU / 160 GB NVMe**, plus a separate
8 GB staging host.

The important property: **this cost is almost entirely fixed.** Customers 1
through 10 run on the same box. Marginal infrastructure cost per beta customer
is close to zero; what you are really recovering is a fixed monthly platform
cost spread over a small number of tenants.

That has a direct pricing consequence:

> **At 5–10 customers, no plausible price recovers the platform cost. Accept
> that.** The beta is a learning purchase, not a profit centre. Price for what
> the product is worth to the customer and for what you want to learn, not for
> break-even at n=7.

**Owner input required (not invented here):** the monthly cost of the production
host, the staging host, R2 storage and egress, the domain, and email sending.
Get real quotes for a region close to the UAE — `DEPLOYMENT.md` suggests
AWS `me-central-1` (Dubai), or Frankfurt / Jeddah alternatives. Latency to the
UAE affects perceived responsiveness more than raw price does.

Fill this in before setting a price:

| Line item | AED/month | Source |
|---|---|---|
| Production host (16 GB / 4 vCPU / 160 GB NVMe) | | provider quote |
| Staging host (8 GB) | | provider quote |
| R2 storage + egress | | usage-based |
| Domain, email/SMTP, Sentry | | |
| Backup storage (R2, separate bucket) | | |
| **Fixed platform total** | | |
| **÷ number of customers** | | **= true per-customer infra cost** |

### 3.2 AI tokens — the one genuinely variable per-tenant cost

This is the cost that scales with usage, and it is the reason usage limits
already exist in `pricing.ts` (`image_generation_count`, `generate_videos`).

The agent layer is **hard-bounded per turn** — these are enforced in
`libraries/nashr-agents`, not aspirational:

| Budget | Value |
|---|---:|
| Tokens per agent turn | 24 000 |
| Tokens per model call | 2 000 |
| Tool calls per turn | 12 |
| Timeout per tool / per turn | 30 s / 120 s |

So a worst-case agent conversation is bounded at 24 000 tokens. The caption /
content generation path (`openai.service.ts`) is separate and unbounded per
call, but small.

**Cost model the owner should complete:**

```
monthly AI cost per customer
  ≈ (agent turns/month × 24 000 tokens × blended token rate)
  + (captions/month × ~1 500 tokens × blended token rate)
  + (image generations/month × per-image rate)     # capped by tier
  + (video generations/month × per-video rate)     # capped by tier
```

**The token and image rates must come from the provider's current price list at
the time you price.** They are not stated here: model pricing changes, and a
number that is wrong by 3× would silently corrupt every tier. Note also the
doc/code drift flagged in `FEATURES.md` §5.10 — `.env.example` says the default
agent model is `gpt-5.2`, the code says `gpt-4.1`. **Resolve which model
actually runs before costing it**, because they do not cost the same.

The structural point survives whatever the rates are: **image and video
generation dominate AI cost, text does not.** Upstream already meters exactly
those two. Keep the caps; do not offer "unlimited AI".

### 3.3 Support — the real cost at this scale

For 5–10 beta customers, the dominant cost is **your time**: onboarding, Meta
and TikTok app-review handholding, channel reconnections, Arabic copy questions.
Budget for it explicitly. A price that ignores support time will look profitable
and feel exhausting.

---

## 4. Recommended structure

Three paid tiers plus a trial. Named for the market, metered on channels and
brands, with the approval workflow as the paid differentiator.

| | **Mahal / محل**<br>single business | **Wakala / وكالة**<br>small agency | **Wakala Plus / وكالة بلس**<br>growing agency |
|---|---|---|---|
| Who it is for | one restaurant, salon or clinic | agency with a handful of clients | agency with a portfolio |
| Brands (`Customer` records) | 1 | 5 | 15 |
| Channels | 5 | 20 | 50 |
| Team members | 2 | 10 | 25 |
| Client approval workflow | ✗ | ✓ | ✓ |
| Client (`CLIENT` role) logins | — | ✓ | ✓ |
| AI captions & localisation | ✓ | ✓ | ✓ |
| Image generation / month | 30 | 150 | 400 |
| Video generation / month | 3 | 15 | 40 |
| MENA campaign templates | ✓ | ✓ | ✓ |
| Public API + webhooks | ✗ | ✓ | ✓ |
| **Recommended AED / month** | **149** | **449** | **999** |
| **Recommended SAR / month** | **149** | **449** | **999** |
| **Annual (20% off, 10 months)** | 1 490 | 4 490 | 9 990 |

### Why these numbers

- **AED 149 for a single business.** Below AED 150 is a small-business
  discretionary spend in the UAE — the threshold where a restaurant owner
  decides without a meeting. It sits ~40% above the converted upstream STANDARD
  (AED 106.50), which is justified: Arabic, MENA campaign content, and human
  support are things Postiz does not offer.
- **AED 449 for the small agency.** This is where the approval workflow lives,
  and approval is *the* feature an agency buys. An agency billing a client
  AED 2 000–4 000/month for social management will not blink at AED 449 for the
  tool that removes the "did the client approve this?" email thread. Gating
  approval behind the agency tier is the single most defensible packaging
  decision here.
- **AED 999 top tier.** Round, memorable, and roughly 2.2× the tier below —
  a normal SaaS step. It should be comfortably above your true cost per heavy
  tenant once §3.1 and §3.2 are filled in. **Verify that before publishing it.**
- **Same nominal figure in AED and SAR.** They differ by only 2% at the pegs
  (AED 149 ≈ SAR 152). Charging the same number in both is simpler to
  communicate, avoids a "why is Saudi more expensive" conversation, and the
  rounding difference is noise. If the owner prefers strict parity, use
  SAR 152 / 459 / 1 019 — less clean, marginally fairer.
- **Channels, not posts, as the meter.** Preserves upstream's model, matches
  what actually costs us (token refresh, API quota, storage), and is what
  agencies already understand.

### What to charge for the beta specifically

**Recommendation: charge something, but small — or nothing, explicitly framed as
free.** The failure mode to avoid is a vague "we'll sort pricing later", which
makes the eventual first invoice a negotiation you will lose.

Two defensible options:

| Option | Mechanics | Trade-off |
|---|---|---|
| **Free beta, fixed end date** | 90 days free, price and end date stated in writing on day one, converts to a paid tier at 50% for the first year | Removes price as a variable while you are learning whether the product works. Best if you want honest feedback. |
| **Paid beta at 50%** | AED 75 / 225 / 500 | A customer who pays gives more serious feedback. Best if you want to validate willingness to pay. |

**Do not** offer lifetime deals, and **do not** offer a free tier with connected
channels — each connected channel costs real token-refresh work and support
regardless of revenue. Upstream's `FREE` tier already has `channel: 0`, which is
the right shape: free means "look around", not "run your business".

---

## 5. What to charge for AI, and what not to

- **Keep AI text generation inside every tier.** It is cheap, it is the reason
  someone picks Nashr over a spreadsheet, and metering it makes the product feel
  stingy.
- **Meter image and video generation.** These dominate AI cost (§3.2) and
  upstream already has the counters.
- **Do not sell "unlimited AI".** With bounded per-turn budgets you are safe
  from catastrophe, but a heavy tenant can still make a tier unprofitable, and
  "unlimited" is impossible to walk back.
- **Consider a top-up pack** (e.g. +100 images) once you see real usage. Do not
  build it before you have data.

---

## 6. VAT — flag for the owner's accountant, not advice

**Confirm all of this with a qualified accountant before invoicing anyone.**

| | UAE | Saudi Arabia |
|---|---|---|
| Standard VAT rate | **5%** | **15%** |
| Question for the accountant | Is registration mandatory at your turnover? What is the current threshold? | Do you have an obligation on B2B sales into KSA, and does the reverse charge apply? |
| Practical pricing question | Are the AED figures above **VAT-inclusive or exclusive**? | Same |

Things that will bite if unresolved:

- **Inclusive vs exclusive must be decided before the first invoice.** Changing
  it later is a price increase to every existing customer. B2B SaaS in the Gulf
  is commonly quoted **exclusive** of VAT with "+ VAT" stated — but that is an
  observation about convention, not a recommendation.
- **The 10-point gap between UAE and KSA VAT** is the strongest argument for
  quoting exclusive. A single VAT-inclusive number cannot be right in both
  markets.
- **Stripe** (already integrated) can handle VAT collection, but it must be
  configured deliberately, with the correct tax registrations behind it.
- **The legal entity is undecided.** `NEXT_PUBLIC_BRAND_LEGAL_NAME` and
  `NEXT_PUBLIC_BRAND_JURISDICTION` are deliberately empty in the code, and the
  legal pages render a placeholder notice until they are set. **Entity,
  jurisdiction, tax registration and invoicing are all owner decisions and none
  of them has been made.** Pricing cannot be finalised before them.

---

## 7. A pricing consideration unique to this product

Nashr is AGPL-3.0. Every customer has the legal right to take the source and
self-host it (`OPEN_SOURCE_COMPLIANCE.md` §7). Realistically none of the target
verticals will — a salon owner is not going to run an eight-container Temporal
stack — but an **agency with a technical founder might**, and the source will be
publicly mirrored.

The implication is not to price defensively. It is that **the product you are
selling is the hosted service, the Arabic quality, the MENA content and your
support — not the code**. That happens to be the right positioning for this
market anyway. It does mean an enterprise-style price with no service behind it
would be hard to defend.

---

## 8. What to do before publishing any price

- [ ] Fill in the fixed-cost table in §3.1 with **real quotes**.
- [ ] Resolve which AI model actually runs (§3.2) and cost it at current rates.
- [ ] Decide legal entity, jurisdiction and tax registration.
- [ ] Decide VAT-inclusive vs exclusive, in writing, before the first invoice.
- [ ] Confirm the AED and SAR pegs are current.
- [ ] Decide beta pricing **and its end date** before onboarding customer #1.
- [ ] Update `pricing.ts` and the billing UI copy together — the tier names in
      code are `FREE/STANDARD/TEAM/PRO/ULTIMATE` and are referenced by
      `SubscriptionTier` in the schema. **Renaming the enum is a migration;
      renaming only the display strings is not.** Prefer changing display copy
      and values, not the enum.
- [ ] Re-read `FEATURES.md` §5 and decide, honestly, whether the product as it
      stands is worth AED 449/month to an agency **without Snapchat and with
      unreviewed Arabic**. If the answer is no, the fix is to close those gaps,
      not to lower the price.
