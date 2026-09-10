# PostDelegate lean beta

Updated: **10 September 2026**.

This is the lowest-cost safe launch profile for the first controlled PostDelegate
beta. It is an **overlay on the maintained Postiz-derived Docker architecture**,
not a rewrite. The goal is to remove optional recurring spend while preserving
publishing, scheduling, ordinary media uploads, isolation, approvals, backups and
the external API/MCP surface.

## Release scope

Keep for the first beta:

- the web workspace, composer, calendar and ordinary image/video uploads;
- the existing PostgreSQL, Redis and Temporal publishing path;
- public API and MCP tools that do not require a PostDelegate-hosted model;
- only social providers explicitly enabled after real access and publish evidence;
- R2 media plus a separate private R2 backup target;
- closed registration until the initial administrator and invite flow are proven.

Disabled in lean mode:

- PostDelegate-hosted text/image/video generation and Copilot UI requests;
- the unfinished custom Nashr/PostDelegate agent layer;
- Polotno unless a valid commercial key is deliberately supplied outside lean mode;
- platform analytics polling;
- third-party AI/video providers;
- X, which requires a separately budgeted rollout;
- Stripe billing during the free beta.

`POSTDELEGATE_LAUNCH_MODE=lean` is fail-closed. An empty
`POSTDELEGATE_ENABLED_PROVIDERS` means **zero customer social connections**. Add an
exact provider identifier only after the platform access and real-publish row is
complete. A credential by itself is not approval.

## Files

- `.env.lean.example` — safe template; copy values into a real ignored env file.
- `docker-compose.lean.yaml` — overlay applied after production or staging Compose.
- `ops/scripts/lean-preflight.mjs` — validates the merged Compose configuration
  without printing secrets.
- `tests/scripts/verify-lean-compose.mjs` — renders both real Compose combinations
  with synthetic values; no Docker daemon is required.
- `tests/ops/lean-launch.test.cjs` — regression coverage for paid-feature gates,
  provider allowlisting and lean MCP behavior.
- `.github/workflows/postdelegate-lean.yml` — build/test evidence only; it does not
  purchase a server, create platform apps or deploy production.

## Build and configuration check

```bash
export PATH=/opt/homebrew/opt/node@22/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin
node --test tests/ops/lean-launch.test.cjs tests/ops/lean-compose.test.mjs
node tests/scripts/verify-lean-compose.mjs
pnpm run build
```

CI installs dependencies and runs the same lean checks on Node 22.12.0. Local
build failure caused only by an uninstalled worktree is not release evidence;
the branch must still pass GitHub's full build and integration workflows.

## Production shape

Target application hostname: `app.postdelegate.com`.

For the first beta, run one production Docker host and build the image in CI.
Do not permanently rent a second staging host. Use an isolated temporary host for
release/restore rehearsals, then deliberately destroy it. A stopped cloud VM may
still incur charges.

The production app image must be referenced by **digest**, not `latest`, `main` or
another floating tag. The lean Compose overlay requires:

```text
ghcr.io/khanjer496-alt/postdelegate@sha256:<exact digest>
```

Do not publish `app.postdelegate.com` until the actual host exists and the first
administrator bootstrap procedure is ready. Databases, Redis and Temporal admin
surfaces stay private.

## Provider rollout

Lean mode deliberately starts with no providers. The first candidates are:

1. LinkedIn member publishing;
2. Facebook Pages;
3. one Instagram authorization route (`instagram` or `instagram-standalone`).

Do not enable both Instagram routes merely because both exist in source. Select
the route actually configured and reviewed. Threads, LinkedIn Pages, TikTok,
YouTube and Pinterest can follow. X remains blocked by the lean policy.

For every enabled provider record: OAuth success, a real post, supported media,
scheduled execution, handled failure, disconnect/reconnect and external-account
eligibility. See `platform-access.md` and `../../BETA_CHECKLIST.md`.

## Email and support

Cloudflare Email Routing has been enabled for `nasidaapps.com`, and a destination
verification message was sent to the owner's existing inbox. Do not publish a
support or privacy address as operational until the destination is verified and
an end-to-end receive test passes. Incoming forwarding is not the same thing as
authenticated outbound mail.

The product's transactional verification/reset mail must also be tested before
inviting unrelated users. Stay within a free provider allowance only while its
real account limits cover the beta; do not silently upgrade to a paid plan.

## Evidence still required before customer #1

- an approved/authorized production host and measured memory headroom;
- exact image digest and successful production preflight;
- working `app.postdelegate.com` TLS and API health;
- first-admin bootstrap followed by closed registration/invites;
- transactional email and support/privacy contact tests;
- tenant-isolation and approval tests against the deployed stack;
- real encrypted off-host backup and isolated restore drill;
- protected social token storage or another verified equivalent control;
- at least one approved social provider with real publish evidence;
- final operator/privacy/deletion wording matching what is actually deployed.

Nothing in this file treats a mock test, configured secret, source implementation
or developer-mode platform connection as production approval.
