import { Metadata } from 'next';
import Link from 'next/link';
import { brand, brandTitle } from '@gitroom/nashr-brand/brand.config';
import {
  LegalPage,
  Section,
  ContactAddress,
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
          <strong>Social publishing for humans and AI agents.</strong>{' '}
          {brand.name} brings planning, content review, scheduling and publishing
          into a shared workspace for creators, teams and agencies.
        </p>
        <p>
          The workspace is built on BrightBean Studio. People use the browser;
          software and trusted agents connect through REST and MCP. Workspace
          permissions and configured approval requirements govern the publishing
          workflow across these interfaces.
        </p>
      </Section>

      <Section heading="Choose your interface">
        <ul className="list-disc ps-[22px] flex flex-col gap-[6px]">
          <li>
            <strong>Web.</strong> Plan the calendar, compose posts, organize media
            and review work with your team.
          </li>
          <li>
            <strong>REST API.</strong> Connect your own tools to workspace content
            and publishing operations using scoped access.
          </li>
          <li>
            <strong>MCP.</strong> Give a compatible AI client access to the
            workspace tools it is authorized to use.
          </li>
        </ul>
        <p>
          Channel connections, publishing and analytics depend on the configured
          integrations, platform permissions and account requirements. See the{' '}
          <Link className="underline" href="/status">launch status</Link> for
          current availability.
        </p>
      </Section>

      <Section heading="Built for teams around the world">
        <p>
          Organize separate client workspaces, coordinate publishing times and
          keep review decisions with the content. The product serves a global
          audience of people and software working together.
        </p>
      </Section>

      <Section heading="Open source">
        <p>
          The BrightBean-based workspace and this Postiz-derived website have
          separate source repositories. Both retain their upstream authors&rsquo;
          notices and are distributed under AGPL-3.0. See the{' '}
          <Link className="underline" href={brand.licensesUrl}>
            licences and source offer
          </Link>{' '}
          for each component and its source.
        </p>
      </Section>

      <Section heading="Contact">
        <p>
          Questions, feedback or partnership enquiries:{' '}
          <ContactAddress kind="support" />.
        </p>
      </Section>
    </LegalPage>
  );
}
