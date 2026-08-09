import React, { FC } from 'react';

/**
 * The Nashr mark: concentric rings radiating from a centre point — "publishing".
 *
 * Deliberately radially symmetric so it is identical in LTR and RTL layouts and
 * never needs mirroring. Keep it in sync with `apps/frontend/public/nashr-mark.svg`.
 */
export const BrandMark: FC<{ size?: number; className?: string }> = ({
  size = 60,
  className,
}) => {
  const id = `nashrMark${size}`;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      className={className}
      role="img"
      aria-label="Nashr"
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#14A79B" />
          <stop offset="1" stopColor="#0B655E" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="15" fill={`url(#${id})`} />
      <g fill="none" stroke="#FFFFFF" strokeLinecap="round">
        <circle cx="32" cy="32" r="21" strokeWidth="3" opacity="0.45" />
        <circle cx="32" cy="32" r="13.5" strokeWidth="3.5" opacity="0.8" />
      </g>
      <circle cx="32" cy="32" r="5.5" fill="#FFFFFF" />
    </svg>
  );
};

export default BrandMark;
