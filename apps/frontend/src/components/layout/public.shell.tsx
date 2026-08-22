import React, { ReactNode } from 'react';
import Link from 'next/link';
import { LogoTextComponent } from '@gitroom/frontend/components/ui/logo-text.component';
import { BrandFooter } from '@gitroom/frontend/components/layout/brand.footer';
import { brand } from '@gitroom/nashr-brand/brand.config';

/**
 * Chrome for signed-out marketing and public information pages. It stays
 * server-rendered and uses a native details disclosure for the mobile menu.
 */
export const PublicShell = ({ children }: { children: ReactNode }) => {
  return (
    <div className="flex flex-col min-h-screen w-full bg-[#080A0F] text-[#F7F7F2]">
      <div className="min-h-[34px] px-[18px] flex items-center justify-center gap-[10px] text-center bg-[#C8FF4D] text-[#080A0F] font-mono text-[10px] sm:text-[11px] font-[700] tracking-[0.08em]">
        ORBILOOM IS OPEN SOURCE
        <Link className="underline underline-offset-2" href={brand.sourceUrl}>
          VIEW SOURCE ↗
        </Link>
      </div>
      <header className="sticky top-0 z-[50] w-full border-b border-[#2A2F3B] bg-[#080A0F]/90 backdrop-blur-xl">
        <div className="relative w-full max-w-[1240px] mx-auto px-[20px] py-[14px] flex items-center justify-between gap-[16px]">
          <Link href="/" aria-label={brand.name}>
            <LogoTextComponent />
          </Link>
          <nav aria-label="Primary" className="hidden lg:flex items-center gap-[24px] text-[13px] font-[600] text-[#9299AA]">
            <Link className="hover:text-[#F7F7F2]" href="/#product">Product</Link>
            <Link className="hover:text-[#F7F7F2]" href="/#interfaces">Interfaces</Link>
            <Link className="hover:text-[#F7F7F2]" href="/#capabilities">Capabilities</Link>
            <Link className="hover:text-[#F7F7F2]" href="/#global">Global</Link>
            <Link className="hover:text-[#F7F7F2]" href="/#pricing">Pricing</Link>
            <Link className="hover:text-[#F7F7F2]" href={brand.sourceUrl}>Open source</Link>
          </nav>
          <div className="hidden sm:flex items-center gap-[10px]">
            <Link href="/auth/login" className="min-h-[44px] px-[16px] flex items-center text-[13px] font-[700] text-[#F7F7F2]">
              Sign in
            </Link>
            <Link href="/auth" className="text-[13px] font-[700] px-[18px] min-h-[44px] flex items-center rounded-full text-[#F7F7F2] bg-[#7357FF] hover:bg-[#6043F2] transition-colors">
              Start free ↗
            </Link>
          </div>
          <details className="group sm:hidden">
            <summary className="flex min-h-[44px] min-w-[44px] cursor-pointer list-none items-center justify-center rounded-full border border-[#2A2F3B] text-[20px] [&::-webkit-details-marker]:hidden" aria-label="Open navigation">
              <span className="group-open:rotate-45 transition-transform" aria-hidden="true">+</span>
            </summary>
            <nav aria-label="Mobile" className="absolute inset-x-[14px] top-[72px] z-[60] grid gap-[4px] rounded-[18px] border border-[#2A2F3B] bg-[#11141C] p-[12px] shadow-2xl">
              {[
                ['Product', '/#product'],
                ['Interfaces', '/#interfaces'],
                ['Capabilities', '/#capabilities'],
                ['Global', '/#global'],
                ['Pricing', '/#pricing'],
                ['Open source', brand.sourceUrl],
              ].map(([label, href]) => (
                <Link key={label} href={href} className="min-h-[44px] flex items-center rounded-[12px] px-[14px] text-[14px] font-[600] hover:bg-[#191D27]">
                  {label}
                </Link>
              ))}
              <div className="grid grid-cols-2 gap-[8px] mt-[8px] pt-[12px] border-t border-[#2A2F3B]">
                <Link href="/auth/login" className="min-h-[44px] flex items-center justify-center rounded-full border border-[#2A2F3B] text-[13px] font-[700]">Sign in</Link>
                <Link href="/auth" className="min-h-[44px] flex items-center justify-center rounded-full bg-[#7357FF] text-[13px] font-[700]">Start free</Link>
              </div>
            </nav>
          </details>
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
