# Untranslated backend strings

**Audit date:** 2026-08-08 · **Scope:** `apps/backend/src`, `libraries/nestjs-libraries/src`
**Owner of this file:** Phase 3 (Arabic / MENA foundation)

## Headline finding

**The backend has no i18n layer at all.** There is no equivalent of the frontend's
`useT()` / `getT()` anywhere in `apps/backend/src` — every string the API returns to a
user is a hardcoded English literal, and there is no request-scoped locale to translate
against even if there were.

Concretely, the request pipeline never reads a locale:

* the frontend sends the active language in the `i18next` cookie and, for SSR, in the
  `x-i18next-current-language` header (`headerName` in `i18n.config.ts`);
* nothing in the backend reads either. There is no interceptor, guard, middleware or
  `AsyncLocalStorage` context carrying a locale.

So an Arabic-speaking UAE customer gets an Arabic UI that surfaces English error
messages the moment anything goes wrong — a failed publish, an expired channel token, a
rejected upload, a validation error on the composer. That is the most visible remaining
i18n gap in the product.

This report is an inventory and a recommendation. Per the phase brief, **backend error
handling has not been restructured** — no exception classes were changed, no messages
were rewritten, no throw sites were touched.

## Counts

| Category | Occurrences | Where |
|---|---:|---|
| Exception / Error messages | 149 | controllers, services, provider integrations |
| `class-validator` `message:` strings | 32 | `libraries/nestjs-libraries/src/dtos/**` |
| JSON response bodies with a `message` field | 3 | newer Nashr controllers |
| **Total user-reachable English literals** | **184** | |

Of these, a small number repeat heavily, so translating the top ~15 distinct messages
covers a disproportionate share of what a user actually sees:

```
14  Unauthorized
 11  Unsupported file type.
  6  Integration not found
  6  Invalid URL
  5  Invalid integration
  4  Invalid identifier
  4  HTTP error! status: ${response.status}
  3  Integration not allowed
  3  Organization not found
  3  Board is required
  3  URL must be a public HTTPS URL and cannot point to internal network addresses
  3  Blocked IP
  3  Failed to fetch media: ${fileResponse.statusText}
  2  Registration is disabled
  2  User not found
```

## Why the repeated ones matter most

`Unauthorized` alone appears 14 times and `Unsupported file type.` 11 times. Fourteen
distinct throw sites emitting one identical string means a single translation key covers
all fourteen — the long tail of one-off provider errors is far less valuable per unit of
effort.

## Recommended approach (for a later phase — NOT implemented here)

The brief scopes this to a report plus optional keys, so the following is a proposal:

1. **Carry the locale.** Add a NestJS interceptor that reads `x-i18next-current-language`
   (falling back to the `i18next` cookie, then `Accept-Language`, then `en`), passes it
   through `resolveSupportedLanguage()` from `@gitroom/react/translation/i18n.config`, and
   stores it in an `AsyncLocalStorage` request context.
2. **Translate at the edge, not at the throw site.** Add a single global exception filter
   that maps a stable error *code* to a translation key. This keeps `throw new
   HttpException('Unauthorized', 401)` untouched at 14 call sites while still returning
   Arabic — the filter looks up the message text, not the throw site.
3. **Return a code alongside the message.** The response body should carry
   `{ code, message }`. The frontend can then translate client-side from `code` and ignore
   the server's `message` entirely, which is the most robust option and needs no backend
   locale plumbing at all. **This is the recommended path** — it is the smallest backend
   change and puts translation where the translation catalogue already lives.
4. **`class-validator` messages** are a separate problem: they are evaluated at decoration
   time, so they cannot read a request locale. They need either `i18n-class-validator` or
   a `ValidationPipe` `exceptionFactory` that maps constraint names to keys.

## Translation keys added by this phase

Keys for the highest-frequency messages have been added to
`locales/en/translation.json` and `locales/ar/translation.json` under the `backend_error_*`
prefix, with hand-written Arabic. Nothing consumes them yet — they exist so that whichever
phase implements option 3 above has a reviewed Arabic catalogue waiting rather than a
machine-translation run.

See the end of this document for the key list.

## Most repeated messages

```
14  Unauthorized
 11  Unsupported file type.
  6  Integration not found
  6  Invalid URL
  5  Invalid integration
  4  Invalid identifier
  4  HTTP error! status: ${response.status}
  3  Integration not allowed
  3  Organization not found
  3  Board is required
  3  URL must be a public HTTPS URL and cannot point to internal network addresses
  3  Blocked IP
  3  Failed to fetch media: ${fileResponse.statusText}
  2  Registration is disabled
  2  User not found
```

## Full inventory

Paths are relative to the repository root. Interpolated messages (`${...}`) are listed as
written; they need parameterised keys rather than literal ones.

```
--- exception ---
apps/backend/src/api/routes/admin.controller.ts:24	Unauthorized
apps/backend/src/api/routes/announcements.controller.ts:32	Unauthorized
apps/backend/src/api/routes/announcements.controller.ts:43	Unauthorized
apps/backend/src/api/routes/billing.controller.ts:162	Unauthorized
apps/backend/src/api/routes/billing.controller.ts:175	Unauthorized
apps/backend/src/api/routes/billing.controller.ts:187	Unauthorized
apps/backend/src/api/routes/billing.controller.ts:199	Unauthorized
apps/backend/src/api/routes/billing.controller.ts:212	Unauthorized
apps/backend/src/api/routes/billing.controller.ts:224	Unauthorized
apps/backend/src/api/routes/billing.controller.ts:261	Unauthorized
apps/backend/src/api/routes/enterprise.controller.ts:63	Organization not found
apps/backend/src/api/routes/enterprise.controller.ts:71	Integration not allowed
apps/backend/src/api/routes/integrations.controller.ts:133	Invalid body
apps/backend/src/api/routes/integrations.controller.ts:149	Invalid integration
apps/backend/src/api/routes/integrations.controller.ts:156	Invalid integration
apps/backend/src/api/routes/integrations.controller.ts:208	Integration not allowed
apps/backend/src/api/routes/integrations.controller.ts:215	Missing external url
apps/backend/src/api/routes/integrations.controller.ts:275	Invalid integration
apps/backend/src/api/routes/integrations.controller.ts:331	Invalid integration
apps/backend/src/api/routes/integrations.controller.ts:338	Invalid provider
apps/backend/src/api/routes/integrations.controller.ts:378	Function not found
apps/backend/src/api/routes/no.auth.integrations.controller.ts:55	Integration not allowed
apps/backend/src/api/routes/no.auth.integrations.controller.ts:65	Invalid state
apps/backend/src/api/routes/no.auth.integrations.controller.ts:70	Organization not found
apps/backend/src/api/routes/no.auth.integrations.controller.ts:325	Invalid state
apps/backend/src/api/routes/no.auth.integrations.controller.ts:330	Organization not found
apps/backend/src/api/routes/no.auth.integrations.controller.ts:346	Invalid token
apps/backend/src/api/routes/no.auth.integrations.controller.ts:351	Invalid token payload
apps/backend/src/api/routes/no.auth.integrations.controller.ts:359	Integration not found
apps/backend/src/api/routes/no.auth.integrations.controller.ts:365	Not a Chrome extension integration
apps/backend/src/api/routes/posts.controller.ts:156	Forbidden
apps/backend/src/api/routes/public.controller.ts:218	Upstream error: ${r.statusText}
apps/backend/src/api/routes/settings.controller.ts:57	Unauthorized
apps/backend/src/api/routes/third-party.controller.ts:75	Integration not found
apps/backend/src/api/routes/third-party.controller.ts:83	Invalid identifier
apps/backend/src/api/routes/third-party.controller.ts:108	Integration not found
apps/backend/src/api/routes/third-party.controller.ts:116	Invalid identifier
apps/backend/src/api/routes/third-party.controller.ts:137	Integration not found
apps/backend/src/api/routes/third-party.controller.ts:145	Invalid identifier
apps/backend/src/api/routes/third-party.controller.ts:154	Import not supported
apps/backend/src/api/routes/third-party.controller.ts:179	Invalid identifier
apps/backend/src/api/routes/third-party.controller.ts:184	Invalid API key
apps/backend/src/api/routes/third-party.controller.ts:204	Integration Already Exists
apps/backend/src/api/routes/users.controller.ts:57	Chatbase SSO is not configured
apps/backend/src/api/routes/users.controller.ts:88	Agent Media SSO is not configured
apps/backend/src/api/routes/users.controller.ts:154	Unauthorized
apps/backend/src/api/routes/users.controller.ts:167	Unauthorized
apps/backend/src/api/routes/users.controller.ts:194	Unauthorized
apps/backend/src/api/routes/users.controller.ts:208	Invalid user to switch to
apps/backend/src/services/auth/auth.service.ts:44	Email with plus sign is not allowed
apps/backend/src/services/auth/auth.service.ts:52	Email already exists
apps/backend/src/services/auth/auth.service.ts:56	Registration is disabled
apps/backend/src/services/auth/auth.service.ts:86	Invalid user name or password
apps/backend/src/services/auth/auth.service.ts:90	User is not activated
apps/backend/src/services/auth/auth.service.ts:147	Invalid provider token
apps/backend/src/services/auth/auth.service.ts:159	Registration is disabled
apps/backend/src/services/auth/auth.service.ts:272	User not found
apps/backend/src/services/auth/auth.service.ts:276	Account is already activated
apps/backend/src/services/auth/auth.service.ts:301	Invalid user
apps/backend/src/services/auth/providers/oauth.provider.ts:26	POSTIZ_OAUTH environment variables are not set
apps/backend/src/services/auth/providers/oauth.provider.ts:70	Token request failed: ${error}
apps/backend/src/services/auth/providers/oauth.provider.ts:88	User info request failed: ${error}
apps/backend/src/services/auth/providers/providers.manager.ts:18	Auth provider ${provider} not found
apps/backend/src/services/auth/providers/wallet.provider.ts:16	Invalid hex string. It must have an even length.
libraries/nestjs-libraries/src/3rdparties/heygen/heygen.provider.ts:174	Video generation timed out
libraries/nestjs-libraries/src/3rdparties/heygen/heygen.provider.ts:195	Video generation failed
libraries/nestjs-libraries/src/3rdparties/reelfarm/reelfarm.provider.ts:108	ReelFarm media-library provider does not support sendData
libraries/nestjs-libraries/src/chat/tools/integration.schedule.post.ts:207	Integration not found
libraries/nestjs-libraries/src/chat/tools/video.function.tool.ts:45	Function not found
libraries/nestjs-libraries/src/database/prisma/integrations/integration.service.ts:265	You have reached the maximum number of channels
libraries/nestjs-libraries/src/database/prisma/integrations/integration.service.ts:293	Integration not found
libraries/nestjs-libraries/src/database/prisma/integrations/integration.service.ts:296	Invalid request
libraries/nestjs-libraries/src/database/prisma/integrations/integration.service.ts:304	Provider does not support page selection
libraries/nestjs-libraries/src/database/prisma/integrations/integration.service.ts:341	Invalid integration
libraries/nestjs-libraries/src/database/prisma/media/media.service.ts:79	Video type ${type} not found
libraries/nestjs-libraries/src/database/prisma/media/media.service.ts:83	This video is not available in trial mode
libraries/nestjs-libraries/src/database/prisma/media/media.service.ts:105	Video type ${body.type} not found
libraries/nestjs-libraries/src/database/prisma/media/media.service.ts:109	This video is not available in trial mode
libraries/nestjs-libraries/src/database/prisma/media/media.service.ts:140	Video with identifier ${identifier} not found
libraries/nestjs-libraries/src/database/prisma/media/media.service.ts:149	Function ${functionName} not found on video instance
libraries/nestjs-libraries/src/database/prisma/oauth/oauth.service.ts:22	You can only have one OAuth application per organization
libraries/nestjs-libraries/src/database/prisma/oauth/oauth.service.ts:56	No OAuth app found
libraries/nestjs-libraries/src/database/prisma/oauth/oauth.service.ts:66	No OAuth app found
libraries/nestjs-libraries/src/database/prisma/oauth/oauth.service.ts:78	Invalid client_id
libraries/nestjs-libraries/src/database/prisma/organizations/organization.service.ts:109	The organization plan does not include team members
libraries/nestjs-libraries/src/database/prisma/organizations/organization.service.ts:119	No ${brand.name} account found for this email
libraries/nestjs-libraries/src/database/prisma/organizations/organization.service.ts:126	Multiple accounts exist for this email (different login providers)
libraries/nestjs-libraries/src/database/prisma/organizations/organization.service.ts:138	User is already a member of this organization
libraries/nestjs-libraries/src/database/prisma/organizations/organization.service.ts:152	Could not add the user to the organization
libraries/nestjs-libraries/src/database/prisma/organizations/organization.service.ts:165	User is not part of this organization
libraries/nestjs-libraries/src/database/prisma/organizations/organization.service.ts:175	You do not have permission to delete this user
libraries/nestjs-libraries/src/database/prisma/posts/posts.service.ts:254	All posts must have an integration id
libraries/nestjs-libraries/src/database/prisma/posts/posts.service.ts:268	Integration with id ${post.integration.id} not found
libraries/nestjs-libraries/src/database/prisma/posts/posts.service.ts:782	Integration with id ${post?.integration?.id} not found
libraries/nestjs-libraries/src/database/prisma/posts/posts.service.ts:988	Post not found
libraries/nestjs-libraries/src/database/prisma/posts/posts.service.ts:992	This id belongs to a comment, pass the id of the main post
libraries/nestjs-libraries/src/database/prisma/posts/posts.service.ts:998	Only scheduled posts that were not published yet (or drafts) can be updated
libraries/nestjs-libraries/src/database/prisma/posts/posts.service.ts:1007	The publish time of this post already passed, it cannot be updated
libraries/nestjs-libraries/src/database/prisma/posts/posts.service.ts:1110	Failed to update the post
libraries/nestjs-libraries/src/database/prisma/posts/posts.service.ts:1134	Post not found
libraries/nestjs-libraries/src/database/prisma/users/users.repository.ts:28	User not found
libraries/nestjs-libraries/src/dtos/webhooks/ssrf.safe.dispatcher.ts:24	Blocked IP
libraries/nestjs-libraries/src/dtos/webhooks/ssrf.safe.dispatcher.ts:36	Blocked IP
libraries/nestjs-libraries/src/dtos/webhooks/ssrf.safe.dispatcher.ts:42	Blocked IP
libraries/nestjs-libraries/src/integrations/social/bluesky.provider.ts:112	Failed to fetch video: ${videoResponse.statusText}
libraries/nestjs-libraries/src/integrations/social/facebook.provider.ts:459	Page not found in your accounts
libraries/nestjs-libraries/src/integrations/social/gmb.provider.ts:391	Location not found
libraries/nestjs-libraries/src/integrations/social/linkedin.provider.ts:265	Invalid LinkedIn company URL
libraries/nestjs-libraries/src/integrations/social/linkedin.provider.ts:918	LinkedIn answered without a media status
libraries/nestjs-libraries/src/integrations/social/mastodon.provider.ts:188	Failed to fetch media: ${fileResponse.statusText}
libraries/nestjs-libraries/src/integrations/social/mewe.provider.ts:229	Photo upload failed: ${errorText}
libraries/nestjs-libraries/src/integrations/social/mewe.provider.ts:280	Failed to create MeWe post
libraries/nestjs-libraries/src/integrations/social/skool.provider.ts:260	Failed to fetch media: ${fileResponse.statusText}
libraries/nestjs-libraries/src/integrations/social/tumblr.provider.ts:336	Tumblr blog not found
libraries/nestjs-libraries/src/integrations/social/whop.provider.ts:280	Failed to fetch media: ${fileResponse.statusText}
libraries/nestjs-libraries/src/integrations/social/whop.provider.ts:309	File upload timed out
libraries/nestjs-libraries/src/integrations/social/whop.provider.ts:327	File upload failed
libraries/nestjs-libraries/src/integrations/social/youtube.provider.ts:374	Channel not found
libraries/nestjs-libraries/src/integrations/social/youtube.provider.ts:399	Channel not found
libraries/nestjs-libraries/src/integrations/social/youtube.provider.ts:523	YouTube upload status check failed with ${probe.status}
libraries/nestjs-libraries/src/integrations/social/youtube.provider.ts:754	YouTube chunk upload failed with ${upload.status}
libraries/nestjs-libraries/src/openai/generation.error.ts:33	Your request was rejected by the AI safety system.${detail} Please adjust your prompt and try again.
libraries/nestjs-libraries/src/openai/generation.error.ts:41	AI generation failed, please try again later.
libraries/nestjs-libraries/src/services/stripe.service.ts:936	No payment customer found for this organization
libraries/nestjs-libraries/src/services/stripe.service.ts:957	No payment customer found for this organization
libraries/nestjs-libraries/src/services/stripe.service.ts:970	No active subscription found
libraries/nestjs-libraries/src/services/stripe.service.ts:1304	You already have a non lifetime subscription
libraries/nestjs-libraries/src/short-linking/providers/kutt.ts:28	HTTP error! status: ${response.status}
libraries/nestjs-libraries/src/short-linking/providers/kutt.ts:62	HTTP error! status: ${response.status}
libraries/nestjs-libraries/src/short-linking/providers/kutt.ts:68	Failed to create short link: ${error}
libraries/nestjs-libraries/src/short-linking/providers/kutt.ts:82	HTTP error! status: ${response.status}
libraries/nestjs-libraries/src/short-linking/providers/kutt.ts:88	Failed to get original link: ${error}
libraries/nestjs-libraries/src/short-linking/providers/kutt.ts:103	HTTP error! status: ${response.status}
libraries/nestjs-libraries/src/short-linking/providers/linkdrip.ts:34	Failed to create LinkDrip API short link with status: ${response.status}
libraries/nestjs-libraries/src/short-linking/providers/linkdrip.ts:42	Failed to create LinkDrip short link: ${error}
libraries/nestjs-libraries/src/upload/cloudflare.storage.ts:88	Unsafe URL
libraries/nestjs-libraries/src/upload/cloudflare.storage.ts:98	Unsupported file type.
libraries/nestjs-libraries/src/upload/cloudflare.storage.ts:122	Unsupported file type.
libraries/nestjs-libraries/src/upload/custom.upload.validation.ts:33	Invalid file upload.
libraries/nestjs-libraries/src/upload/custom.upload.validation.ts:38	Unsupported file type.
libraries/nestjs-libraries/src/upload/custom.upload.validation.ts:43	File size exceeds the maximum allowed size of ${maxSize} bytes.
libraries/nestjs-libraries/src/upload/custom.upload.validation.ts:66	Unsupported file type.
libraries/nestjs-libraries/src/upload/local.storage.ts:34	Unsafe URL
libraries/nestjs-libraries/src/upload/local.storage.ts:50	Unsupported file type.
libraries/nestjs-libraries/src/upload/local.storage.ts:80	Unsupported file type.
libraries/nestjs-libraries/src/upload/r2.uploader.ts:89	Unsupported file type.
libraries/nestjs-libraries/src/upload/upload.factory.ts:22	Invalid storage type ${storageProvider}
libraries/nestjs-libraries/src/videos/veo3/veo3.ts:71	Video generation timed out
libraries/nestjs-libraries/src/videos/veo3/veo3.ts:107	Video generation succeeded but no video URL returned

--- validator ---
apps/backend/src/api/routes/monitor.controller.ts:11	Queue ${name} is healthy.
apps/backend/src/api/routes/nashr-agents.controller.ts:90	AI is not configured for this deployment.
apps/backend/src/api/routes/nashr-agents.controller.ts:183	Sign in to approve.
apps/backend/src/api/routes/nashr-agents.controller.ts:191	That proposal was not found.
apps/backend/src/api/routes/nashr-agents.controller.ts:199	That proposal has already been decided or has expired.
apps/backend/src/api/routes/nashr-agents.controller.ts:209	That proposal has expired.
apps/backend/src/api/routes/nashr-agents.controller.ts:219	The action changed since it was proposed. Ask for a new proposal.
apps/backend/src/api/routes/nashr-approval.controller.ts:77	No active membership in this organization
apps/backend/src/services/auth/permissions/nashr.role.exception.ts:24	Your role (${message.role}) is not allowed to ${message.action} ${message.resource}.
libraries/nestjs-libraries/src/dtos/auth/forgot-return.password.dto.ts:19	Passwords do not match
libraries/nestjs-libraries/src/dtos/autopost/autopost.dto.ts:43	Autopost URL must be a public HTTPS URL and cannot point to internal network addresses
libraries/nestjs-libraries/src/dtos/integrations/api.key.dto.ts:6	Must be at least 4 characters
libraries/nestjs-libraries/src/dtos/media/upload.dto.ts:10	URL must be a public HTTPS URL and cannot point to internal network addresses
libraries/nestjs-libraries/src/dtos/posts/providers-settings/dev.to.settings.dto.ts:33	Invalid URL
libraries/nestjs-libraries/src/dtos/posts/providers-settings/dribbble.dto.ts:13	Title is required
libraries/nestjs-libraries/src/dtos/posts/providers-settings/hashnode.settings.dto.ts:45	Invalid URL
libraries/nestjs-libraries/src/dtos/posts/providers-settings/medium.settings.dto.ts:39	Invalid URL
libraries/nestjs-libraries/src/dtos/posts/providers-settings/pinterest.dto.ts:22	Board is required
libraries/nestjs-libraries/src/dtos/posts/providers-settings/pinterest.dto.ts:25	Board is required
libraries/nestjs-libraries/src/dtos/posts/providers-settings/pinterest.dto.ts:28	Board is required
libraries/nestjs-libraries/src/dtos/posts/providers-settings/reddit.dto.ts:53	Invalid URL
libraries/nestjs-libraries/src/dtos/posts/providers-settings/tumblr.dto.ts:24	Invalid URL
libraries/nestjs-libraries/src/dtos/posts/providers-settings/tumblr.dto.ts:32	Invalid URL
libraries/nestjs-libraries/src/dtos/posts/providers-settings/x.dto.ts:18	Invalid X community URL. It should be in the format: https://x.com/i/communities/1493446837214187523
libraries/nestjs-libraries/src/dtos/posts/providers-settings/x.dto.ts:42	Article title is required
libraries/nestjs-libraries/src/dtos/third-party/import-media.dto.ts:14	URL must be a public HTTPS URL and cannot point to internal network addresses
libraries/nestjs-libraries/src/dtos/webhooks/webhooks.dto.ts:22	Webhook URL must be a public HTTPS URL and cannot point to internal network addresses
libraries/nestjs-libraries/src/dtos/webhooks/webhooks.dto.ts:37	URL must be a public HTTPS URL and cannot point to internal network addresses
libraries/nestjs-libraries/src/dtos/webhooks/webhooks.dto.ts:56	Webhook URL must be a public HTTPS URL and cannot point to internal network addresses
libraries/nestjs-libraries/src/upload/r2.uploader.ts:112	Unsupported file type.
libraries/nestjs-libraries/src/upload/r2.uploader.ts:206	Unsupported file type.
libraries/nestjs-libraries/src/upload/r2.uploader.ts:231	File contents do not match declared type.

--- http_body ---
libraries/nestjs-libraries/src/upload/r2.uploader.ts:112	Unsupported file type.
libraries/nestjs-libraries/src/upload/r2.uploader.ts:206	Unsupported file type.
libraries/nestjs-libraries/src/upload/r2.uploader.ts:231	File contents do not match declared type.
```

## Keys added (hand-written Arabic, not machine-translated)

| key | en | ar |
|---|---|---|
| `backend_error_unauthorized` | Unauthorized | غير مصرّح لك بهذا الإجراء |
| `backend_error_forbidden` | Forbidden | ليست لديك صلاحية الوصول |
| `backend_error_unsupported_file_type` | Unsupported file type. | نوع الملف غير مدعوم. |
| `backend_error_file_type_mismatch` | File contents do not match declared type. | محتوى الملف لا يطابق النوع المعلن. |
| `backend_error_integration_not_found` | Integration not found | لم يتم العثور على القناة |
| `backend_error_integration_invalid` | Invalid integration | القناة غير صالحة |
| `backend_error_integration_not_allowed` | Integration not allowed | هذه القناة غير مسموح بها |
| `backend_error_integration_exists` | Integration Already Exists | القناة مضافة بالفعل |
| `backend_error_invalid_url` | Invalid URL | الرابط غير صالح |
| `backend_error_invalid_identifier` | Invalid identifier | المعرّف غير صالح |
| `backend_error_invalid_token` | Invalid token | الرمز غير صالح |
| `backend_error_organization_not_found` | Organization not found | لم يتم العثور على المؤسسة |
| `backend_error_user_not_found` | User not found | لم يتم العثور على المستخدم |
| `backend_error_post_not_found` | Post not found | لم يتم العثور على المنشور |
| `backend_error_registration_disabled` | Registration is disabled | التسجيل معطّل حاليًا |
| `backend_error_passwords_do_not_match` | Passwords do not match | كلمتا المرور غير متطابقتين |
| `backend_error_title_required` | Title is required | العنوان مطلوب |
| `backend_error_board_required` | Board is required | اختيار اللوحة مطلوب |
| `backend_error_min_length_4` | Must be at least 4 characters | يجب ألا يقل عن 4 أحرف |
| `backend_error_url_must_be_public_https` | URL must be a public HTTPS URL and cannot point to internal network addresses | يجب أن يكون الرابط عنوان HTTPS عامًا، ولا يجوز أن يشير إلى عناوين شبكة داخلية |
| `backend_error_update_post_failed` | Failed to update the post | تعذّر تحديث المنشور |
| `backend_error_generic` | Something went wrong. Please try again. | حدث خطأ ما. يُرجى المحاولة مرة أخرى. |
