# PostDelegate platform application pack

Prepared **9 September 2026**. This is application preparation, not a record of
submitted or approved applications. Provider code inspected at baseline
`c53f035602ece610667aa0ca659ccad69b312a0b`.

## Shared application fields

**App name:** PostDelegate

**Category:** Social media publishing and management (choose the closest actual
category offered in the console).

**Draft product description — submit only after the described flow works:**

> PostDelegate is a social publishing platform for creators, businesses and
> teams. Users connect accounts they own or are authorized to manage, prepare
> original content, select destinations and publish or schedule approved posts.
> Team permissions and approval workflows control who can publish. The web app
> and authenticated API/MCP interfaces use the same publishing backend. Optional
> AI assistance helps prepare content; platform authorization and required user
> choices remain with the account owner. Users can disconnect accounts and
> request deletion of their service data.

Do not claim that unfinished CLI functionality is live. Do not conceal API/MCP
or AI use, claim a partnership, promise unavailable analytics or say that an
agent can bypass platform consent. Explain the actual approved workflow for
each platform; a general description does not satisfy platform-specific rules.

**Owner/company:** the confirmed real operator, not the product name used as a
fictional legal company. **Website:** the owned public app/website origin.
**Privacy:** `/privacy`. **Terms:** `/terms`. **Support:** `/support`.
**Deletion instructions:** `/data-deletion` only in a field that accepts
instructions. It is not a signed POST callback.

Use the same product name, company details, logo and owned domain in every
console, website page and recording. Reviewer credentials belong in private
review fields or a password manager, never this repository.

## Exact callback and credential inventory

Set `APP_ORIGIN` to the confirmed HTTPS app origin, without a trailing slash.
Generate the **actual current scopes and complete callback URLs** with:

```bash
node ops/scripts/platform-access.mjs manifest "$APP_ORIGIN"
```

| Product/route ID | Callback suffix | Server-side credential names |
|---|---|---|
| Facebook Pages | `/integrations/social/facebook` | `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET` |
| Instagram through Facebook | `/integrations/social/instagram` | **`FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET`** |
| Instagram Login (standalone) | `/integrations/social/instagram-standalone` | `INSTAGRAM_APP_ID`, `INSTAGRAM_APP_SECRET` |
| Threads | `/integrations/social/threads` | `THREADS_APP_ID`, `THREADS_APP_SECRET` |
| TikTok | `/integrations/social/tiktok` | `TIKTOK_CLIENT_ID`, `TIKTOK_CLIENT_SECRET` |
| LinkedIn member | `/integrations/social/linkedin` | `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET` |
| LinkedIn Page | `/integrations/social/linkedin-page` | Same LinkedIn pair |
| YouTube | `/integrations/social/youtube` | `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET` |
| X | `/integrations/social/x` | `X_API_KEY`, `X_API_SECRET`; **OAuth 1.0a user context** |
| Pinterest | `/integrations/social/pinterest` | `PINTEREST_CLIENT_ID`, `PINTEREST_CLIENT_SECRET` |

These are publishing authorization routes, not the SaaS sign-in callback.
Register exact HTTPS URLs, not localhost, a temporary preview hostname or the
development `redirectmeto.com` wrapper. Never put social secrets in
`NEXT_PUBLIC_*` values. Keep staging and production credentials separate where
the platform permits it, and document any unavoidable app-sharing explicitly.

## Important mismatch between the old guide and the code

The current providers request **more than basic publishing scopes**, and their
authentication code checks the declared scope set. Submitting only a minimal
guide's permissions can therefore leave connection broken even after approval.

| Provider | Actual additional scope surface to review |
|---|---|
| Facebook | `business_management`, `pages_manage_engagement`, `read_insights`, alongside Page discovery/posting/read-engagement |
| Instagram via Facebook | `instagram_manage_comments`, `instagram_manage_insights`, business/Page access, plus basic/publishing |
| Instagram standalone | `instagram_business_basic`, `instagram_business_content_publish`, `instagram_business_manage_comments`, `instagram_business_manage_insights` |
| Threads | `threads_manage_replies`, `threads_manage_insights`, plus basic/publishing |
| TikTok | `video.list`, `user.info.basic`, `video.publish`, `video.upload`, `user.info.profile`, `user.info.stats` |
| LinkedIn **member and Page** | `openid`, `profile`, `w_member_social`, `r_basicprofile`, `rw_organization_admin`, `w_organization_social`, `r_organization_social` |
| YouTube | `userinfo.profile`, `userinfo.email`, `youtube`, `youtube.force-ssl`, `youtube.readonly`, `youtube.upload`, **`youtubepartner`**, `yt-analytics.readonly`; all are full Google scope URLs in the manifest |
| Pinterest | `boards:read`, `boards:write`, `pins:read`, `pins:write`, `user_accounts:read` |

Before submission, either demonstrate and justify every permission legitimately
needed, or reduce the provider's requested scopes **and** gate/test every feature
that depends on removed access. Do not request broad access merely because the
fork contains it. In particular, do not advertise LinkedIn self-serve member
onboarding as ready while the member provider still requests organization
permissions. YouTube partner access needs explicit justification or removal with
regression tests; it is not required simply to upload a video.

## Platform submission tracks

### Meta: Facebook Pages, Instagram and Threads

Register the appropriate current use cases in the operator's Meta developer
account. Prepare owned/test accounts and any business verification the dashboard
requires. Instagram professional-account eligibility differs from a personal
account; this code supports both Facebook-connected and standalone Instagram
authorization, so pick the intended route deliberately.

For each permission, show the corresponding action in the live review app:
account authorization, managed account selection, content creation, publishing,
and any requested insights/comment/reply workflow. Include privacy and deletion
instructions, reviewer access and an explanation of stored data. Development
access is not evidence of approval for unrelated customer accounts.

Threads uses its own credential pair in this code. Follow the current Threads
use-case setup rather than treating Instagram credentials as interchangeable.

Sources: [Instagram overview](https://developers.facebook.com/documentation/instagram-platform/overview),
[Instagram review](https://developers.facebook.com/documentation/instagram-platform/app-review),
[Pages getting started](https://developers.facebook.com/documentation/pages-api/getting-started),
[Threads setup](https://developers.facebook.com/documentation/threads/get-started),
[permissions reference](https://developers.facebook.com/docs/permissions/),
[data-deletion callback contract](https://developers.facebook.com/documentation/development/create-an-app/app-dashboard/data-deletion-callback).

### TikTok: Login Kit, Content Posting API and Direct Post audit

App/scope approval and the Direct Post audit are separate gates. Unaudited Direct
Post clients are restricted to private visibility; this is not the same as the
UPLOAD flow that hands content to the user's TikTok inbox.

Record original-content creation, the authorized creator identity and preview,
explicit user-controlled privacy and interactions, music/commercial disclosures
and consent. Check the latest creator-info limits. Audit API/MCP publishing too:
required user choices must not be bypassed. Do not preset the privacy selection
or add PostDelegate promotional watermarks. For URL-pulled media, verify the
actual owned media domain/prefix. Show status/failure handling rather than
claiming completion before confirmation. The current fork's UI has **not** been
certified against these requirements in this work.

Sources: [Content Posting setup](https://developers.tiktok.com/doc/content-posting-api-get-started),
[Direct Post reference](https://developers.tiktok.com/doc/content-posting-api-reference-direct-post),
[content-sharing guidelines, updated 4 August 2026](https://developers.tiktok.com/docs/en/content-sharing-guidelines).

### LinkedIn: member publishing versus organization management

Create the app under an operator-controlled LinkedIn Company Page and complete
the required verification. Share on LinkedIn provides `w_member_social` for
member publishing. Community Management is a separate access track for the
organization-management use case; development access is not production Standard
access. Prepare the required application, review recording and test access.

**Code blocker:** both member and Page providers currently request organization
scopes. Scope minimization and feature gating need testing before a member-only
self-serve launch. Do not assume approval is automatic or guarantee a review time.

Sources: [Share on LinkedIn](https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/share-on-linkedin),
[Community Management review](https://learn.microsoft.com/en-us/linkedin/marketing/community-management-app-review?view=li-lms-2026-08).

### Google / YouTube: OAuth verification and upload audit

Create the operator's Cloud project and web OAuth client; enable the APIs needed
for the actual requested features. Verify the owned domains, configure app
branding and submit applicable sensitive-scope verification with an accurate
public privacy policy and feature recording.

Separately, YouTube restricts uploads from unverified API projects created after
28 July 2020 to private visibility until the project passes its compliance
audit. OAuth verification alone is not proof that public uploads are permitted.
Review the broad and partner scopes currently requested before submission.
Update privacy/terms with the actual Google/YouTube data handling and required
policy disclosures rather than relying on the generic draft.

Sources: [OAuth brand verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/brand-verification),
[sensitive-scope verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification),
[YouTube upload restrictions and accepted scopes](https://developers.google.com/youtube/v3/docs/videos/insert).

### X: developer app and usage budget

Use PostDelegate's own developer app with OAuth 1.0a Read and Write permissions,
matching the current provider. Confirm endpoint entitlements and billing in the
account before enabling it. Current documentation describes credit-based
pay-per-use pricing; do not use the historical free/Basic/Pro-tier statements in
the old deployment guide. Set an owner-approved spending limit before paid tests.

Source: [X API pricing](https://docs.x.com/x-api/getting-started/pricing).

### Pinterest: trial then Standard access

Use the relevant business/developer account, register the app and exercise the
trial flow. Prepare a recording of real OAuth and Pin/board actions for the
Standard-access request. Trial access is not a general commercial customer
rollout. Keep the scopes consistent with the tested app capabilities.

Sources: [access tiers](https://developers.pinterest.com/docs/key-concepts/access-tiers/),
[connect an app](https://developers.pinterest.com/docs/getting-started/connect-app/).

Google Business Profile and other optional providers are a separate follow-on
track, not certified by this ten-route inventory. Recheck their current official
access requirements before promising support. No Snapchat integration is added
by this launch-preparation work.

## Review recording script

Use a real test deployment and owner-authorized test content. Do not fabricate
the final platform screen or publish result. Keep credentials out of recordings.

1. Open the public website, show PostDelegate identity and the policies/contact.
2. Sign into the designated review workspace; show its purpose and user roles.
3. Connect the target account through the actual provider authorization screen;
   identify each permission and its corresponding tested feature.
4. Prepare original content, choose the account and required platform settings,
   preview it and complete any approval step. Show user control, including for AI-assisted content.
5. Publish the authorized test content; show the real resulting post and status.
   Separately demonstrate scheduling, failure handling and reconnect where required.
6. Show disconnect/revocation and the verified data-deletion request process.
   Supply private reviewer instructions so the same flow can be reproduced.

Platform-specific instructions take precedence over this generic recording
outline. Never claim a checkbox/scope works if it is absent from the recording
and deployed build.

## Submission tracker

Record actual console evidence in a private operational tracker. App IDs are
not secrets, but access tokens, reviewer credentials and identity documents are.

| Track | App ID | Submitted at | Approved products/scopes | Real publish evidence | Current evidence |
|---|---|---|---|---|---|
| Meta Facebook / Instagram via Facebook | — | — | — | — | Not verified |
| Instagram standalone | — | — | — | — | Not verified |
| Threads | — | — | — | — | Not verified |
| TikTok app / Direct Post audit | — | — | — | — | Not verified |
| LinkedIn member / Community Management | — | — | — | — | Not verified |
| Google OAuth / YouTube audit | — | — | — | — | Not verified |
| X developer entitlement / budget | — | — | — | — | Not verified |
| Pinterest Standard | — | — | — | — | Not verified |

The empty fields are intentional. This work did not submit applications, obtain
approvals, incur API charges or publish social posts.
