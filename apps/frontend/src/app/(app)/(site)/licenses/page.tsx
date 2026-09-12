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
  description: `Source repositories and AGPL-3.0 notices for the ${brand.name} workspace and website.`,
};

export default async function Page() {
  return (
    <LegalPage
      title="Licences & Source Code"
      subtitle="The publishing workspace and this website have separate source repositories and upstream histories."
    >
      <Callout>
        <strong>PostDelegate’s publishing app is built on BrightBean Studio.</strong>{' '}
        BrightBean provides the foundation for the workspace, calendar, approvals
        and publishing worker. Our app source is maintained in the{' '}
        <a className="underline" href="https://github.com/khanjer496-alt/brightbean-studio">PostDelegate workspace repository</a>.
      </Callout>

      <Section heading="Publishing workspace: BrightBean Studio">
        <p>
          The {brand.name} publishing workspace is now built on{' '}
          <a className="underline" href="https://github.com/brightbeanxyz/brightbean-studio">
            BrightBean Studio
          </a>, whose LICENSE contains the GNU Affero General Public License v3.
          Copyright in the upstream work remains with its authors.
        </p>
        <p>
          Workspace modifications and build instructions are maintained in the{' '}
          <a className="underline" href="https://github.com/khanjer496-alt/brightbean-studio">
            PostDelegate workspace repository
          </a>. Its history identifies the versions of the Django application and
          publishing worker. This repository is separate from the website source below.
        </p>
      </Section>

      <Section heading="Separate credits for this website">
        <p>
          The public marketing website was adapted from the older {brand.upstream.name}-based
          website code. That credit applies to this website’s inherited code, not
          to the BrightBean publishing app.
        </p>
        <p>
          Website upstream: <a className="underline" href={brand.upstream.url}>{brand.upstream.name}</a>{' '}
          ({brand.upstream.license}). Copyright in that inherited code remains
          with its authors. These notices are retained alongside the website source below.
        </p>
      </Section>

      <Section heading="Website source code offer (AGPL-3.0 §13)">
        <p>
          The {brand.upstream.license} requires that everyone who interacts with
          this software over a network is offered the Corresponding Source of the
          exact version they are interacting with — including our modifications.
        </p>
        <p>
          <strong>You can obtain the source code of this website at:</strong>
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
          That repository contains the website source, build instructions and its
          inherited {brand.upstream.name} modifications. If the link is
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

      <Section heading="Changes and deployment versions">
        <p>
          Website branding and public information are maintained in the website
          repository. Workspace branding, access controls and publishing changes
          are maintained in the BrightBean-based workspace repository. Consult
          the corresponding repository history and deployment revision for the
          version of each component you use.
        </p>
      </Section>

      <Section heading="Trademarks">
        <p>
          The {brand.upstream.name} and BrightBean names and logos belong to their respective owners
          and are not used to identify {brand.name}. Copyright licences and
          trademarks are separate: the {brand.upstream.license} grants rights in
          the code, not in the upstream brand. The attribution on this page is
          licence compliance, not an endorsement by or affiliation with the{' '}
          upstream projects.
        </p>
      </Section>

      <Section heading="AI model providers">
        <p>
          When configured, workspace AI features may send content to external model
          providers. These services have their own terms. Which providers are
          enabled depends on the workspace deployment&rsquo;s configuration;
          see the{' '}
          <a className="underline" href={brand.privacyUrl}>
            Privacy Policy
          </a>{' '}
          for what is sent and why, or ask{' '}
          <ContactAddress kind="privacy" />{' '}
          for the current processor register.
        </p>
      </Section>

      <Section heading="Website repository dependencies">
        <p>
          This website repository lists {dependencyLicenses.length} direct open-source
          packages. This inventory describes the inherited JavaScript repository,
          not the Python dependencies of the BrightBean workspace. Workspace
          dependency manifests and notices are in its separate source repository.
          Each package is used under its own licence; the full licence text
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
