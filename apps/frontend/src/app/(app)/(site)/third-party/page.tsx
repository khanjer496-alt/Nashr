import { brandTitle } from '@gitroom/nashr-brand/brand.config';
import { ThirdPartyComponent } from '@gitroom/frontend/components/third-parties/third-party.component';

export const dynamic = 'force-dynamic';
import { Metadata } from 'next';
export const metadata: Metadata = {
  title: brandTitle('Integrations'),
  description: '',
};
export default async function Index() {
  return <ThirdPartyComponent />;
}
