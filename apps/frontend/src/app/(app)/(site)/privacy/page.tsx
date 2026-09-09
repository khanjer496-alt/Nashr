import { Metadata } from 'next';
import Link from 'next/link';
import { brand, brandTitle } from '@gitroom/nashr-brand/brand.config';
import {
  LegalPage,
  Section,
  Callout,
  PlaceholderNotice,
  Entity,
  Jurisdiction,
} from '@gitroom/frontend/components/legal/legal.page';

export const metadata: Metadata = {
  title: brandTitle('Privacy Policy'),
  description: `How ${brand.name} handles personal data.`,
};

export default async function Page() {
  return (
    <LegalPage
      title="Privacy Policy"
      subtitle={`What ${brand.name} collects, why, and who else sees it.`}
    >
      <PlaceholderNotice what="This policy is a draft describing the system as built." />

      <Section heading="1. Who is responsible">
        <p>
          The controller of personal data processed through {brand.name} is{' '}
          <Entity />, established in <Jurisdiction />. Data-protection enquiries:{' '}
          <a className="underline" href={`mailto:${brand.privacyEmail}`}>
            {brand.privacyEmail}
          </a>
          .
        </p>
      </Section>

      <Section heading="2. What we collect">
        <ul className="list-disc ps-[22px] flex flex-col gap-[6px]">
          <li>
            <strong>Account data</strong> — name, email address, company name,
            password hash, workspace membership and role.
          </li>
          <li>
            <strong>Connected channel data</strong> — access and refresh tokens
            for the social accounts you connect, plus the profile name, handle
            and avatar those platforms return.
          </li>
          <li>
            <strong>Content</strong> — the posts, images, video and comments you
            create, schedule or upload, and their publishing history.
          </li>
          <li>
            <strong>Analytics</strong> — engagement metrics we retrieve from the
            connected platforms about your own posts.
          </li>
          <li>
            <strong>Billing data</strong> — subscription tier and payment
            identifiers. Card details are handled by our payment processor and
            never reach our servers.
          </li>
          <li>
            <strong>Technical data</strong> — IP address, browser and device
            information, and error diagnostics.
          </li>
        </ul>
      </Section>

      <Section heading="3. Why we process it">
        <p>
          To operate the service you asked for (performance of a contract), to
          keep it secure and to detect abuse (legitimate interests), to bill you
          and meet accounting obligations (legal obligation), and — only where
          you have opted in — to send product or marketing email (consent).
        </p>
      </Section>

      <Section heading="4. AI features and third-party model providers">
        <Callout tone="warning">
          <strong>Read this before using the AI features.</strong> When you use
          an AI feature — content generation, rewriting, the assistant, image or
          video generation, or automated suggestions — the text, images and
          related context you supply are transmitted to third-party AI model
          providers so they can produce a response. That content leaves{' '}
          {brand.name}&rsquo;s own infrastructure.
        </Callout>
        <p>
          These providers process the content under their own terms and may
          operate outside your country, including outside the GCC. Retention and
          whether submissions are used for model training are governed by our
          agreement with each provider; we select providers that offer
          no-training terms for business API traffic, but you should not put
          information into an AI feature that you would not be comfortable
          sharing with a processor abroad.
        </p>
        <p>
          AI features are optional. If you do not use them, your content is not
          sent to a model provider. The specific providers in use for this
          deployment are listed on the{' '}
          <Link className="underline" href={brand.licensesUrl}>
            Licences &amp; source
          </Link>{' '}
          page and in our processor register, available on request from{' '}
          <a className="underline" href={`mailto:${brand.privacyEmail}`}>
            {brand.privacyEmail}
          </a>
          .
        </p>
      </Section>

      <Section heading="5. Other processors we share data with">
        <ul className="list-disc ps-[22px] flex flex-col gap-[6px]">
          <li>
            <strong>Social media platforms</strong> — the accounts you connect,
            in order to publish on your behalf and read back your analytics.
          </li>
          <li>
            <strong>Hosting, database and object storage providers</strong> —
            where the service and your uploads run and are stored.
          </li>
          <li>
            <strong>Payment processor</strong> — to take subscription payments.
          </li>
          <li>
            <strong>Email delivery provider</strong> — transactional email such
            as activation, password reset and notifications.
          </li>
          <li>
            <strong>Error monitoring and product analytics</strong> — to
            diagnose faults and understand feature usage.
          </li>
        </ul>
        <p>We do not sell personal data.</p>
      </Section>

      <Section heading="6. International transfers">
        <p>
          Some processors above operate outside the country where your workspace
          is based. Where that happens we rely on the transfer mechanisms
          available under the applicable law and on contractual protections with
          each processor.
        </p>
      </Section>

      <Section heading="7. Retention">
        <p>
          Account and content data are retained while your workspace is active.
          After deletion we remove or anonymise personal data within a defined
          window, except where we must keep records to meet legal, tax or
          accounting obligations. Concrete retention periods are to be confirmed
          with counsel before launch.
        </p>
      </Section>

      <Section heading="8. Security">
        <p>
          The production token-storage, encryption, access-control and audit-log
          arrangements are to be confirmed before accepting customer-connected
          accounts. This draft must be updated to describe the controls actually
          deployed and verified. No system is perfectly secure; breach-notification
          duties depend on the applicable law.
        </p>
      </Section>

      <Section heading="9. Your rights">
        <p>
          Subject to the law that applies to you, you may request access to your
          personal data, correction, deletion, a portable copy, or restriction of
          or objection to certain processing. Write to{' '}
          <a className="underline" href={`mailto:${brand.privacyEmail}`}>
            {brand.privacyEmail}
          </a>
          . You may also complain to your local data-protection authority.
        </p>
        <p>
          Follow the <Link className="underline" href={brand.dataDeletionUrl}>data deletion instructions</Link>{' '}
          to request removal of account or connected-channel data.
        </p>
      </Section>

      <Section heading="10. Cookies">
        <p>
          We use a session cookie to keep you signed in, a preference cookie for
          your language and interface settings, and — where enabled for this
          deployment — analytics cookies. Blocking the session cookie will
          prevent sign-in.
        </p>
      </Section>

      <Section heading="11. Children">
        <p>
          {brand.name} is a business tool and is not directed at children. We do
          not knowingly collect data from anyone under the age at which consent
          is valid in their country.
        </p>
      </Section>

      <Section heading="12. Changes and contact">
        <p>
          We will announce material changes in the product before they take
          effect. Questions:{' '}
          <a className="underline" href={`mailto:${brand.privacyEmail}`}>
            {brand.privacyEmail}
          </a>
          .
        </p>
      </Section>
    </LegalPage>
  );
}
