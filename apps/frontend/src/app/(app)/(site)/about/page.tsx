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
      <Section heading="What Nashr is">
        <p>
          {brand.name} ({brand.nameAr} — Arabic for &ldquo;publishing&rdquo;) is a
          social media management platform built for teams working in the Middle
          East. Plan a content calendar, route posts through internal review and
          client approval, schedule across every connected channel, and measure
          what happened afterwards — from one workspace.
        </p>
        <p>
          It is designed for the people who actually run the accounts:
          restaurants and hospitality groups, marketing agencies managing several
          client brands, salons and clinics, and small businesses that publish
          themselves.
        </p>
      </Section>

      <Section heading="Built for the region">
        <ul className="list-disc ps-[22px] flex flex-col gap-[6px]">
          <li>
            <strong>Arabic and English, side by side.</strong> The interface runs
            right-to-left or left-to-right, and a single workspace can publish in
            both languages.
          </li>
          <li>
            <strong>Gulf time by default.</strong> Scheduling assumes{' '}
            {brand.defaultTimezone} unless a workspace says otherwise, so
            &ldquo;9am&rdquo; means 9am where your audience is.
          </li>
          <li>
            <strong>Agency-shaped.</strong> Multiple client brands, separate
            channel sets, and an approval step before anything goes out.
          </li>
        </ul>
        <p className="text-textItemBlur text-[14px]">
          Initial market: the United Arab Emirates, expanding across Saudi
          Arabia, Kuwait, Qatar, Bahrain, Oman, Egypt and Jordan.
        </p>
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
