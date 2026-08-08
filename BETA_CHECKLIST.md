# BETA_CHECKLIST.md — Nashr (نشر)

**Phase 8 deliverable.** The go/no-go gate for the first closed beta:
**5–10 businesses, no more.** Compiled 2026-08-08.

This is not a launch plan with a checklist attached. It is a **gate**. If §2 is
not fully green, the beta does not start, and the correct response to schedule
pressure is to move the date, not to tick a box.

Read with [`LAUNCH_READINESS.md`](LAUNCH_READINESS.md) (the verdict),
[`FEATURES.md`](FEATURES.md) §5 (what is missing), and
[`SECURITY_CHECKLIST.md`](SECURITY_CHECKLIST.md) §0 (the security gate).

---

## 1. What this beta is for

**One question: does a real MENA business get value from this, and which gaps
actually block them?**

Not: does it scale. Not: can we sell it. Not: is the architecture right. Those
are later questions and answering them now costs money you have not made.

| The beta IS | The beta IS NOT |
|---|---|
| 5–10 businesses you can phone personally | A soft public launch |
| A test of whether the approval workflow is worth paying for | A revenue target |
| A measurement of how badly Snapchat's absence hurts | A reason to build Snapchat pre-emptively |
| A native-speaker stress test of the Arabic | A translation project |
| A rehearsal of your own operations | A reason to add infrastructure |

**Hard cap: 10 customers.** Not 12 "because they asked". The cap exists because
support at this stage is you, personally, and because the platform runs on a
single backend replica (`FEATURES.md` §5.5).

---

## 2. Gate — nothing starts until every box is ticked

### 2.1 🔴 Legal and licensing — blocking

- [ ] **Public source mirror published**, containing the deployed code at the
      deployed tag. *(RISK-L1)*
- [ ] `NEXT_PUBLIC_SOURCE_URL` passed as a **build argument** and verified on
      the **live site**, not in the env file:
      `curl -sS https://<domain>/licenses | grep -o 'https://github.com/[^"<]*' | sort -u`
- [ ] The hardcoded upstream source link removed from all 16 locale files
      (`OPEN_SOURCE_COMPLIANCE.md` §3.3). Verify: the check in that section
      prints nothing.
- [ ] `/licenses`, `/terms`, `/privacy`, `/about` return 200 **while signed
      out**.
- [ ] `wc -l LICENSE` → 661; the six protected files unmodified.
- [ ] Legal entity name and jurisdiction set, so `/terms` and `/privacy` stop
      rendering the placeholder. **Owner decision.**
- [ ] Privacy policy states that post content and brand profiles are sent to an
      AI provider outside the region when AI features are used.

### 2.2 🔴 Security — blocking

Work `SECURITY_CHECKLIST.md` §0 to completion and fill in the §12 sign-off
table. Summarised here:

- [ ] `./ops/scripts/preflight.sh .env.prod` exits **0**.
- [ ] `JWT_SECRET` generated with `openssl rand`, ≥32 chars, not a placeholder,
      different from staging.
- [ ] `NOT_SECURED` absent; `DISABLE_SSRF_PROTECTION` absent.
- [ ] `DISABLE_REGISTRATION="true"`.
- [ ] Super-admin account claimed by you, before the DNS record was public.
- [ ] Only 80, 443 and SSH open inbound. Temporal UI loopback-only.
- [ ] **Full-disk encryption on the data volume** — the compensating control for
      unverified OAuth token encryption (RISK-05).
- [ ] Tenant-isolation tests pass for every org-scoped endpoint, **including the
      public API** (RISK-02).
      <!-- LEAD: insert verified tenant-isolation test results from TEST_PLAN.md -->

### 2.3 🔴 Data safety — blocking

- [ ] A backup has been taken **and restored**. `restore-drill.sh` passed.
- [ ] The drill log in `BACKUP_AND_RECOVERY.md` §6.3 has a real row in it.
      **An empty drill log is a no-go.**
- [ ] Off-host backup copies exist in R2 (`BACKUP_R2_BUCKET` set).
- [ ] Backup encryption passphrase stored **off** the host.
- [ ] `.env.prod` stored in a password manager — it is a recovery asset.
- [ ] Migrations deploy via `prisma migrate deploy`; `db push` is nowhere in any
      production path.

### 2.4 🔴 Publishing actually works — blocking

**See §3.** This is the gate most likely to be skipped and the one that most
directly determines whether the beta is a product test or an embarrassment.

### 2.5 🟠 Quality — blocking for Arabic-facing customers

- [ ] Native Arabic review completed for at least the **high-traffic screens**:
      login, calendar, composer, approval flow, settings, billing, and all error
      copy. Full-catalogue review (~700 keys) may continue in parallel, but the
      screens a customer touches daily must be reviewed first (RISK-P2).
- [ ] Brand rendering «نشر» ratified by the brand owner (`RTL_CHECKLIST.md`).
- [ ] The 22 `backend_error_*` Arabic strings reviewed for register.
- [ ] Campaign and vertical Arabic content read by a native Gulf marketer.
- [ ] A human has opened an `ar-AE` session and checked the calendar in all four
      views, the composer with mixed Arabic/Latin/URLs, the toast, both context
      menus, the modal stack, every table, and the media uploader.
      <!-- LEAD: insert verified RTL screenshot references from RTL_VERIFICATION.md -->

### 2.6 🟠 Operations readiness

- [ ] `healthcheck.sh` returns 0 on the live stack.
- [ ] systemd timers enabled: `nashr-backup.timer`, `nashr-healthcheck.timer`.
- [ ] Log rotation active.
- [ ] Sentry receiving events.
- [ ] **An off-host alert exists.** A health check reporting only to the host it
      checks is not monitoring.
- [ ] Staging exists, is separate, and a rollback has been rehearsed once.
- [ ] `OPERATIONS_RUNBOOK.md` §8 has been read by everyone who can touch
      production, and the on-call contact is written down.

### 2.7 🟠 Test coverage

<!-- LEAD: insert verified test totals from TEST_PLAN.md -->

- [ ] Unit suites for the approval state machine, the role matrix and the agent
      guardrails pass.
- [ ] Integration suites for auth, tenant isolation and approval enforcement
      pass.
- [ ] The approval gate is proven for **every** `CreationMethod` —
      `WEB`, `API`, `MCP`, `AUTOPOST`, `CLI` — not just `WEB`. This is the whole
      point of putting the gate in the Temporal activity (RISK-P4).
- [ ] E2E: at least one full flow in English **and** one in Arabic RTL.

---

## 3. 🔴 One real publish per enabled platform — non-negotiable

**This is the brief's explicit requirement and it has never been done.** No post
has ever been published to any real social platform from this build.

For **every** platform you intend to enable for a beta customer:

- [ ] A real developer app is registered and approved (or its limitations are
      understood and documented).
- [ ] A throwaway account exists on that platform for testing.
- [ ] **A real post has been published to it from Nashr, through the full
      approval workflow, and seen live on the platform.**
- [ ] A post with an **image** has been published successfully.
- [ ] A post with **Arabic text** has been published and renders correctly on
      the platform.
- [ ] A **scheduled** post fired at the correct time in `Asia/Dubai`.
- [ ] A **deliberately failing** post produced a sensible error the customer
      could act on.
- [ ] The channel was disconnected and reconnected successfully.

Record it:

| Platform | Approval status | Real publish | + image | + Arabic | Scheduled fired | Failure handled | Date | By |
|---|---|---|---|---|---|---|---|---|
| Instagram | | | | | | | | |
| Facebook Pages | | | | | | | | |
| TikTok | | | | | | | | |
| LinkedIn | | | | | | | | |
| LinkedIn Page | | | | | | | | |
| X | | | | | | | | |
| YouTube | | | | | | | | |
| Threads | | | | | | | | |
| Google Business Profile | | | | | | | | |
| Telegram | | | | | | | | |

**A platform with an empty row does not get enabled for a customer.** Leaving
its credential pair unset means it simply does not appear in the UI, which is
the correct and safe default.

Platform-specific things that will look like bugs if untested:

- **TikTok** posts land as **private drafts** until audit review passes.
- **X** cannot publish at all on the free API tier.
- **Instagram** rejects personal accounts — Business or Creator only.
- **YouTube** unverified apps are capped at 100 users and show a warning screen.
- **Google Business Profile** needs quota access that is not granted by default.

---

## 4. 🔴 Customer disclosure — before anyone signs up

Every beta customer must acknowledge, **in writing, before signing up**:

- [ ] **Snapchat is not supported** and is not coming soon (RISK-P1). Stated
      prominently, not in a footnote. This is the single biggest product gap and
      it is directly relevant to restaurants, salons and clinics.
- [ ] **The Arabic interface is machine-translated and under native review**
      (RISK-P2). Roughly 700 phrases have not been read by a native speaker.
- [ ] **Backend error messages are English only**, even in an Arabic session.
- [ ] **RTL layout may have edge cases** (RISK-P3).
- [ ] **The calendar week starts Monday** — correct for the UAE, wrong for KSA
      and the other target markets. Relevant if they are not in the UAE.
- [ ] **Platform approvals take 1–3 weeks** and are outside our control.
- [ ] **Analytics are available for 11 of 34 channels.**
- [ ] **This is a beta**: expect bugs, expect changes, expect to be asked for
      feedback. State the pricing arrangement and its end date
      (`PRICING_RECOMMENDATIONS.md` §4).
- [ ] **Post content and brand profiles are sent to an AI provider outside the
      region** when AI features are used. Credentials, emails and phone numbers
      are stripped first. They can decline by not using AI features.

Keep the signed acknowledgements. If a customer is later unhappy about Snapchat,
the disclosure is the difference between a misunderstanding and a
misrepresentation.

---

## 5. Choosing the 5–10

Recruit deliberately, not opportunistically.

**Recommended mix:**

| Count | Type | Why |
|---|---|---|
| 2–3 | Restaurants | The core vertical. Highest Snapchat exposure — they will tell you fastest how much it costs. |
| 2–3 | **One small agency** with 2–4 clients | The only way to test the approval workflow properly. The most valuable customer in the beta. |
| 1–2 | Salon or clinic | Tests the prohibited-claims feature under real advertising rules. |
| 1–2 | Small business / retail | Breadth. |

**Start UAE-only.** The calendar week-start bug (`FEATURES.md` §5.7) makes KSA
and the other markets a worse first experience, and the UAE is the stated
initial market.

**Prefer customers who:**
- will answer the phone and tell you the truth
- post at least a few times a week (a dormant customer teaches nothing)
- have someone who reads Arabic properly and will complain about bad Arabic
- are not betting their Q4 on this working

**Avoid:**
- anyone for whom Snapchat is central
- anyone who needs WhatsApp automation or a CRM
- anyone who needs a mobile app
- anyone whose failure would be publicly embarrassing to them

---

## 6. The first six weeks

**Week 0 — gate.** §2 complete and signed off. Do not proceed on a partial gate.

**Week 1 — one customer.** The friendliest one. Full onboarding with you in the
room or on a call. Start their platform approvals on day one. **Do not add a
second customer until the first has published a real post.**

**Week 2 — two more.** Include the agency. Watch the approval workflow being
used by people who did not build it.

**Week 3–4 — the rest, up to 10.** Stop at 10 regardless of demand.

**Week 5–6 — listen.** A structured conversation with every customer. Not "how's
it going" — the specific questions in §7.

**Checkpoint at the end of week 6:** review §7 against §8 and decide. Write the
decision down.

---

## 7. What you are measuring

Log every one of these against a customer name and a date. A count is what turns
an anecdote into a decision.

| Signal | How to capture | Decision it drives |
|---|---|---|
| **Snapchat requests** | Count every mention, unprompted or prompted | Whether to build a Snapchat provider — the largest single post-MVP item |
| **Arabic quality complaints** | Screenshot + exact phrase, per customer | Where the native reviewer goes next |
| **Approval workflow use** | Are posts actually going through review, or is everyone publishing directly? | Whether approval is the differentiator we think it is, and whether it justifies tier gating (`PRICING_RECOMMENDATIONS.md` §4) |
| **AI feature use** | Which agents get used, how often | Real AI cost per tenant; whether the agents earned their complexity |
| **Channels connected per customer** | Count | Whether the channel meter is priced right |
| **Publishing failures** | `/admin/errors`, grouped by platform | Provider reliability; which platform needs attention |
| **Support time per customer** | Hours, honestly recorded | Whether the price covers reality |
| **WhatsApp / CRM / mobile requests** | Count only. **Do not build.** | Post-beta roadmap, if the counts justify it |
| **Churn intent** | "Would you keep paying?" asked directly | The only question that matters |

---

## 8. 🔴 What you will NOT build during the beta

The brief is explicit, and this list exists because every one of these will be
asked for by someone persuasive.

| Not building | Even if | Instead |
|---|---|---|
| WhatsApp Business automation | Three customers ask | Count it |
| CRM / customer database | An agency says it would close the deal | Count it |
| Payment automation beyond existing Stripe | — | Count it |
| Mobile apps | Everyone asks | The browser works on a phone |
| Enterprise infrastructure (multi-region, HA, Kubernetes) | It feels fragile | One box is correct for 10 customers |
| Snapchat | It is the top request | **Count it. Decide after week 6, with a number.** |
| Additional social platforms | A customer wants one | Count it |
| Autonomous publishing | A customer asks for it | It stays off by default. Explain why. |
| Postgres RLS | RISK-02 is scary | Fix it with tests first; RLS is a post-MVP backstop |

**The one exception:** if the beta reveals a **correctness or safety** defect —
cross-tenant leakage, approval bypass, data loss, a security hole — fix it
immediately. Correctness is not a feature.

Two pieces of engineering *are* pre-approved because they are limitations, not
features:
- **Redis-backed `ProposalStorePort`**, if and only if you need a second replica
  (`FEATURES.md` §5.5).
- **Calendar week-start per market**, if and only if you onboard outside the UAE
  (`FEATURES.md` §5.7).

---

## 9. Exit criteria — deciding what happens after week 6

**Proceed to a wider launch only if all of these are true:**

- [ ] At least 5 customers published real posts regularly for 4+ weeks.
- [ ] No cross-tenant data leakage, ever.
- [ ] No unapproved post reached a live account, ever.
- [ ] No data loss; every scheduled backup ran; the restore drill passed monthly.
- [ ] The native Arabic review is complete for the whole catalogue, not just the
      high-traffic screens.
- [ ] At least 3 customers say they would pay the proposed price.
- [ ] You know, with a number, how much Snapchat's absence costs.
- [ ] Support time per customer is sustainable at 3× the customer count.

**Fix before widening, but not a reason to stop:**

- Snapchat, if the count says so
- Calendar week-start, before any non-UAE customer
- Backend error message translation
- Redis proposal store, before a second replica
- Per-organization rate limits

---

## 10. Kill criteria — when to stop rather than push on

Written down in advance, because in the moment there will be reasons not to.

**Stop and reconsider the product if:**

- 3+ of the beta customers stop using it within 6 weeks without a fixable reason.
- Snapchat's absence blocks the majority — that is a different product, not a
  backlog item.
- The approval workflow goes unused. It is the main differentiator; if nobody
  wants it, the positioning is wrong.
- Arabic quality cannot be brought to a credible standard at acceptable cost.
- Support time per customer makes any plausible price unprofitable at 50
  customers.

**Stop immediately, do not "monitor", if:**

- Cross-tenant data leakage occurs. Take the platform down, tell the affected
  customers, and do not restart until it is proven fixed with a test.
- An unapproved post reaches a live customer account. That is the core promise.
- Customer data is lost and cannot be restored.

---

## 11. Sign-off

The beta does not start until this table is complete. A signature means the
evidence exists, not that the box looked plausible.

| Gate | Owner | Date | Evidence |
|---|---|---|---|
| §2.1 Legal / licensing | | | Live `/licenses` output, mirror URL |
| §2.2 Security | | | `preflight.sh` output, `SECURITY_CHECKLIST.md` §12 |
| §2.3 Data safety | | | Drill log row in `BACKUP_AND_RECOVERY.md` §6.3 |
| §3 Real publish per platform | | | Completed table in §3 |
| §2.5 Arabic review | | | Reviewer name, screens covered |
| §2.6 Operations | | | `healthcheck.sh` output, alert test |
| §2.7 Tests | | | Test run output |
| §4 Customer disclosures | | | Signed acknowledgements, one per customer |
