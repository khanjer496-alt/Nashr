import React from 'react';
import Link from 'next/link';
import { brand } from '@gitroom/nashr-brand/brand.config';

/**
 * Compact legal / attribution footer.
 *
 * Carries the AGPL-3.0 §13 attribution and the entry point to the source-code
 * offer on `/licenses`. Do not remove the upstream attribution — it is a licence
 * obligation, not decoration. See MENA_CUSTOMIZATIONS.md § Licence compliance.
 *
 * No hooks and no server-only imports, so it renders from both server layouts
 * and client layouts.
 */
export const BrandFooter = () => {
  return (
    <footer className="w-full flex flex-wrap items-center justify-center gap-x-[12px] gap-y-[4px] text-[11px] leading-[18px] text-textItemBlur">
      <span>
        © {new Date().getFullYear()} {brand.legalName}
      </span>
      <span aria-hidden="true">·</span>
      <Link className="hover:text-newTextColor" href={brand.aboutUrl}>
        About
      </Link>
      <Link className="hover:text-newTextColor" href={brand.termsUrl}>
        Terms
      </Link>
      <Link className="hover:text-newTextColor" href={brand.privacyUrl}>
        Privacy
      </Link>
      <Link className="hover:text-newTextColor" href={brand.licensesUrl}>
        Licences
      </Link>
      <span aria-hidden="true">·</span>
      <Link className="hover:text-newTextColor" href={brand.licensesUrl}>
        {brand.upstream.attribution}
      </Link>
    </footer>
  );
};

export default BrandFooter;
