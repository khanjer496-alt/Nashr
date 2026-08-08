import React, { ReactNode } from 'react';
import Link from 'next/link';
import { LogoTextComponent } from '@gitroom/frontend/components/ui/logo-text.component';
import { BrandFooter } from '@gitroom/frontend/components/layout/brand.footer';
import { brand } from '@gitroom/nashr-brand/brand.config';

/**
 * Chrome for the signed-out public pages. Intentionally minimal — no data
 * fetching, no client JS — so the legal pages render for anyone, including
 * someone who has never signed in.
 */
export const PublicShell = ({ children }: { children: ReactNode }) => {
  return (
    <div className="flex flex-col min-h-screen w-full text-newTextColor">
      <header className="w-full border-b border-newBorder">
        <div className="w-full max-w-[860px] mx-auto px-[20px] py-[18px] flex items-center justify-between gap-[16px]">
          <Link href="/" aria-label={brand.name}>
            <LogoTextComponent />
          </Link>
          <Link
            href="/auth/login"
            className="text-[14px] font-[600] px-[16px] h-[38px] flex items-center rounded-[8px] text-white bg-brand-primary hover:bg-brand-primaryHover transition-colors"
          >
            Sign in
          </Link>
        </div>
      </header>
      <main className="flex flex-1">{children}</main>
      <div className="w-full border-t border-newBorder py-[20px] px-[20px]">
        <BrandFooter />
      </div>
    </div>
  );
};

export default PublicShell;
