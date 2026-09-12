import Link from 'next/link';
import { brand, brandTitle } from '@gitroom/nashr-brand/brand.config';
import { LegalPage, Section, Callout } from '@gitroom/frontend/components/legal/legal.page';

export const metadata = { title: brandTitle('Launch status') };

export default function StatusPage() {
  return (
    <LegalPage title="Launch status" subtitle="What is live, and what is still being prepared.">
      <Callout><strong>Public product preview.</strong> Customer signup, payments, account connections and social publishing are not available on this website.</Callout>
      <Section heading="Available now"><p>The product overview, source code, draft policy pages, and support and deletion-process information are public.</p></Section>
      <Section heading="App preparation"><p>The BrightBean-based app uses Django, a background worker and PostgreSQL, with Cloudflare and R2 planned for hosting support and media. Local signup and the dashboard have been checked in a browser. Hetzner deployment is deferred, so the hosted beta is not open.</p></Section>
      <Section heading="Before the beta opens"><p>Nasida Apps LLC is the confirmed operator. Working private contacts are still pending verification. Each enabled channel also needs its own platform access and real publishing tests. No social-platform approval is claimed here.</p></Section>
      <Section heading="Privacy on this preview"><p>This static website has no account, payment or content-upload form and no configured product analytics or advertising tags. The hosting provider processes network requests to deliver and secure the website. The linked product policies remain drafts, not terms for an active hosted account.</p></Section>
      <Section heading="Review and contact"><p><Link className="underline" href={brand.supportUrl}>Support information</Link> · <Link className="underline" href={brand.dataDeletionUrl}>Data deletion information</Link> · <Link className="underline" href={brand.licensesUrl}>Exact source version</Link></p></Section>
    </LegalPage>
  );
}
