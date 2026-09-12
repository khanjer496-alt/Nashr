# Homepage wording and SEO review — 12 September 2026

Reference: https://www.postiz.com/ redirects to https://postiz.com/. Reviewed the live page in Chrome, read the visible copy and metadata, and clicked the center toggle control to confirm both modes. Clicking its adjacent text alone did not switch modes.

## Observed pattern

Postiz leads its agent mode with automation and its normal mode with the scheduler category. Its title names the product category, and its description covers scheduling, account management and analytics. Below the hero it covers audiences, a product demonstration, automation, features, channels and FAQs. Those are observed page choices, not evidence of ranking or conversion performance.

## PostDelegate changes

- Native keyboard-accessible AI-agents/social-scheduling radio toggle.
- One H1 with alternate visible headline and description for each audience.
- Plain scheduling language rather than abstract infrastructure or control slogans.
- Homepage title and description cover both personal scheduling and agent integration.
- Homepage canonical remains the owned public origin.
- Basic WebSite structured data, without fabricated reviews, pricing, customer counts or unsupported features.
- Generated sitemap contains only the allowlisted public pages; robots points to that sitemap.
- Existing preview disclosure and noindex remain intentional while the full service is not launched. Indexing requires a deliberate release change, not just this copy update.

## Verification and limits

Browser verification passed: both states, native arrow-key switching, one H1, mobile width, and the local title/description. Public-site/redirect checks passed (15 tests, including the public sitemap invariant). Full Next.js export and Cloudflare deployment have not been performed for these changes. Search Console ownership, indexing, rankings and real Core Web Vitals were not established by this review.

## Full-page follow-through

The lower page was subsequently reviewed against both live Postiz and Post Bridge pages, including rendered below-hero sections. Replaced repeated agent/audience cards and simulated chat with an actual composer screenshot, a mode-aware three-step workflow, six core features, an explicitly labeled agent instruction, channel availability, a compact preview/pricing notice and practical FAQs. Both scheduling modes now affect lower-page content. Tablet navigation's 640–1023px gap was fixed. Native toggle selectors use ID attribute matching so CSS Modules cannot rename the control ID.

Browser checks covered all section anchors, image loading, FAQ expansion, both workflow modes and widths of 1440, 768 and 390 pixels. No horizontal overflow or JavaScript errors were found. Production export and deployment remain separate.
