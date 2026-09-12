import { LandingPage } from '@gitroom/frontend/components/marketing/landing.page';
import { brand } from '@gitroom/nashr-brand/brand.config';

// Homepage only: subpages must not inherit the homepage canonical.
export const metadata = { alternates: { canonical: brand.appUrl } };

export default function Page() {
  const website = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: brand.name,
    url: brand.appUrl,
    description: 'Social media scheduling for people and AI agents.',
  };
  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(website).replace(/</g, '\\u003c') }} />
    <LandingPage />
  </>;
}
