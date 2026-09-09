import { Metadata } from 'next';
import Link from 'next/link';
import { brand, brandTitle } from '@gitroom/nashr-brand/brand.config';
import { LegalPage, Section, ContactAddress, Callout } from '@gitroom/frontend/components/legal/legal.page';

export const metadata: Metadata = {
  title: brandTitle('Support'),
  description: `Contact ${brand.name} about account access, connected channels and publishing.`,
};

export default function Page() {
  return (
    <LegalPage title="Support" subtitle={`Help with your ${brand.name} workspace.`}>
      {!brand.supportEmail && <Callout tone="warning">Customer signup is not open. A private support contact must be activated before accounts open. Never post private account data in a public issue.</Callout>}
      <Section heading="Contact support">
        <p>
          Contact: <ContactAddress kind="support" />. Once support is active, write{' '}
          from the address you use for your account. Include your workspace name,
          the affected channel, the time and timezone, and what you expected to happen.
        </p>
        <p>
          A screenshot or publishing error message can help. Remove sensitive
          information first. Never send passwords, API keys, access tokens,
          payment-card details or recovery codes.
        </p>
      </Section>
      <Section heading="Privacy and data requests">
        <p>
          To request removal of account or connected-channel data, follow the{' '}
          <Link className="underline" href={brand.dataDeletionUrl}>data deletion instructions</Link>.
          Our <Link className="underline" href={brand.privacyUrl}>Privacy Policy</Link>{' '}
          describes the data processed by the service.
        </p>
      </Section>
      <Section heading="Platform access">
        <p>
          A channel appearing in the product does not guarantee that every account
          type or publishing feature is available. Include the platform name when
          reporting a connection or permission problem. Do not share the password
          for your social media account with support.
        </p>
      </Section>
    </LegalPage>
  );
}
