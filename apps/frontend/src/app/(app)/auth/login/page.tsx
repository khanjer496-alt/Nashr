export const dynamic = 'force-dynamic';
import { brandTitle } from '@gitroom/nashr-brand/brand.config';
import { Login } from '@gitroom/frontend/components/auth/login';
import { Metadata } from 'next';
export const metadata: Metadata = {
  title: brandTitle('Login'),
  description: '',
};
export default async function Auth() {
  return <Login />;
}
