import type { Metadata } from 'next';
import { brand } from '@gitroom/nashr-brand/brand.config';
import { LandingPage } from '@gitroom/frontend/components/marketing/landing.page';

export const metadata: Metadata = {
  title: `${brand.name} — ${brand.heroLine}`,
  description: `${brand.tagline}. ${brand.description}`,
};

export default function Page() {
  return <LandingPage />;
}
