# PostDelegate public website

The existing Cloudflare Pages project is **postdelegate**, served at
`https://postdelegate.com`. The owned apex domain is active on that existing
project; `https://postdelegate.pages.dev` remains its fallback/preview hostname.
This is the public product preview, **not** the
stateful application or an approved social-publishing service. Keep the established
Docker + PostgreSQL + Redis + Temporal + R2 architecture for the actual app.

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

- `/api` remains absent; an HTTP 200 home-page fallback must not mask missing APIs.
- Signup, payments and social account connections remain closed; `/auth` redirects
  to the truthful launch-status page, not a working account flow.
- No fake domain mailboxes or legal operator are generated. Policy drafts stay
  visibly marked; support/deletion pages explain that the private channels are not
  active until actually configured and tested.
- The full-app check `node ops/scripts/platform-access.mjs smoke <origin>` should
  continue to fail against this preview. Passing the static export check is not
  authorization to submit an app review or open customer access.

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
