import { getT } from '@gitroom/react/translation/get.translation.service.backend';

export const dynamic = 'force-dynamic';
import { ReactNode } from 'react';
import loadDynamic from 'next/dynamic';
import { TestimonialComponent } from '@gitroom/frontend/components/auth/testimonial.component';
import { LogoTextComponent } from '@gitroom/frontend/components/ui/logo-text.component';
import { BrandFooter } from '@gitroom/frontend/components/layout/brand.footer';
import { brand } from '@gitroom/nashr-brand/brand.config';
const ReturnUrlComponent = loadDynamic(() => import('./return.url.component'));
export default async function AuthLayout({
  children,
}: {
  children: ReactNode;
}) {
  const t = await getT();

  // Upstream renders third-party testimonials that were given to Postiz, not to
  // Nashr. Showing them under our brand would misrepresent them, so the block is
  // kept but hidden behind a flag until Nashr has its own customer quotes.
  const showTestimonials = process.env.NEXT_PUBLIC_SHOW_TESTIMONIALS === 'true';

  return (
    <div className="bg-[#0E0E0E] flex flex-1 p-[12px] gap-[12px] min-h-screen w-screen text-white">
      {/*<style>{`html, body {overflow-x: hidden;}`}</style>*/}
      <ReturnUrlComponent />
      <div className="flex flex-col py-[40px] px-[20px] flex-1 lg:w-[600px] lg:flex-none rounded-[12px] text-white p-[12px] bg-[#1A1919]">
        <div className="w-full max-w-[440px] mx-auto justify-center gap-[20px] h-full flex flex-col text-white">
          <LogoTextComponent />
          <div className="flex">{children}</div>
          <BrandFooter />
        </div>
      </div>
      <div className="text-[36px] flex-1 pt-[88px] hidden lg:flex flex-col items-center">
        <div className="text-center">
          <span className="text-[42px] text-brand-primarySoft">{brand.name}</span>
          <br />
          {t('auth_tagline', brand.tagline)}
        </div>
        {showTestimonials && <TestimonialComponent />}
      </div>
    </div>
  );
}
