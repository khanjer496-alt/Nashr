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
  const entryHref = brand.publicPreview ? '/status' : `${brand.workspaceUrl}/accounts/login/`;
  const entryLabel = brand.publicPreview ? 'View launch status' : 'Open workspace';
  return (
    <div className="flex flex-col min-h-screen w-full bg-[#FAF9F6] text-[#191825]">
      <header className="sticky top-0 z-[50] w-full border-b border-[#DFDCE8] bg-[#FAF9F6] text-[#191825]">
        <div className="relative w-full max-w-[1240px] mx-auto px-[20px] py-[14px] flex items-center justify-between gap-[16px]">
          <Link href="/" aria-label={brand.name}>
            <LogoTextComponent />
          </Link>
          <nav aria-label="Primary" className="hidden lg:flex items-center gap-[24px] text-[13px] font-[600] text-[#626071]">
            <Link className="hover:text-[#6543BB]" href="/#product">Product</Link>
            <Link className="hover:text-[#6543BB]" href="/#interfaces">Interfaces</Link>
            <Link className="hover:text-[#6543BB]" href="/#capabilities">Capabilities</Link>
            <Link className="hover:text-[#6543BB]" href="/#pricing">Pricing</Link>
          </nav>
          <div className="hidden sm:flex items-center gap-[10px]">
            <Link href={entryHref} className="text-[13px] font-[700] px-[18px] min-h-[44px] flex items-center rounded-full text-[#F7F7F2] bg-[#7357FF] hover:bg-[#6043F2] transition-colors">
              {entryLabel} ↗
            </Link>
          </div>
          <details className="group lg:hidden">
            <summary className="flex min-h-[44px] min-w-[44px] cursor-pointer list-none items-center justify-center rounded-full border border-[#DFDCE8] text-[20px] [&::-webkit-details-marker]:hidden" aria-label="Open navigation">
              <span className="group-open:rotate-45 transition-transform" aria-hidden="true">+</span>
            </summary>
            <nav aria-label="Mobile" className="absolute inset-x-[14px] top-[72px] z-[60] grid gap-[4px] rounded-[18px] border border-[#DFDCE8] bg-[#FAF9F6] p-[12px] shadow-2xl">
              {[
                ['Product', '/#product'],
                ['Interfaces', '/#interfaces'],
                ['Capabilities', '/#capabilities'],
                ['Pricing', '/#pricing'],
              ].map(([label, href]) => (
                <Link key={label} href={href} className="min-h-[44px] flex items-center rounded-[12px] px-[14px] text-[14px] font-[600] hover:bg-[#F0EAFD]">
                  {label}
                </Link>
              ))}
              <div className="grid mt-[8px] pt-[12px] border-t border-[#DFDCE8]">
                <Link href={entryHref} className="min-h-[44px] flex items-center justify-center rounded-full bg-[#7357FF] text-[#F7F7F2] text-[13px] font-[700]">{entryLabel}</Link>
              </div>
            </nav>
          </details>
        </div>
      </header>
      <main className="flex flex-1">{children}</main>
      <div className="w-full border-t border-[#DFDCE8] py-[28px] px-[20px]" style={{ color: '#626071', '--new-textItemBlur': '#626071' } as React.CSSProperties}>
        <BrandFooter />
      </div>
    </div>
  );
};

export default PublicShell;
