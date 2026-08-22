import React, { FC, ReactNode } from 'react';
import { brand } from '@gitroom/nashr-brand/brand.config';

/**
 * Shared chrome for the public information pages (/about, /terms, /privacy,
 * /licenses). Deliberately plain: no animation, no client JS, fast to render.
 */
export const LegalPage: FC<{
  title: string;
  subtitle?: string;
  updated?: string;
  children: ReactNode;
}> = ({ title, subtitle, updated, children }) => {
  return (
    // `dir="ltr"` isolates this subtree from an RTL document.
    //
    // These pages are English prose and are not yet translated. Rendered inside
    // `<html dir="rtl">` the Unicode bidi algorithm moves neutral characters --
    // sentence-final periods, colons -- to the wrong edge, producing output like
    // ":You can obtain the complete source code of Orbiloom at". That is not
    // cosmetic here: this component renders the AGPL section 13 source offer,
    // which has to be legible.
    //
    // Remove this only when the legal copy is genuinely translated, not before.
    <div dir="ltr" className="flex-1 w-full">
      <div className="w-full max-w-[860px] mx-auto px-[20px] py-[40px] flex flex-col gap-[28px]">
        <header className="flex flex-col gap-[8px]">
          <div className="text-[12px] uppercase tracking-[0.18em] font-[600] text-brand-primarySoft">
            {brand.name} · {brand.nameAr}
          </div>
          <h1 className="text-[34px] leading-[1.15] font-[700]">{title}</h1>
          {!!subtitle && (
            <p className="text-[15px] leading-[24px] text-textItemBlur">
              {subtitle}
            </p>
          )}
          {!!updated && (
            <p className="text-[13px] text-textItemBlur">Last updated: {updated}</p>
          )}
        </header>
        <div className="flex flex-col gap-[28px] text-[15px] leading-[26px]">
          {children}
        </div>
      </div>
    </div>
  );
};

export const Section: FC<{ heading: string; children: ReactNode }> = ({
  heading,
  children,
}) => (
  <section className="flex flex-col gap-[10px]">
    <h2 className="text-[20px] font-[700] leading-[1.3]">{heading}</h2>
    {children}
  </section>
);

export const Callout: FC<{ tone?: 'warning' | 'info'; children: ReactNode }> = ({
  tone = 'info',
  children,
}) => (
  <div
    className={`rounded-[10px] px-[16px] py-[14px] text-[14px] leading-[22px] border ${
      tone === 'warning'
        ? 'border-brand-warning bg-brand-warning/10'
        : 'border-brand-primary bg-brand-primary/10'
    }`}
  >
    {children}
  </div>
);

/**
 * Rendered wherever the copy depends on a legal identity that has not been
 * configured yet. Orbiloom must not invent an entity name or a jurisdiction.
 */
export const PlaceholderNotice: FC<{ what: string }> = ({ what }) => (
  <Callout tone="warning">
    <strong>Placeholder — requires legal review.</strong> {what} This text is a
    working draft written by the engineering team. It has <em>not</em> been
    reviewed by a qualified lawyer and is not yet fit to be relied on by
    customers.
  </Callout>
);

export const Entity: FC = () =>
  brand.legal.isConfigured ? (
    <>{brand.legal.entityName}</>
  ) : (
    <span className="underline decoration-dotted" title="Set NEXT_PUBLIC_BRAND_LEGAL_NAME">
      [legal entity not configured]
    </span>
  );

export const Jurisdiction: FC = () =>
  brand.legal.jurisdiction ? (
    <>{brand.legal.jurisdiction}</>
  ) : (
    <span className="underline decoration-dotted" title="Set NEXT_PUBLIC_BRAND_JURISDICTION">
      [jurisdiction not configured]
    </span>
  );
