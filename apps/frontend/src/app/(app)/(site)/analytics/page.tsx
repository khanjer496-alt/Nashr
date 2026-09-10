export const dynamic = 'force-dynamic';
import { brandTitle } from '@gitroom/nashr-brand/brand.config';
import { Metadata } from 'next';
import { PlatformAnalytics } from '@gitroom/frontend/components/platform-analytics/platform.analytics';
import { getLaunchCapabilities } from '@gitroom/helpers/configuration/launch.capabilities';
import { redirect } from 'next/navigation';
export const metadata: Metadata = {
  title: brandTitle('Analytics'),
  description: '',
};
export default async function Index() {
  if (!getLaunchCapabilities().platformAnalytics) redirect('/launches');
  return <PlatformAnalytics />;
}
