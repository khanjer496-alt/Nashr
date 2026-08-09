export const dynamic = 'force-dynamic';
import { brandTitle } from '@gitroom/nashr-brand/brand.config';
import { Metadata } from 'next';
import { AfterActivate } from '@gitroom/frontend/components/auth/after.activate';
export const metadata: Metadata = {
  title: brandTitle('- Activate your account'),
  description: '',
};
export default async function Auth() {
  return <AfterActivate />;
}
