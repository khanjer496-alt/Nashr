import { Metadata } from 'next';
import Link from 'next/link';
import { brand, brandTitle } from '@gitroom/nashr-brand/brand.config';
import {
  LegalPage,
  Section,
  PlaceholderNotice,
  Entity,
  Jurisdiction,
  ContactAddress,
} from '@gitroom/frontend/components/legal/legal.page';

export const metadata: Metadata = {
  title: brandTitle('Terms of Service'),
  description: `Terms of Service for ${brand.name}.`,
};

export default async function Page() {
  return (
    <LegalPage
      title="Terms of Service"
      subtitle={`The agreement between you and the operator of ${brand.name}.`}
    >
      <PlaceholderNotice what="These Terms are a draft skeleton, not a finished contract." />

      <Section heading="1. Who you are contracting with">
        <p>
          {brand.name} is operated by <Entity />, established in{' '}
          <Jurisdiction />. In these Terms, &ldquo;we&rdquo;, &ldquo;us&rdquo;
          and &ldquo;our&rdquo; mean that entity; &ldquo;you&rdquo; means the
          individual or organisation using the service.
        </p>
        <p className="text-textItemBlur text-[14px]">
          The entity name and jurisdiction are read from configuration
          (<code>NEXT_PUBLIC_BRAND_LEGAL_NAME</code>,{' '}
          <code>NEXT_PUBLIC_BRAND_JURISDICTION</code>) rather than being written
          into the product. They must be set, and the resulting text reviewed by
          a lawyer, before launch.
        </p>
      </Section>

      <Section heading="2. The service">
        <p>
          {brand.name} lets you connect third-party social media accounts, create
          and schedule content, route it through review and approval, publish it
          to those accounts, and view analytics. Availability of any particular
          social network depends on that network&rsquo;s own API and terms, which
          can change without notice.
        </p>
      </Section>

      <Section heading="3. Your account">
        <p>
          You are responsible for the accuracy of your registration details, for
          keeping your credentials secure, and for everything done through your
          workspace by the people you invite to it. Tell us promptly at{' '}
          <ContactAddress kind="support" />{' '}
          if you believe your account has been compromised.
        </p>
      </Section>

      <Section heading="4. Connected accounts and third-party terms">
        <p>
          When you connect a social media account you authorise us to act on your
          behalf on that platform, within the permissions you grant. You remain
          bound by each platform&rsquo;s own terms. We are not responsible for a
          platform suspending, rate-limiting or terminating your account, nor for
          changes a platform makes to its API.
        </p>
      </Section>

      <Section heading="5. Your content">
        <p>
          You keep ownership of everything you upload or publish. You grant us
          only the licence needed to operate the service: to store, process,
          transform and transmit your content in order to schedule and publish it
          and to show it back to you.
        </p>
        <p>
          You confirm that you have the rights to the content you publish and
          that it does not infringe anyone else&rsquo;s rights.
        </p>
      </Section>

      <Section heading="6. Acceptable use">
        <p>You must not use {brand.name} to:</p>
        <ul className="list-disc ps-[22px] flex flex-col gap-[6px]">
          <li>break any law that applies to you or to your audience;</li>
          <li>
            publish content that is unlawful, deceptive, defamatory, or that
            infringes intellectual-property or privacy rights;
          </li>
          <li>send spam or operate coordinated inauthentic behaviour;</li>
          <li>
            attempt to breach, overload or reverse-engineer the service or the
            infrastructure it runs on.
          </li>
        </ul>
        <p>
          We may suspend a workspace that is causing harm, and will tell you why
          when we do.
        </p>
      </Section>

      <Section heading="7. AI features">
        <p>
          Some features send your content to third-party AI model providers. What
          is sent, and to whom, is described in the{' '}
          <Link className="underline" href={brand.privacyUrl}>
            Privacy Policy
          </Link>
          . AI output can be wrong; you are responsible for reviewing anything
          you publish.
        </p>
      </Section>

      <Section heading="8. Fees, trials and cancellation">
        <p>
          Paid plans are billed in advance for the period you select. Trials, if
          offered, convert to a paid plan unless cancelled before the trial ends.
          You can cancel at any time from your billing settings; cancellation
          stops future charges and takes effect at the end of the current period.
        </p>
        <p className="text-textItemBlur text-[14px]">
          Refund terms, tax treatment (including VAT) and the currencies offered
          are still to be confirmed and must be completed before launch.
        </p>
      </Section>

      <Section heading="9. Availability and support">
        <p>
          We aim to keep the service available and to restore it quickly when it
          is not, but we do not commit to a specific uptime figure unless a
          separate written agreement says so. Planned maintenance will be
          announced where practical.
        </p>
      </Section>

      <Section heading="10. Liability">
        <p>
          To the maximum extent permitted by law, we are not liable for indirect
          or consequential loss, lost profits, or lost or corrupted data, and our
          total liability is limited to the fees you paid in the twelve months
          before the claim. Nothing here limits liability that cannot be limited
          by law.
        </p>
      </Section>

      <Section heading="11. Ending the agreement">
        <p>
          You may stop using {brand.name} and delete your workspace at any time.
          We may end the agreement on reasonable notice, or immediately for a
          serious breach of section 6. On termination you may export your data
          for a reasonable period before it is deleted.
        </p>
      </Section>

      <Section heading="12. Software licence and source code">
        <p>
          The {brand.name} software is {brand.upstream.attribution} and is
          licensed to you under the {brand.upstream.license}. These Terms cover
          the hosted service; they do not restrict the rights the{' '}
          {brand.upstream.license} grants you in the software itself. See{' '}
          <Link className="underline" href={brand.licensesUrl}>
            Licences &amp; source
          </Link>
          .
        </p>
      </Section>

      <Section heading="13. Changes">
        <p>
          We may update these Terms. Material changes will be announced in the
          product before they take effect. Continuing to use {brand.name} after
          that date means you accept the updated Terms.
        </p>
      </Section>

      <Section heading="14. Governing law">
        <p>
          {brand.legal.governingLaw ||
            'The governing law and the courts with jurisdiction are to be confirmed with counsel and configured via NEXT_PUBLIC_BRAND_GOVERNING_LAW.'}
        </p>
      </Section>

      <Section heading="15. Contact">
        <p>
          <ContactAddress kind="support" />
        </p>
      </Section>
    </LegalPage>
  );
}
