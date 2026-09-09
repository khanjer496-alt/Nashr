import { Metadata } from 'next';
import { brand, brandTitle } from '@gitroom/nashr-brand/brand.config';
import {
  LegalPage,
  Section,
  Callout,
  ContactAddress,
} from '@gitroom/frontend/components/legal/legal.page';
import {
  dependencyLicenses,
  licenseSummary,
} from '@gitroom/frontend/components/legal/dependencies';

export const metadata: Metadata = {
  title: brandTitle('Licences & Source'),
  description: `${brand.name} is ${brand.upstream.attribution}. Open-source licences and the AGPL-3.0 source code offer.`,
};

export default async function Page() {
  return (
    <LegalPage
      title="Licences & Source Code"
      subtitle={`${brand.name} is free software. Here is what it is built from, and how to get the source.`}
    >
      <Callout>
        <strong>
          {brand.name} is {brand.upstream.attribution}.
        </strong>{' '}
        The {brand.upstream.name} project is published at{' '}
        <a
          className="underline"
          href={brand.upstream.url}
          target="_blank"
          rel="noreferrer"
        >
          {brand.upstream.url}
        </a>{' '}
        under the {brand.upstream.license}. {brand.name} is a modified version of
        that project and is distributed under the same licence. Copyright in the
        upstream work remains with its authors.
      </Callout>

      <Section heading="Source code offer (AGPL-3.0 §13)">
        <p>
          The {brand.upstream.license} requires that everyone who interacts with
          this software over a network is offered the Corresponding Source of the
          exact version they are interacting with — including our modifications.
        </p>
        <p>
          <strong>You can obtain the complete source code of {brand.name} at:</strong>
        </p>
        <p>
          <a
            className="underline text-[16px] font-[600]"
            href={brand.sourceUrl}
            target="_blank"
            rel="noreferrer"
          >
            {brand.sourceUrl}
          </a>
        </p>
        <p>
          That repository contains the full source, build instructions and the
          modifications made on top of {brand.upstream.name}. If the link is
          unavailable, or you would prefer the source on physical media, write to{' '}
          <ContactAddress kind="support" />{' '}
          and we will provide it at no more than the cost of distribution.
        </p>
        <p>
          The full text of the GNU Affero General Public License v3 ships with
          the source as <code>LICENSE</code> and is also published at{' '}
          <a
            className="underline"
            href="https://www.gnu.org/licenses/agpl-3.0.html"
            target="_blank"
            rel="noreferrer"
          >
            gnu.org/licenses/agpl-3.0.html
          </a>
          .
        </p>
      </Section>

      <Section heading="What we changed">
        <p>
          {brand.name} is a maintained fork of Postiz that adds global publishing
          infrastructure, human and agent workflows, and optional localization
          capabilities such as Arabic, RTL and regional calendars. Every
          modification is recorded in <code>FORK_CUSTOMIZATIONS.md</code> in the
          source repository, alongside the rationale for each change.
        </p>
      </Section>

      <Section heading="Trademarks">
        <p>
          The {brand.upstream.name} name and logo are trademarks of their owners
          and are not used to identify {brand.name}. Copyright licences and
          trademarks are separate: the {brand.upstream.license} grants rights in
          the code, not in the upstream brand. The attribution on this page is
          licence compliance, not an endorsement by or affiliation with the{' '}
          {brand.upstream.name} project.
        </p>
      </Section>

      <Section heading="AI model providers">
        <p>
          AI features send content to third-party model providers, which are
          proprietary services rather than open-source components. Which
          providers are enabled depends on this deployment&rsquo;s configuration;
          see the{' '}
          <a className="underline" href={brand.privacyUrl}>
            Privacy Policy
          </a>{' '}
          for what is sent and why, or ask{' '}
          <ContactAddress kind="privacy" />{' '}
          for the current processor register.
        </p>
      </Section>

      <Section heading="Open-source dependencies">
        <p>
          {brand.name} depends on {dependencyLicenses.length} direct open-source
          packages. Each is used under its own licence; the full licence text
          ships inside each package in the source distribution. Transitive
          dependencies carry their own notices.
        </p>
        <div className="flex flex-wrap gap-[8px]">
          {licenseSummary.map((row) => (
            <span
              key={row.license}
              className="text-[12px] px-[10px] py-[4px] rounded-full border border-newBorder text-textItemBlur"
            >
              {row.license} · {row.count}
            </span>
          ))}
        </div>
        <div className="overflow-x-auto mt-[8px]">
          <table className="w-full text-[13px] border-collapse">
            <thead>
              <tr className="text-start text-textItemBlur">
                <th className="text-start py-[8px] border-b border-newBorder">
                  Package
                </th>
                <th className="text-start py-[8px] border-b border-newBorder">
                  Version
                </th>
                <th className="text-start py-[8px] border-b border-newBorder">
                  Licence
                </th>
              </tr>
            </thead>
            <tbody>
              {dependencyLicenses.map((dep) => (
                <tr key={dep.name}>
                  <td className="py-[6px] border-b border-newBorder font-mono">
                    {dep.name}
                  </td>
                  <td className="py-[6px] border-b border-newBorder text-textItemBlur">
                    {dep.version}
                  </td>
                  <td className="py-[6px] border-b border-newBorder">
                    {dep.license}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </LegalPage>
  );
}
