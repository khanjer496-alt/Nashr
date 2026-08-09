# ADMIN_GUIDE.md — Nashr (نشر)

**Phase 8 deliverable.** For whoever operates the Nashr platform — the person
who onboards customers, watches the system, and answers the phone when
something breaks.

This is the **product administration** guide. For infrastructure incidents —
"the site is down", "nothing is publishing", "the disk is full" — go straight to
[`OPERATIONS_RUNBOOK.md`](OPERATIONS_RUNBOOK.md). For deploying and upgrading,
[`DEPLOYMENT.md`](DEPLOYMENT.md).

> **Scope honesty.** Nashr has never been deployed. Everything below is derived
> from the source and from the deployment documentation, not from operating a
> live instance. Expect to correct this guide during the first month, and
> please do — an admin guide that was never edited after first contact is a
> guide nobody used.

---

## 1. Your first hour after the first deploy

Do these in order. The first two are time-critical.

### 1.1 Claim the super-admin account — immediately

**The first user to register becomes the super-admin.** There is no other
mechanism. Register your own account the moment the stack is up and the domain
resolves — **before** the DNS record is public knowledge.

### 1.2 Close registration

```bash
# in .env.prod
DISABLE_REGISTRATION="true"
```
then restart the app. For a closed beta of 5–10 businesses, self-registration
should be off. You invite people instead (§3).

> **Careful with flags.** Upstream reads some environment flags for *truthiness*
> and others with `=== 'true'`. For a truthiness-tested flag, setting it to
> `false` **turns it on**, because the string `"false"` is truthy in JavaScript.
> `DISABLE_REGISTRATION` is `=== 'true'`, so `"true"` is correct here — but
> `NOT_SECURED`, `DISALLOW_PLUS`, `DISABLE_IMAGE_COMPRESSION` and `RUN_CRON` are
> truthiness-tested and must be **deleted entirely**, not set to `false`. Full
> table in [`SECURITY_CHECKLIST.md`](SECURITY_CHECKLIST.md) §2.

### 1.3 Prove the backup works, today

```bash
sudo systemctl start nashr-backup.service
sudo ./ops/scripts/restore-drill.sh
```

Then write the result into the drill log at `BACKUP_AND_RECOVERY.md` §6.3. **An
empty drill log means the backups are unproven**, which for this purpose is the
same as having none.

### 1.4 Verify the source-code offer is live

This is a licence obligation, not housekeeping:

```bash
curl -sS https://<your-domain>/licenses | grep -o 'https://github.com/[^"<]*' | sort -u
```

It must show **your** public mirror. If it shows `gitroomhq/postiz-app`, the
build did not receive `NEXT_PUBLIC_SOURCE_URL` as a build argument and you are
not compliant. See [`OPEN_SOURCE_COMPLIANCE.md`](OPEN_SOURCE_COMPLIANCE.md) §3.

### 1.5 Run the launch gate

Work through [`SECURITY_CHECKLIST.md`](SECURITY_CHECKLIST.md) §0 and fill in the
sign-off table in §12. Sign-off means the evidence column is filled in.

---

## 2. What a super-admin can actually do

Verified from `apps/backend/src/api/routes/admin.controller.ts` and
`auth.middleware.ts`:

| Capability | Where | Notes |
|---|---|---|
| View platform-wide **publishing errors** | `/admin/errors` | Filter by platform, by customer email, unknown-first. **This is your single most useful screen.** |
| View platform **statistics** | `/admin/stats` | Registrations, activity |
| **Impersonate** a user | `impersonate` cookie/header, super-admin only | Support tool. See §2.1 |

Everything else — creating posts, connecting channels, approving — happens
inside a customer's own workspace with their own roles.

### 2.1 Impersonation — use it carefully

A super-admin can act as any user. It is genuinely useful for "it doesn't work
on my screen" support calls, and it is also the single most invasive thing you
can do in this product.

House rules, which you should adopt on day one:

- **Ask first.** Get the customer's permission, in writing (a WhatsApp message
  is fine), before impersonating.
- **Never publish while impersonating.** Diagnose, then tell them what to click.
  A post published under their name that they did not approve destroys the exact
  trust the approval workflow is meant to build.
- **Say when you are done.**

There is no separate impersonation audit log. Keep your own record.

---

## 3. Onboarding a new customer

### 3.1 Before they sign anything

Send them [`CUSTOMER_ONBOARDING_GUIDE.md`](CUSTOMER_ONBOARDING_GUIDE.md) and get
written acknowledgement of the three disclosures. This is a requirement, not a
courtesy — see [`BETA_CHECKLIST.md`](BETA_CHECKLIST.md) §4:

1. **Snapchat is not supported.**
2. **The Arabic interface is machine-translated and under native review.**
3. **This is a beta**, with whatever that means for pricing and stability in
   your agreement.

### 3.2 Create their workspace

1. Invite the customer's owner-user by email from the admin UI (registration is
   closed, so invitation is the only route).
2. They create their organization.
3. For an agency: create one `Customer` record per client brand.
4. Assign roles (§4).
5. Set their **timezone** before they schedule anything. Default is
   `Asia/Dubai`. Getting this wrong after posts are scheduled is confusing to
   unpick.

### 3.3 Start the platform approvals on day one

This is the long pole and it is not in your control. From
[`DEPLOYMENT.md`](DEPLOYMENT.md) §7, in the order you should start them:

| Platform | Lead time | Watch out for |
|---|---|---|
| Meta (Instagram + Facebook) | 1–3 weeks | Instagram needs a **Business or Creator** account linked to a Page. Personal accounts cannot be published to. |
| TikTok | audit review | Until it passes, posts land as **private drafts** in the customer's account — which looks like a bug to them if you have not warned them |
| Google Business Profile | weeks | Quota access is **not** granted by default and must be requested |
| YouTube | verification | Unverified apps are capped at 100 users and show a warning screen |
| X | — | **Requires a paid X API tier to post at all** |
| LinkedIn | fast | Needs a Company Page you control |

Tell the customer these dates up front. "Instagram will take two to three weeks"
on day one is a fact; the same sentence in week three is an excuse.

### 3.4 Set expectations about approval

Walk them through the flow with a real post before they need it. The one thing
they must understand: **nothing publishes without an approval record**, and that
rule is enforced at the publishing step, not in the buttons — so it holds even
via the API.

Also confirm with them explicitly:

- `autonomousPublishing` is **off** (default `false`). Leave it off.
- `clientApprovalRequired` is **on** (default `true`). Turn it off only if the
  customer genuinely has no external client to approve.

---

## 4. Roles — who should get what

| Role | Give it to | Do not give it to |
|---|---|---|
| `OWNER` | The business owner. One per organization. | Anyone else |
| `ADMIN` | Marketing manager | Freelancers |
| `EDITOR` | Content writers, freelancers | Anyone who should be able to publish |
| `APPROVER` | The person who signs off | — |
| `CLIENT` | The agency's client, scoped to one brand | Anyone who should see other brands |
| `VIEWER` | Interns, stakeholders | — |

A `CLIENT` user is scoped to a single brand through
`UserOrganization.nashrCustomerId`. **Check that link is set when you create a
CLIENT user** — the scoping fails closed, so a CLIENT without it cannot complete
the client-approval stage and the customer will report that approvals are
"stuck".

Roles are evaluated **in addition to** the subscription tier, never instead of
it. A customer can be blocked by either. If a customer reports a permission
problem, check both.

---

## 5. Your weekly rhythm

### Every day (5 minutes)

```bash
./ops/scripts/healthcheck.sh          # 0 healthy · 1 degraded · 2 down
```
Then open `/admin/errors` and read anything new. Publishing failures are the
thing customers notice first and complain about hardest.

### Every week

- [ ] Read `/admin/errors` for the week. Group by platform — a cluster on one
      platform usually means an API change (RISK-P6), not a customer problem.
- [ ] Check for channels needing reconnection **before customers notice**:
      ```bash
      dcp exec postgres psql -U nashr -d nashr -c \
        "SELECT \"organizationId\", \"providerIdentifier\", name, disabled, \"refreshNeeded\"
           FROM \"Integration\" WHERE disabled = true OR \"refreshNeeded\" = true;"
      ```
      Telling a customer "your Instagram needs reconnecting" is a good week.
      Them telling you is a bad one.
- [ ] Confirm last night's backups exist and are growing plausibly.
- [ ] Collect Arabic quality reports from customers and forward them to the
      native reviewer.

### Every month

- [ ] Run the restore drill; **record it in the log** (`BACKUP_AND_RECOVERY.md`
      §6.3).
- [ ] Merge upstream Postiz on a `sync/upstream-<version>` branch, test in
      staging, then promote (`DEPLOYMENT.md` §9).
- [ ] Refresh base image digests and re-verify them.
- [ ] Re-run the licence checks in `OPEN_SOURCE_COMPLIANCE.md` §8 "on every
      release".
- [ ] Review the beta feedback log (`BETA_CHECKLIST.md` §7).

### Every quarter

- [ ] Full restore drill into staging, including a manual product walkthrough.
- [ ] Re-read `RISK_REGISTER.md` and update statuses. A risk register nobody
      revisits is decoration.

---

## 6. The support calls you will actually get

### "My posts stopped going out"

Almost always an expired or revoked OAuth token. Check
`Integration.refreshNeeded` / `disabled` for that organization (§5). There is no
server-side fix — the customer must reconnect the channel in Settings. Causes:
they changed their platform password, Meta's 60-day token expired, they revoked
access, or the Page was transferred.

If **nothing at all** is publishing for **anyone**, it is not tokens — it is
Temporal. Go to `OPERATIONS_RUNBOOK.md` §4.

### "My post is stuck waiting for approval"

Check three things in order:
1. Does the post have a `NashrPostApproval` row at the expected stage?
2. Does the organization have a user with the role that stage requires?
3. If it is stuck at `CLIENT_APPROVAL`: **is `nashrCustomerId` set** on the
   client user? This is the most common cause (§4).

### "The Arabic is wrong"

Expected, and welcome. Collect the screenshot and the exact phrase, log it, and
send it to the native reviewer. **Do not fix Arabic yourself by machine
translation** — that is how the problem was created. See `FEATURES.md` §5.2.

### "Can you add Snapchat?"

Not soon, and say so plainly. **Log every request.** Snapchat demand is one of
the specific things the beta exists to measure (`BETA_CHECKLIST.md` §7). A
count of requests is what turns "we should probably build Snapchat" into a
decision.

### "TikTok posted my video as a private draft"

Expected until TikTok's audit review passes. Not a bug. It should have been
explained at onboarding; if it was not, that is a gap in your onboarding, not in
the product.

### "Can I get my data out?"

Yes. Their posts, media and schedule are theirs. Agree a mechanism before
someone asks under pressure.

---

## 7. Things you must never do

| Never | Why |
|---|---|
| `docker compose down -v` on production | Deletes every volume, including the database. **No confirmation prompt.** |
| `pnpm run prisma-db-push` against production | It is `prisma db push --accept-data-loss` — it silently drops columns and data (RISK-01). If `migrate deploy` reports drift, **stop** and read `OPERATIONS_RUNBOOK.md` §7. |
| Set `NOT_SECURED` or `DISABLE_SSRF_PROTECTION=true` | Strips CORS credential protection / lets a customer webhook reach Postgres, Redis, Temporal or cloud metadata from inside your network |
| Expose the Temporal UI to the internet | It shows workflow inputs, which include customers' post content |
| Run more than one backend replica | `ProposalStorePort` is in-memory; agent approvals break intermittently across replicas (`FEATURES.md` §5.5) |
| Publish while impersonating | §2.1 |
| Reuse a secret between production and staging | A staging token would authenticate against production. `preflight.sh` blocks it |
| Deploy an image tagged `latest` | `preflight.sh` refuses it |

---

## 8. Adding a new social platform for a customer

1. Register a developer application on the platform, **under a company account
   with more than one admin** — never a personal account.
2. Redirect URI is always `https://<NASHR_DOMAIN>/integrations/social/<provider>`.
   Exact, HTTPS, no wildcards.
3. Request the **minimum** scopes listed in `DEPLOYMENT.md` §7. Extra scopes
   widen the blast radius of a token leak for no benefit.
4. Put the credential pair in `.env.prod` and restart the app. These are runtime
   variables — no rebuild needed.
5. A platform with no credentials configured simply does not appear to
   customers, which is a safe default.
6. **Test one real publish** to a throwaway account before telling any customer
   the channel is available. This is a hard rule — see `BETA_CHECKLIST.md` §3.

---

## 9. When to escalate rather than improvise

Stop and get help — or at minimum take a backup first — when:

- `migrate deploy` reports **drift**. Never "fix" it with `db push`.
- You are about to restore production (`BACKUP_AND_RECOVERY.md` §7.1). It is
  destructive and requires a deliberate flag plus typing the database name.
- A customer reports seeing **another customer's data**. This is RISK-02, the
  highest-impact risk in the product. Treat it as a security incident: preserve
  evidence, do not "just fix it", and tell the affected customers.
- A secret may have leaked. Rotate it (`ops/scripts/rotate-secrets.sh`).
  Removing it from git history does not un-leak it.
- You are considering disabling a safety flag to make something work. There is
  always another way.

---

## 10. Known operational gaps

Stated so you are not surprised at 3am.

- **No off-host alerting yet.** `healthcheck.sh` runs every 15 minutes and
  reports to the host it is checking. That is not a monitoring system. Add an
  external alert (email, Telegram, Uptime-style ping) as soon as you have a
  paying customer. `SECURITY_CHECKLIST.md` §11.
- **`API_LIMIT` is a single global number**, not per-organization. One noisy
  customer can consume the budget for everyone (RISK-S6).
- **No impersonation audit log.**
- **Rollback across a migration is restore-only.** `migrate deploy` rolls
  forward and never backward. Check whether a release contains migrations before
  you promote it.
- **Temporal's own database is deliberately not backed up.** If it is lost,
  posts scheduled but not yet published may need re-queueing
  (`BACKUP_AND_RECOVERY.md` §2).
- **OAuth token encryption at rest is unverified** (RISK-05). Full-disk
  encryption on the data volume is the compensating control and is mandatory.
- **Backend error messages are English only** — 184 of them
  (`libraries/nashr-i18n/UNTRANSLATED_BACKEND_STRINGS.md`). Arabic-speaking
  customers will send you English screenshots.
