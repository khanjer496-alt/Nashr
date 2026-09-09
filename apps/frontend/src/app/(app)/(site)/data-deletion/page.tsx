import { Metadata } from 'next';
import Link from 'next/link';
import { brand, brandTitle } from '@gitroom/nashr-brand/brand.config';
import { LegalPage, Section, ContactAddress, Callout } from '@gitroom/frontend/components/legal/legal.page';

export const metadata: Metadata = {
  title: brandTitle('Data deletion'),
  description: `How to request deletion of your ${brand.name} account and connected-channel data.`,
};

export default function Page() {
  return (
    <LegalPage title="Data deletion" subtitle="Request removal of account or connected-channel data.">
      {!brand.privacyEmail && <Callout tone="warning">The private request channel is not active yet. This preview does not accept customer accounts or social connections. The instructions below describe the planned process, not a working deletion endpoint.</Callout>}
      <Section heading="Send a deletion request">
        <p>
          Contact: <ContactAddress kind="privacy" />. Once the request channel is active,
          use the subject &ldquo;Data deletion request&rdquo; and the email address
          associated with your account and identify the workspace and connected
          platform, if your request is limited to one channel.
        </p>
        <p>
          State whether you are requesting deletion of your personal account,
          connected-channel data or an entire workspace. A workspace can contain
          other people&rsquo;s data, so authority and scope must be verified before
          it is removed. Never send passwords, API keys or access tokens.
        </p>
        <p>
          This is a manual request process, not an automated deletion endpoint.
          Sending an email is not confirmation that deletion has been completed.
        </p>
      </Section>
      <Section heading="Withdraw platform access separately">
        <p>
          You can revoke {brand.name}&rsquo;s authorization in the connected social
          platform&rsquo;s settings for authorized apps or business integrations.
          Revoking authorization and deleting stored service data are separate
          actions. Use the contact above to request removal of data held by {brand.name}.
        </p>
      </Section>
      <Section heading="Scheduled and published content">
        <p>
          Review and cancel future scheduled content before disconnecting a
          channel. Posts already published on a social platform must be managed
          on that platform; a service-data deletion request does not by itself
          delete a live social post.
        </p>
      </Section>
      <Section heading="Retention and privacy">
        <p>
          Refer to the <Link className="underline" href={brand.privacyUrl}>Privacy Policy</Link>{' '}
          for retention and any applicable record-keeping requirements. Questions
          about an existing request can be sent to the same privacy contact.
        </p>
      </Section>
    </LegalPage>
  );
}
