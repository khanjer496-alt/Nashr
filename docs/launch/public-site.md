# PostDelegate public website

The existing Cloudflare Pages project is **postdelegate**, served at
`https://postdelegate.com`. The owned apex domain is active on that existing
project; `https://postdelegate.pages.dev` remains its fallback/preview hostname.
This is the public product preview, **not** the
stateful application or an approved social-publishing service.

The application now uses the **BrightBean-based Django app, background worker and
PostgreSQL**, packaged with Docker. The planned hosting is a small Hetzner server
behind Cloudflare, with R2 for media. Redis and Temporal are not part of this
launch architecture. The static marketing website remains in this repository;
application work lives in the separate
[PostDelegate BrightBean fork](https://github.com/khanjer496-alt/brightbean-studio).

Local signup and the dashboard have been checked in a browser. This does not make
the hosted beta available: Hetzner deployment is deferred, and public signup,
social connections and publishing remain closed. The confirmed operator is
**Nasida Apps LLC**. Working private contacts and social-platform approvals are
still pending; keep policies visibly marked as drafts until the hosted service
and its actual handling of customer data are finalized.

## Reproducible build

Use Node 22.12.0 and pnpm 10.6.1. No social, Cloudflare, database or payment secrets
are needed to build the website.

```sh
pnpm install --frozen-lockfile
export GITHUB_SHA="$(git rev-parse HEAD)"
export NEXT_PUBLIC_APP_URL=https://postdelegate.com
export NEXT_PUBLIC_SOURCE_URL="https://github.com/khanjer496-alt/Nashr/tree/$GITHUB_SHA"
export NEXT_PUBLIC_POSTDELEGATE_PREVIEW=true
node --test tests/ops/platform-access.test.mjs tests/ops/public-site.test.mjs tests/ops/provider-auth.test.cjs tests/ops/www-redirect.test.mjs
node ops/scripts/public-site.mjs prepare
pnpm exec next build apps/public-site --webpack
node ops/scripts/public-site.mjs verify
```

`PostDelegate Public Site` performs those operations in GitHub Actions and uploads
`postdelegate-public-site-<40-character commit>` as an artifact. The export uses
the shared brand, typography, public shell, product preview and policy components;
it is not an independently redesigned landing page. Only explicitly allowlisted
public assets are copied. The static entrypoint always sets preview mode.

This entrypoint uses Next's Webpack builder because Turbopack relocates the shared
Tailwind 3 CJS configuration and breaks its sibling import. Do not remove the flag
without verifying both compilation and the rendered styles.

## Deployment

Download the successful artifact for the exact reviewed commit. First deploy a
Pages preview branch with the normal authenticated Wrangler CLI; verify its pages,
assets, mobile layout, 404s, security headers and `/deployment.json`. Then deploy
the same verified artifact to `main` without rebuilding:

```sh
wrangler pages deploy <artifact-directory> --project-name postdelegate \
  --branch main --commit-hash <exact-artifact-commit>
```

Do not paste or persist the current Wrangler OAuth token into repository secrets.
CI has build-only permissions. For later continuous deployment, create a dedicated
scoped Pages token and a protected production environment rather than copying a
personal OAuth session.

The previous production deployment can be selected in Cloudflare Pages to roll
back. Never delete its immutable deployment while verifying a new one.

## Owned-domain configuration

The production build sets the sharing metadata and homepage canonical to
`https://postdelegate.com`, and records `publicOrigin` in `/deployment.json`.
The export check rejects old `pages.dev` metadata. Do not point every legal
subpage's canonical at the homepage. Preview/no-index and closed-signup behavior
remain unchanged; buying a domain is not a product launch.

The optional `www` alias is handled by the narrowly scoped redirect Worker in
`ops/cloudflare/www-redirect`. It responds only to navigation requests for
`www.postdelegate.com`, sends them to the HTTPS apex, and preserves path and query.
It cannot proxy traffic, collect forms, or choose a destination from user input.
There are no secrets, database bindings, enabled request logs or workers.dev URL.

```sh
wrangler deploy --config ops/cloudflare/www-redirect/wrangler.jsonc
```

This uses Cloudflare's supported Workers Custom Domain provisioning (which creates
the alias's DNS and certificate) without replacing the working apex Pages mapping.
Do not override any existing hostname binding or DNS record during deployment.
The connected CLI has Workers/Pages access but was denied direct DNS-record access;
browser form scripting was also disabled. The separate `nasidaapps.com` domain and
the old pending `postdelegate.nasidaapps.com` alias are deliberately left unchanged.

Verify actual activation after deployment: `https://www.postdelegate.com/privacy?x=1`
must return a 301 to `https://postdelegate.com/privacy?x=1`, and the apex must still
return the intended page with valid TLS. Preparation is not activation evidence.

References: [Pages custom domains](https://developers.cloudflare.com/pages/configuration/custom-domains/),
[Workers Custom Domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/).

## Gates that this does not satisfy

- `/api` is a public documentation hub. Runtime `/api/v1/` endpoints remain absent from the static export; missing backend routes must not fall back to the homepage.
- Signup, payments and social account connections remain closed; `/auth` redirects
  to the truthful launch-status page, not a working account flow.
- Nasida Apps LLC is the confirmed operator. Private support/privacy contacts
  remain pending verification and end-to-end testing. Policy drafts stay visibly
  marked; the contact pages must not imply those channels are operational.
- Local browser verification of signup and the dashboard is not hosted launch
  evidence. Hetzner deployment remains deferred.
- Passing the static export check does not validate the separate BrightBean app,
  establish platform approval or open customer access. App runtime, provider and
  recovery checks belong to the BrightBean deployment.

## Account access observed on 9 September 2026

GitHub and the normal Cloudflare CLI session work. Hetzner has no CLI context and
its console redirected to login. Meta and LinkedIn developer consoles redirected
to login. Google Cloud was open in a separate existing project; no permissions or
new PostDelegate OAuth client were established by that observation. Pinterest
opened developer account setup. TikTok and X landing/console pages alone did not
establish configured apps or approval. Browser automation cannot read or fill the
developer forms through the current Apple Events configuration. No setting was
weakened and no browser credentials were extracted.

No platform application has been submitted by this work. The prepared descriptions,
scopes and recording guidance remain in [platform-access.md](platform-access.md).

## BrightBean content review — 12 September 2026

The landing source now uses an actual local workspace screenshot, shows the
implemented Web/REST/MCP/client-review surfaces, and removes the fictional CLI,
AI copilot and simulated verification claims. Platform icons match providers in
the BrightBean code; they do not establish platform approval. The About and
Licenses pages distinguish the BrightBean workspace from this inherited website.
`NEXT_PUBLIC_WORKSPACE_URL` is separate from the public website origin and is
used for BrightBean account links only when public-preview gating is disabled.

The updated homepage was rendered locally from its TSX/SCSS and checked in
Chrome at desktop and mobile widths, with its CTA reaching local signup. This
local preview renderer is not the Next.js production export. The source changes
and screenshot still require the normal reviewed export/CI and Pages deployment
before they appear on the public domain. No live deployment was performed.


## Resource pages and free tools — 12 September 2026

Added 23 pages: four agent/API guides, eleven platform guides, two comparisons,
two functional utilities and four directory pages. A grouped footer links to
these destinations. The catch-all static route generates each from the typed
content catalog; existing legal and status routes remain explicit pages.

The free caption checker counts Unicode code points and whitespace-delimited
words against a user-selected limit. The UTM builder validates HTTP(S) URLs,
rejects embedded credentials, preserves unrelated query parameters and fragments,
and replaces the three selected UTM tags. Both run locally in the browser; no
input is transmitted or stored by the app. Client guides distinguish documented
protocol support from actual client installation and live-publishing verification.

Local verification: all 30 non-home public pages returned HTTP 200 with one H1;
all local footer links resolved; caption/emoji/limit and UTM preservation/invalid
URL cases passed; selected pages passed 390px layout checks; no JavaScript errors
remained after correcting the local SSR/hydration harness. Sixteen existing/new
public export and redirect checks passed. These results do not replace the full
Next.js export, CI and Cloudflare Pages deployment, which remain pending.
