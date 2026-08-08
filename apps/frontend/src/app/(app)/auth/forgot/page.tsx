export const dynamic = 'force-dynamic';
import { brandTitle } from '@gitroom/nashr-brand/brand.config';
import { Forgot } from '@gitroom/frontend/components/auth/forgot';
import { Metadata } from 'next';
export const metadata: Metadata = {
  title: brandTitle('Forgot Password'),
  description: '',
};
export default async function Auth() {
  return <Forgot />;
}
