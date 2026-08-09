import React from 'react';
import { BrandMark } from '@gitroom/frontend/components/ui/brand.mark';
import { brand } from '@gitroom/nashr-brand/brand.config';

/**
 * Horizontal lock-up: mark + wordmark. Laid out with flexbox rather than a baked
 * SVG so the order follows the document direction automatically in RTL.
 */
export const LogoTextComponent = () => {
  return (
    <div
      className="flex items-center gap-[10px] text-current"
      aria-label={brand.name}
    >
      <BrandMark size={36} />
      <span className="text-[26px] font-[700] tracking-[-0.02em] leading-none">
        {brand.name}
      </span>
    </div>
  );
};
