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
    <div className="flex flex-col min-h-screen w-full bg-[#080A0F] text-[#F7F7F2]">
      <header className="w-full border-b border-[#2A2F3B] bg-[#080A0F]/90 backdrop-blur-xl">
        <div className="w-full max-w-[1180px] mx-auto px-[20px] py-[16px] flex items-center justify-between gap-[16px]">
          <Link href="/" aria-label={brand.name}>
            <LogoTextComponent />
          </Link>
          <Link
            href="/auth/login"
            className="text-[14px] font-[700] px-[18px] min-h-[44px] flex items-center rounded-full text-[#F7F7F2] bg-[#7357FF] hover:bg-[#6043F2] transition-colors"
          >
            Sign in
          </Link>
        </div>
      </header>
      <main className="flex flex-1">{children}</main>
      <div className="w-full border-t border-[#2A2F3B] py-[20px] px-[20px]">
        <BrandFooter />
      </div>
    </div>
  );
};

export default PublicShell;
