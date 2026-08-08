# OPEN_SOURCE_COMPLIANCE.md — Nashr (نشر)

**Phase 8 deliverable.** Base: [Postiz](https://github.com/gitroomhq/postiz-app)
`v1.47.0`, **AGPL-3.0**. Compiled 2026-08-08.

Read alongside [`SECURITY_CHECKLIST.md`](SECURITY_CHECKLIST.md) §8,
[`MENA_CUSTOMIZATIONS.md`](MENA_CUSTOMIZATIONS.md) → *Licence compliance*,
[`RISK_REGISTER.md`](RISK_REGISTER.md) → RISK-L1…L5, and
[`DEPLOYMENT.md`](DEPLOYMENT.md) §9.

> **This document is not legal advice.** It is an engineering compliance record.
> Before the first paying customer, have a lawyer who understands copyleft read
> §2, §3 and §6. Everything here is verifiable from the repository; every claim
> carries the command that produced it.

---

## 0. The one-paragraph version

Nashr is a modified version of AGPL-3.0 software offered to users over a
network. That triggers **AGPL §13**: every remote user must be offered the
Corresponding Source **of the exact build they are using**, including our
modifications. The mechanism exists in the product (a public `/licenses` page
driven by `NEXT_PUBLIC_SOURCE_URL`), but **the source mirror has not been
published and the variable has not been set**, and there is a second,
independent leak in the translated FAQ copy that points customers at upstream
Postiz instead of at us (§3.3). **Both must be fixed before the first customer
logs in.** Until then Nashr is not compliant, and the failure mode is a licence
violation, not a bug.

---

## 1. Scope and licence identification

| Item | Value | Verified by |
|---|---|---|
| Upstream project | `gitroomhq/postiz-app` | `cat version.txt` → `v1.47.0` |
| Upstream licence | GNU AGPL v3.0, verbatim | `wc -l LICENSE` → **661** |
| Root manifest declaration | `"license": "AGPL-3.0"` | `package.json` |
| Nashr's own licence | AGPL-3.0 (a derivative must be) | §6 |
| Direct runtime dependencies inventoried | **213** | `grep -c '{ name:' apps/frontend/src/components/legal/dependencies.ts` |
| Upstream commits retained | 2 781 | `MENA_CUSTOMIZATIONS.md` |

Nashr is a **derivative work**. It is not an independent program that merely
talks to Postiz; it modifies Postiz's own source tree (Prisma schema, Temporal
publish activity, frontend layout, locale files) and links new libraries into
the same process. There is no arrangement under which Nashr is separately
licensable.

---

## 2. What AGPL-3.0 actually obliges us to do

Four obligations, in the order they bite.

### 2.1 Keep the licence and the notices (§4, §5)

- `LICENSE` stays byte-identical. So do `SECURITY.md`, `CODE_OF_CONDUCT.md`,
  `CONTRIBUTING.md`, `ICLA.md`, `CCLA.md`.
- Copyright notices in source files are preserved, never rewritten.
- Modified files must carry "prominent notices stating that you modified it and
  the date". `MENA_CUSTOMIZATIONS.md` is the project-level record of this;
  individual Nashr edits inside upstream files are marked inline
  (e.g. `// ── Nashr (نشر) addition — approval gate ──` in
  `apps/orchestrator/src/activities/post.activity.ts:28`).

### 2.2 Licence the whole modified work under AGPL-3.0 (§5c)

Our additions — `libraries/nashr-brand`, `nashr-i18n`, `nashr-content`,
`nashr-permissions`, `nashr-approval`, `nashr-agents`, the new controllers, the
migrations, the `ops/**` tooling — are part of the same program and are
AGPL-3.0. We cannot licence the Nashr layer proprietarily while shipping it in
the same binary as Postiz.

### 2.3 Offer the Corresponding Source over the network (§13) — the SaaS clause

> "…if you modify the Program, your modified version must prominently offer all
> users interacting with it remotely through a computer network … an
> opportunity to receive the Corresponding Source of your version …"

There is **no SaaS exemption**. Not distributing binaries does not help; §13
exists precisely to close that gap. The obligation starts the moment a user who
is not us interacts with the running instance.

"Corresponding Source" means the source **for the version they are actually
using** — including build scripts and the definitions needed to rebuild it.
A link to upstream Postiz does not satisfy it, because upstream is not the
source of our build.

### 2.4 Do not impose further restrictions (§10)

Terms of service may not forbid what the AGPL permits — most obviously, the
customer's right to obtain and redistribute the source. Whoever writes
`/terms` must be told this. **Owner decision:** the Terms text is not written
here; `brand.legal.entityName` is deliberately empty until the owner supplies
`NEXT_PUBLIC_BRAND_LEGAL_NAME`.

---

## 3. Our source-offer mechanism — status

### 3.1 What is built

| Piece | Where | State |
|---|---|---|
| Public `/licenses` page | `apps/frontend/src/app/(app)/(site)/licenses/page.tsx` | Built |
| Reachable **while signed out** | `apps/frontend/src/proxy.ts:14` — `publicPages = ['/about','/terms','/privacy','/licenses']` | Built |
| Source URL value | `libraries/nashr-brand/src/brand.config.ts:191` — `env(process.env.NEXT_PUBLIC_SOURCE_URL, 'https://github.com/gitroomhq/postiz-app')` | Built, **unset** |
| Dependency inventory rendered on the page | `apps/frontend/src/components/legal/dependencies.ts` (213 entries) | Built |
| Footer attribution "Built on Postiz (AGPL-3.0)" | `brand.upstream.attribution` | Built |
| Build fails when `NEXT_PUBLIC_SOURCE_URL` is unset | `docker-compose.prod.yaml` | Built |
| **The public mirror itself** | — | **DOES NOT EXIST** |

The Phase 2 fix that made this reachable matters and should not be undone:
before it, `(site)/layout.tsx` rendered `null` until `/user/self` resolved and
the proxy bounced anonymous visitors to `/auth`, so `/licenses` was reachable
only by authenticated users. **A source offer that only logged-in customers can
see does not satisfy §13** — §13 says *all users interacting with it remotely*.

### 3.2 The build-time trap — read this before deploying

`NEXT_PUBLIC_SOURCE_URL` is a `NEXT_PUBLIC_*` variable. Next.js **inlines it
into the client bundle at build time**. Setting it in `.env.prod` and
restarting does nothing: the compiled JavaScript still carries whatever value
was present when `docker build` ran — and the fallback is
`https://github.com/gitroomhq/postiz-app`, i.e. **upstream**.

So the failure mode is silent and looks fine in config:

```
.env.prod says   NEXT_PUBLIC_SOURCE_URL=https://github.com/acme/nashr
the page shows   https://github.com/gitroomhq/postiz-app
```

It must be passed as a `--build-arg` (`DEPLOYMENT.md` §4.4). Verify **on the
running site**, not in the env file:

```bash
curl -sS https://<your-domain>/licenses | grep -o 'https://github.com/[^"<]*' | sort -u
```

If `gitroomhq/postiz-app` appears anywhere other than the upstream-attribution
sentence, the offer is not being made.

### 3.3 🔴 BLOCKER — a second source link, hardcoded in 16 locale files

**This is a new finding and it is not covered by `NEXT_PUBLIC_SOURCE_URL`.**

The billing FAQ ("Can I trust Nashr?") answers with a "view the source code"
link. The React default correctly interpolates `brand.sourceUrl`
(`apps/frontend/src/components/billing/faq.component.tsx:29`) — but i18next
prefers a resource value over a default when the key exists, and the key
**does** exist, with a hardcoded upstream URL, in every base locale.

Reproduce:

```bash
python3 - <<'PY'
import json,glob,os
for f in sorted(glob.glob('libraries/react-shared-libraries/src/translation/locales/*/translation.json')):
    d=json.load(open(f))
    n=sum(1 for v in d.values() if isinstance(v,str) and 'postiz' in v.lower())
    if n: print(os.path.basename(os.path.dirname(f)), n)
PY
# -> ar bn de en es fr he it ja ka_ge ko pt ru tr vi zh, 1 each = 16 total
```

The single offending value, in `en` and mirrored in all 15 other base locales,
is under the key `faq_postiz_gitroom_is_proudly_open_source`:

```
... To view the open-source repository,
<a href="https://github.com/gitroomhq/postiz-app" ...>click here</a>.
```

Consequences, both real:

1. **§13.** A customer following the product's own "view the source code" link
   lands on upstream Postiz, not on the Corresponding Source of our build.
2. **Trademark (RISK-L2).** It is a customer-facing link to the Postiz project
   from a page branded Nashr.

**Fix before launch.** Either delete the key from all 16 locale files so the
`brand.sourceUrl` default is used, or replace the URL in each value. Then
re-run the check above and expect `0`. Also re-check after every
`lingo.dev` translation run — a regenerated catalogue can reintroduce it.

> Note the distinction: `postiz` still appears in ~10 translation **keys** per
> locale (e.g. `faq_what_are_channels` is fine, `faq_am_i_going_to_be_charged_by_postiz`
> is a key slug). Key names are never rendered and are deliberately left alone —
> renaming them would break every locale file and every upstream merge. Only
> **values** matter, and after the fix above there must be none.

### 3.4 Which mirror, and how public

**Owner decision (D7 in `IMPLEMENTATION_PLAN.md`).** Two compliant routes:

| Route | Effort | Notes |
|---|---|---|
| **Public git repo** (GitHub/GitLab), mirroring the deployed tag | Low | Simplest and the one this codebase is built for. Push a tag matching `NASHR_IMAGE_TAG` on every release. |
| **Tarball download served by the app** | Higher | Must be generated per build and kept in step. No advantage here. |

Whichever is chosen, the mirror must contain **the code that is running**, at
the version that is running. Publishing at `NASHR_IMAGE_TAG` time keeps them
aligned by construction.

**What this means commercially, stated plainly so nobody is surprised later:**
publishing the mirror makes the Nashr source code public. Prompts, the role
matrix, the agent guardrails, the MENA campaign content and the brand
configuration all become readable by anyone, including competitors. That is the
price of building on AGPL software and it was accepted when Postiz was chosen
as the base. Customer data, secrets and OAuth credentials are **not** affected —
those live in environment variables and the database, never in the repository
(verified: `AUDIT_REPORT.md` §12, no hardcoded secrets).

If that trade is unacceptable to the owner, the only lawful alternatives are to
negotiate a separate commercial licence with the Postiz copyright holders, or
not to ship. Keeping the repo private and hoping is not an option — it is the
violation.

---

## 4. Trademark is not covered by the licence

The AGPL grants **copyright** permissions. It grants no trademark rights
(§7(e) explicitly allows the licensor to decline permission to use their names
or trademarks). "Postiz" and the Postiz logo remain the upstream project's
marks.

The practical rule for Nashr:

| Allowed | Not allowed |
|---|---|
| Factual attribution: "Nashr is built on Postiz, distributed under the AGPL-3.0" | Using the Postiz name or logo as branding, in marketing, or in a way that implies endorsement |
| Linking to the upstream repository as attribution | Shipping the Postiz wordmark, favicon or OG images |
| Keeping `@gitroom/*` internal import paths (never customer-visible) | Naming the product, domain, app icon or emails after Postiz |

Current state:

```bash
grep -ril postiz apps/frontend/src apps/backend/src libraries/*/src | wc -l   # 49
```

Those 49 are attribution strings, translation **key slugs**, and the upstream
import scope — plus the one FAQ **value** in §3.3, which is the only
customer-visible offender and is a launch blocker. `MENA_CUSTOMIZATIONS.md`
records the deliberate decision not to rename `@gitroom/*` (≈900 files, breaks
every future upstream merge, zero customer benefit).

**Also unresolved:** upstream testimonials and the "Join 10,000+ Entrepreneurs"
copy are behind `NEXT_PUBLIC_SHOW_TESTIMONIALS`
(`apps/frontend/src/app/(app)/auth/layout.tsx:21`), **default off**. Leave it
off. Those quotes were given to Postiz; re-attributing them to Nashr would be
misrepresentation, independent of any licence question.

---

## 5. Dependency inventory

Rendered on `/licenses` from
`apps/frontend/src/components/legal/dependencies.ts` — 213 direct runtime
dependencies with declared licences. Transitive dependencies carry their own
notices inside `node_modules`.

Distribution (from `licenseSummary` in the same file):

| Licence | Direct deps | Compatible with AGPL-3.0 distribution? |
|---|---:|---|
| MIT | 176 | Yes |
| Apache-2.0 | 21 | Yes (AGPL-3.0 is one-way compatible with Apache-2.0) |
| ISC | 3 | Yes |
| MPL-2.0 | 2 | Yes — file-level copyleft, satisfied by shipping the source |
| Unlicense | 2 | Yes (public-domain dedication) |
| BSD-2-Clause / BSD-3-Clause / 0BSD / MIT-0 | 4 | Yes |
| **UNKNOWN** | **2** | **Needs resolution — §5.1** |
| **"Platform License"** | **1** | **Needs review — §5.2** |
| **"SEE LICENSE IN …"** | **2** | **Needs review — §5.3** |

### 5.1 Two packages declare no licence

```
sha256@0.2.0          license: UNKNOWN
twitter-text@3.1.0    license: UNKNOWN
```

"UNKNOWN" here means the installed `package.json` carries no `license` field.
Both are upstream Postiz dependencies, not Nashr additions. Before launch,
open each package's own `LICENSE`/`README` in `node_modules` and record the
actual licence in `dependencies.ts`. `twitter-text` is published by X/Twitter
and is generally Apache-2.0 — **verify, do not assume**. If a package genuinely
has no licence grant, it cannot lawfully be redistributed and must be replaced.

### 5.2 `facebook-nodejs-business-sdk@21.0.5` — "Platform License"

Meta's own SDK licence, not an OSI licence. It is a *platform terms* document
rather than a free-software grant and can restrict use. Read it and record a
verdict. This one is worth a lawyer's eye because it sits directly in the
publishing path for Facebook and Instagram — the two channels the beta most
depends on.

### 5.3 `polotno@3.0.0-beta.25` and `posthog-js@1.359.1`

Both declare `SEE LICENSE IN …`, i.e. a bespoke file. Polotno in particular is
a **commercial** design editor with a paid licence model in some
configurations; it is the vendored editor referenced in
`libraries/nashr-i18n/RTL_CHECKLIST.md`. Determine whether the deployment
requires a Polotno licence key or subscription, and whether PostHog's licence
permits our use. If Polotno needs a paid licence and the feature is not needed
for the beta, disabling it is cheaper than buying it.

### 5.4 RISK-L5 — Mastra licensing: **now verified, partially**

The audit flagged `@mastra/*` as possibly Elastic-licensed, which would have
restricted SaaS resale. Verified from the installed manifests:

```bash
for p in core memory pg mcp; do
  python3 -c "import json;d=json.load(open('node_modules/@mastra/$p/package.json'));print('$p',d['license'],d['version'])"
done
# core   Apache-2.0 1.21.0
# memory Apache-2.0 1.13.0
# pg     Apache-2.0 1.8.5
# mcp    Apache-2.0 1.4.1
# also: @ag-ui/mastra 1.0.1 Apache-2.0, mastra (CLI) 1.3.19 Apache-2.0
```

**Apache-2.0 — compatible with AGPL-3.0 and with SaaS resale.** RISK-L5 can be
downgraded from 🟡 Medium to 🟢 Low.

One residual caveat, recorded honestly: `@mastra/core` **ships no `LICENSE`
file** (`ls node_modules/@mastra/core/LICENSE*` → no such file). The grant is
the `license: "Apache-2.0"` field in `package.json` plus the project's public
repository. That is normal npm practice and generally sufficient, but note
Apache-2.0 §4 obliges redistributors to include a copy of the licence — so if
you ever redistribute `node_modules` (you do not today; the Docker image is
built from the lockfile), include the Apache-2.0 text. Confirm the licence
against the upstream Mastra repository at the pinned version and record the
result here.

### 5.5 Keeping the inventory honest

`dependencies.ts` is generated from `package.json` + installed manifests and
carries a "do not hand-edit" header. Regenerate it whenever dependencies
change, and re-check the summary counts. A stale inventory on a public
`/licenses` page is worse than none — it is a false statement.

---

## 6. Sub-package licence metadata (RISK-L4)

```bash
for f in apps/*/package.json; do
  python3 -c "import json;print('$f', json.load(open('$f')).get('license','(none)'))"
done
# apps/backend      ISC
# apps/commands     ISC
# apps/frontend     ISC
# apps/orchestrator ISC
# apps/sdk          AGPL-3.0
# apps/extension    (none)
```

Four workspace manifests declare `ISC` while the root declares `AGPL-3.0`.
This is **upstream metadata sloppiness inherited from Postiz**, not a Nashr
change, and the combined work is unambiguously AGPL-3.0 — those packages are
not independently distributable and contain AGPL-licensed code.

**Do not "fix" this by leaving `ISC` in place and shipping.** Someone could
reasonably read `apps/frontend/package.json` as an offer of ISC terms on
AGPL code. Two acceptable resolutions, both cheap:

- **Preferred:** state the position explicitly on `/licenses` and in this file
  (done), and leave the manifests untouched so upstream merges stay clean.
- **Alternative:** set them all to `AGPL-3.0`. This is a 4-line change that
  strengthens rather than weakens the claim, at the cost of a small recurring
  merge conflict.

Either is defensible. Silence is not. **Owner/lawyer decision.**

The Nashr libraries (`libraries/nashr-*`) deliberately ship **no**
`package.json` at all — no library in this repo has one, and adding one breaks
`pnpm install --frozen-lockfile` in CI (`MENA_CUSTOMIZATIONS.md`). They are
covered by the root declaration.

---

## 7. Obligations we inherit *toward* our own customers

Because Nashr is AGPL-3.0, each customer is a licensee with rights:

- to receive the Corresponding Source of the version they use (§13);
- to modify it and run their own instance;
- to redistribute it under the AGPL-3.0.

They do **not** get rights to our trademarks, our hosted instance, our
customers' data, or our infrastructure. Terms of service may govern access to
*our service*; they may not restrict the software rights above (§10).

Practical consequence for the sales conversation: a customer can, lawfully,
take the source and self-host. The product's defensibility is operations,
support, MENA content, Arabic quality and the hosted service — not source
secrecy. Price accordingly (see `PRICING_RECOMMENDATIONS.md`).

---

## 8. Pre-launch compliance checklist

Nothing below is optional. Ticking a box means evidence exists, not that it
looked plausible.

### Blocking — no customer may log in until all are done

- [ ] 🔴 **Public source mirror exists** and contains the deployed code at the
      deployed tag. *(RISK-L1)*
- [ ] 🔴 **`NEXT_PUBLIC_SOURCE_URL` passed as a `--build-arg`** and pointing at
      that mirror. Verify on the **live site**, not in `.env.prod`:
      `curl -sS https://<domain>/licenses | grep -o 'https://github.com/[^"<]*' | sort -u`
- [ ] 🔴 **The FAQ locale link is fixed in all 16 base locale files** (§3.3).
      Verify: the python snippet in §3.3 prints nothing.
- [ ] 🔴 `/licenses`, `/terms`, `/privacy`, `/about` are reachable **while
      signed out** on the live domain (HTTP 200, not a redirect to `/auth`).
- [ ] 🔴 `wc -l LICENSE` → `661`, and `git status` shows no modification to the
      six protected files.

### Required before the first customer, not necessarily before first deploy

- [ ] Resolve the 2 `UNKNOWN` dependency licences (§5.1); update
      `dependencies.ts`.
- [ ] Record a verdict on `facebook-nodejs-business-sdk`'s "Platform License"
      (§5.2).
- [ ] Record a verdict on `polotno` and `posthog-js` (§5.3), including whether
      a paid Polotno licence is required.
- [ ] Decide and document the sub-package `ISC` metadata position (§6).
- [ ] Confirm `@mastra/*` Apache-2.0 against the upstream repo at the pinned
      versions; close RISK-L5 (§5.4).
- [ ] Legal entity name and jurisdiction set
      (`NEXT_PUBLIC_BRAND_LEGAL_NAME`, `NEXT_PUBLIC_BRAND_JURISDICTION`) so
      `/terms` and `/privacy` stop rendering the placeholder notice.
      **Owner decision — not invented here.**
- [ ] `/terms` reviewed by a lawyer against AGPL §10 (no further restrictions).
- [ ] `NEXT_PUBLIC_SHOW_TESTIMONIALS` confirmed absent or not `"true"`.
- [ ] Regenerate `dependencies.ts` and re-verify the counts.

### On every release, forever

- [ ] Push the mirror at the same tag as `NASHR_IMAGE_TAG`, in the same step.
- [ ] Re-run the §3.3 locale check (a translation run can reintroduce it).
- [ ] Re-run `wc -l LICENSE` → 661.
- [ ] If dependencies changed, regenerate `dependencies.ts`.
- [ ] After each monthly upstream merge, re-read `MENA_CUSTOMIZATIONS.md` for
      new upstream files that need attribution notices.

---

## 9. What is genuinely unknown

Recorded rather than glossed, because a confident guess here is worse than a
gap.

| Unknown | Why it is unresolved |
|---|---|
| Whether `sha256@0.2.0` and `twitter-text@3.1.0` carry any licence grant | Requires reading files inside `node_modules`; not done because the answer must be recorded with a version, and the dependency set will change before launch |
| Whether Polotno's licence requires payment in our configuration | Bespoke commercial licence text; a commercial reading, not an engineering one |
| Whether the Meta SDK's "Platform License" restricts a paid SaaS | Same |
| Whether a UAE court would read AGPL §13 as we do | No case law we can cite. The engineering position is to comply as if it clearly applies |
| Whether the Postiz maintainers would offer a commercial licence | Never asked. Only relevant if the owner rejects publishing the mirror |
