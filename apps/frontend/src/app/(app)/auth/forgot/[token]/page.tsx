export const dynamic = 'force-dynamic';
import { brandTitle } from '@gitroom/nashr-brand/brand.config';
import { ForgotReturn } from '@gitroom/frontend/components/auth/forgot-return';
import { Metadata } from 'next';
export const metadata: Metadata = {
  title: brandTitle('Forgot Password'),
  description: '',
};
export default async function Auth(params: {
  params: Promise<{
    token: string;
  }>;
}) {
  return <ForgotReturn token={(await params.params).token} />;
}
