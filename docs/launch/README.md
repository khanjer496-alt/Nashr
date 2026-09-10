# PostDelegate launch execution

Updated: **10 September 2026**. Product: **PostDelegate**. Repository and internal
`nashr-*` identifiers intentionally remain unchanged. This is a global product;
Arabic and regional capabilities are optional, not the definition of the market.

This document supersedes the platform setup and launch sequencing in the older
Nashr/MENA checklists. It does not erase their engineering evidence or waive
their security, isolation, approval or restore requirements.

## Current verified position

| Item | Evidence / status |
|---|---|
| Rebrand baseline | `c53f035602ece610667aa0ca659ccad69b312a0b` on main before this launch work |
| Corresponding-source repository | `khanjer496-alt/Nashr` is public; the deployed image must offer its exact commit |
| Production topology | Existing approved Docker origin + Cloudflare edge + R2; no Workers-only rewrite |
| Operating entity | Nasida Apps LLC is formed in Wyoming; EIN, banking/payment eligibility and final commercial/legal commitments are separate gates |
| Developer applications | No console application IDs, submissions or approval evidence verified in this work |
| Public website | `https://postdelegate.com` is the verified Cloudflare Pages public preview. `www` redirects to the apex. See [public-site deployment](public-site.md). |
| App runtime and domain | `app.postdelegate.com` is the chosen full-app origin but no stateful production runtime is verified there yet |
| Hosting credentials | No configured local `hcloud` context; no repository-level Actions secrets/variables returned by the checks. This is not an inventory of other accounts or environments. |
| Public review pages | Support and deletion-process information included in the reproducible public-site export. Private request contacts and legal policies remain unfinished; these are not yet acceptable evidence of operational handling. |
| R2 | Existing `nashr-production-media` and `nashr-production-backups` buckets verified; no replacement buckets created |
| Production build workflow | New manual, opt-in `PostDelegate Launch Preparation` workflow uses `Dockerfile.prod` and our GHCR namespace; not run as a production build |
| Launch tooling | Source-derived scope/callback manifest, public-build configuration guard, read-only public smoke checker, dependency-free tests |
| Lean beta profile | [Lean beta](lean-beta.md) removes optional AI/designer/X/billing spend while retaining the existing publishing architecture and fail-closed provider rollout |

**Prepared is not submitted. Built is not deployed. Configured is not approved.
No customer publishing access is certified by this document.**

## Inputs the owner must confirm

| Input | Why it is needed | Safe handoff |
|---|---|---|
| Monitored support and privacy addresses | Reviewer contact, account support and deletion requests | Create and test mailboxes/routing under the owned domain |
| Docker host/provider, region and approved spend | Stateful app, PostgreSQL, Redis and Temporal | Use an existing authorized host or approve a specific new purchase before provisioning |
| Final governing/refund/retention terms | Terms/privacy and deletion handling must match actual Nasida Apps LLC operations | Confirm commitments; do not remove draft notices just to pass review |
| Platform developer-account owners | Create and submit apps, business/Page verification, required owner consent | Owner signs in and completes MFA/identity steps; app secrets go directly to server secret storage |

Do not put passwords, OAuth client secrets, SSH keys, R2 keys or reviewer
credentials in this public repository, issue comments, videos or screenshots.

## Execution order

### 1. Prepare the review deployment

Keep the approved deployment topology from [DEPLOYMENT.md](../../DEPLOYMENT.md).
For the first low-cost beta, apply the [lean beta profile](lean-beta.md): build in
CI, run one production host, and use isolated staging on demand rather than paying
for a permanent second server. This reduces optional spend, not safety controls.
Use separate production/staging secrets, databases, buckets and volumes. The
current image workflow targets **linux/amd64**; choose a matching host or add and
test an ARM64 build before ordering an ARM host. Do not purchase infrastructure
without an agreed budget.

Use the existing capacity guidance as a starting point: a 16 GB Docker host is
the repository recommendation, not a benchmark of this deployment. Build images
in CI rather than competing with a live database for memory.

Keep a review/test workspace isolated. Establish the first administrator behind
restricted ingress, not an open first-user-wins registration race. Then close
self-registration (`DISABLE_REGISTRATION=true`) and provide designated reviewer
access. Do not disable CSRF/SSRF protections to make reviews pass. Cloudflare
rules must allow the intended OAuth returns and public policy pages.

R2 media needs an owned HTTPS custom hostname. Keep database backups in a
**separate private bucket**; never expose backups through the public media host.
TikTok URL-pull verification, when used, applies to the actual media hostname or
prefix, not only the app homepage.

### 2. Complete the public review surfaces

The app origin can serve the website and product for the first review; a second
marketing deployment is not required by this architecture. These routes must
work in a signed-out browser:

| Route | Purpose |
|---|---|
| `/` | Accurate product identity and demonstrated capabilities |
| `/terms` | Approved operator identity, terms and governing law |
| `/privacy` | Actual data uses, sharing, processors, retention, rights and verified security controls |
| `/support` | Monitored support contact |
| `/data-deletion` | Manual deletion-request instructions; **not** a callback API |
| `/licenses` | Exact deployed source and preserved upstream attribution |

**Legal blocker:** `PlaceholderNotice` is unconditional in the current legal
pages. Setting company environment variables does not remove the draft notices.
Retention, refund/tax terms, processor details, Google/YouTube-specific disclosures
and actual token protections still need a substantive operator/legal review.
Remove the notices only when the copy is genuinely finalized, not to fool a check.
The unsupported assertion that connected-channel tokens are already encrypted
has been replaced with an explicit verification requirement in the privacy draft.

The deletion page is a contact route, not an implemented deletion worker. Before
submission, test receiving a request, verifying identity/authority, processing
the agreed scope (including stored tokens/media and backup retention), recording
the outcome and replying. Where a platform requires a signed server callback,
implement and test it; do not register this static page as that callback.

### 3. Register apps and produce truthful review evidence

Follow [the platform application pack](platform-access.md). Register developer
apps once owner access is available; submit a review only after the requested
flows can be demonstrated. Use our own app credentials, not upstream Postiz's.

Start the Meta family and TikTok review work early, and prepare LinkedIn and
Google/YouTube in parallel. Select the initial supported subset based on actual
approvals and real publishing evidence. A provider implemented in the fork is
not automatically an approved integration for a commercial SaaS.

### 4. Build and rehearse, then deploy

Create and protect the GitHub environment **`postdelegate-production`**. Required
reviewers/protection are an owner setup step, not automatically supplied by the
workflow. Set these **non-secret public variables** in that environment:

| Actions variable | Build-time value |
|---|---|
| `POSTDELEGATE_APP_URL` | Exact HTTPS app origin, **without trailing slash** |
| `POSTDELEGATE_LEGAL_NAME` | Confirmed operator/entity display name |
| `POSTDELEGATE_JURISDICTION` | Confirmed jurisdiction |
| `POSTDELEGATE_GOVERNING_LAW` | Reviewed governing-law wording |
| `POSTDELEGATE_SUPPORT_EMAIL` | Monitored support address |
| `POSTDELEGATE_PRIVACY_EMAIL` | Monitored privacy address |

The workflow derives the backend URL, exact source commit and unique image tag.
`STORAGE_PROVIDER=cloudflare` is baked into the image. Changing hostname, public
brand/contact values or storage mode requires a rebuild. Optional frontend
analytics/error-monitoring build arguments are not configured by this workflow.

The new workflow is available for manual dispatch after merge to the default
branch. Running it with `build_image=false` only validates and exports the
manifest. `build_image=true` also builds/pushes a production image after the
configuration guard passes. It **does not SSH, create a server, change DNS,
submit a platform application or deploy production**.

Do not use the inherited `Build Containers` workflow: it still builds
`Dockerfile.dev` and targets `ghcr.io/gitroomhq/postiz-app`. Do not push a release
tag just to trigger that inherited workflow. The new workflow does not use a
floating `latest` tag and records the resulting digest.

On the authorized host, securely prepare the existing `.env.prod` (mode 0600),
with matching app hostname, runtime OAuth credentials and R2/email configuration.
Keep `NASHR_IMAGE`, `NASHR_IMAGE_TAG` and other internal names as-is. Use the new
image reference from the successful build summary. Restrict registry tag writes
and record/verify the digest before promoting it.

Run the existing production preflight, migrations and health checks from the
deployment runbook. Prove a backup and restore on isolated staging before
accepting customer data. Rehearse rollback without destructive database commands.
Use `node ops/scripts/platform-access.mjs smoke "$APP_ORIGIN"` for additional
unauthenticated review-page checks; a passing result is not an OAuth or security audit.

### 5. Controlled beta, then paid launch

For each enabled provider, record a successful real publish, supported media,
scheduled execution/timezone, handled failure, reconnect/revocation and approval
enforcement. Use owner-authorized test content/accounts, not unapproved customer
posts. Confirm tenant isolation and that API/MCP callers cannot bypass approvals.
Credentials alone must not be treated as rollout approval; test provider
visibility and gate any unapproved shared-credential routes before inviting users.

Keep paid signup and claims of platform availability off until the deployed
features, supported account types, privacy/deletion process, support and billing
terms match reality. Billing setup is separate from social developer access.

## Commands that work without app dependencies

```bash
node --test tests/ops/platform-access.test.mjs
node ops/scripts/platform-access.mjs manifest
# With the confirmed app hostname, produce console-ready callback URLs:
node ops/scripts/platform-access.mjs manifest "$APP_ORIGIN"
# Validates public build configuration, without printing environment values:
node ops/scripts/platform-access.mjs check-build
# Read-only GETs against the owner-approved deployed origin:
node ops/scripts/platform-access.mjs smoke "$APP_ORIGIN"
```

The tools do not submit apps, buy services, publish posts, log into consoles or
claim approval. The manifest is generated from the checked-out provider source,
not maintained as a second hand-edited list. CI exports it as an artifact.

## Evidence still required

| Gate | Evidence to record privately where necessary |
|---|---|
| Domain/identity | Owned hostname, valid TLS, approved legal copy and monitored email |
| Deployment | Image digest + source SHA, host health, migration result, staging rehearsal |
| Data protection | Token storage verification, tenant tests, deletion drill, restore drill, off-host alert |
| Platform review | App ID, requested products/scopes, actual submission date, response/status, approved scopes |
| Publishing | Per-provider test post URL/ID, media/schedule/reconnect/failure and approval-gate results |
| Beta | Explicit supported platforms/limitations, operator sign-off, controlled invite cohort |

No row is closed by a plan, a mock test, a video script or an empty checklist.
