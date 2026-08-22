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
  // Orbiloom. Showing them under our brand would misrepresent them, so the block
  // stays hidden until Orbiloom has quotes collected with permission.
  const showTestimonials = process.env.NEXT_PUBLIC_SHOW_TESTIMONIALS === 'true';

  return (
    <div className="relative overflow-hidden bg-[#080A0F] flex flex-1 p-[12px] gap-[12px] min-h-screen w-screen text-[#F7F7F2]">
      {/*<style>{`html, body {overflow-x: hidden;}`}</style>*/}
      <ReturnUrlComponent />
      <div className="relative z-[1] flex flex-col py-[40px] px-[20px] flex-1 lg:w-[600px] lg:flex-none rounded-[18px] text-[#F7F7F2] p-[12px] bg-[#11141C] border border-[#2A2F3B]">
        <div className="w-full max-w-[440px] mx-auto justify-center gap-[20px] h-full flex flex-col text-[#F7F7F2]">
          <LogoTextComponent />
          <div className="flex">{children}</div>
          <BrandFooter />
        </div>
      </div>
      <div className="relative z-[1] text-[36px] flex-1 pt-[88px] hidden lg:flex flex-col items-center">
        <div className="max-w-[720px] text-center px-[48px]">
          <span className="font-mono text-[13px] uppercase tracking-[0.18em] text-[#C8FF4D]">Every channel · one orbit</span>
          <br />
          <span className="mt-[18px] inline-block text-[clamp(38px,5vw,72px)] font-[700] leading-[0.98] tracking-[-0.045em]">
            {t('auth_tagline', brand.heroLine)}
          </span>
          <p className="mx-auto mt-[28px] max-w-[620px] text-[18px] leading-[1.6] text-[#9299AA]">
            {brand.tagline}.
          </p>
        </div>
        {showTestimonials && <TestimonialComponent />}
      </div>
      <div aria-hidden="true" className="pointer-events-none absolute -end-[220px] top-[30px] h-[520px] w-[760px] rounded-[50%] border border-[#7357FF]/50 rotate-[-14deg]" />
      <div aria-hidden="true" className="pointer-events-none absolute end-[110px] top-[90px] h-[12px] w-[12px] rounded-full bg-[#C8FF4D] shadow-[0_0_40px_rgba(200,255,77,0.85)]" />
    </div>
  );
}
