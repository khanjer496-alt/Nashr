import { Metadata } from 'next';
import Link from 'next/link';
import { brand, brandTitle } from '@gitroom/nashr-brand/brand.config';
import {
  LegalPage,
  Section,
} from '@gitroom/frontend/components/legal/legal.page';

export const metadata: Metadata = {
  title: brandTitle('About'),
  description: brand.description,
};

export default async function Page() {
  return (
    <LegalPage title={`About ${brand.name}`} subtitle={brand.tagline}>
      <Section heading={`What ${brand.name} is`}>
        <p>
          <strong>
            Social publishing infrastructure for humans and AI agents.
          </strong>{' '}
          {brand.name} gives creators, teams and agencies a complete workspace
          to plan a content calendar, review and approve posts, publish across
          connected channels, and measure what happened afterwards.
        </p>
        <p>
          The browser product remains the complete control surface. The same
          publishing engine is being opened through programmable interfaces so
          software and trusted agents can participate under the same permissions,
          approvals and audit trail as people.
        </p>
      </Section>

      <Section heading="One publishing system, every interface">
        <ul className="list-disc ps-[22px] flex flex-col gap-[6px]">
          <li>
            <strong>Web.</strong> The complete product for planning, approvals,
            publishing, analytics and administration.
          </li>
          <li>
            <strong>API, MCP and SDK.</strong> First-class integration surfaces
            for products and AI agents, built around the same publishing model.
          </li>
          <li>
            <strong>CLI.</strong> A command-line interface is being completed for
            automation, scripting and terminal-native workflows.
          </li>
        </ul>
      </Section>

      <Section heading="Global by default, local when it matters">
        <ul className="list-disc ps-[22px] flex flex-col gap-[6px]">
          <li>
            <strong>Arabic and bilingual publishing.</strong> The interface
            supports right-to-left (RTL) layouts, and one workspace can plan,
            approve and publish Arabic and English content side by side.
          </li>
          <li>
            <strong>Regional voice.</strong> Dialect-aware content tools help
            teams adapt a message without making one region the product default.
          </li>
          <li>
            <strong>Calendars that understand context.</strong> Optional Hijri,
            Ramadan and Eid planning layers sit alongside global scheduling.
          </li>
          <li>
            <strong>Agency-shaped collaboration.</strong> Multiple client brands,
            separate channel sets and approvals before anything goes out.
          </li>
        </ul>
      </Section>

      <Section heading="Open source">
        <p>
          {brand.name} is {brand.upstream.attribution} and is itself distributed
          under the {brand.upstream.license}. That means the software running
          this service is free software, and you are entitled to its source code.
          See the{' '}
          <Link className="underline" href={brand.licensesUrl}>
            licences and source offer
          </Link>{' '}
          page.
        </p>
      </Section>

      <Section heading="Contact">
        <p>
          Questions, feedback or partnership enquiries:{' '}
          <a className="underline" href={`mailto:${brand.supportEmail}`}>
            {brand.supportEmail}
          </a>
          .
        </p>
      </Section>
    </LegalPage>
  );
}
