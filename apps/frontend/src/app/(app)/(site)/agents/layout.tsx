import { brandTitle } from '@gitroom/nashr-brand/brand.config';
import { Metadata } from 'next';
import { Agent } from '@gitroom/frontend/components/agents/agent';
import { getLaunchCapabilities } from '@gitroom/helpers/configuration/launch.capabilities';
import { redirect } from 'next/navigation';
export const metadata: Metadata = {
  title: brandTitle('- Agent'),
  description: 'agents',
};
export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!getLaunchCapabilities().hostedAi) redirect('/launches');
  return <Agent>{children}</Agent>;
}
