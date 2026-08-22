import React, { FC, useId } from 'react';
import { brand } from '@gitroom/nashr-brand/brand.config';

/**
 * Orbiloom's interwoven orbital O. The mark itself never mirrors in RTL.
 * Keep it in sync with `apps/frontend/public/orbiloom-mark.svg`.
 */
export const BrandMark: FC<{ size?: number; className?: string }> = ({
  size = 60,
  className,
}) => {
  const rawId = useId();
  const titleId = `orbiloom-mark-${rawId.replace(/:/g, '')}`;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      className={className}
      role="img"
      aria-labelledby={titleId}
    >
      <title id={titleId}>{brand.name}</title>
      <rect width="64" height="64" rx="16" fill="#080A0F" />
      <path
        d="M14.5 38.5C19.7 21.4 39.3 15.1 50.3 24.5C58.4 31.5 48.5 46.7 33 47.8C19.8 48.8 8.7 41.8 13.4 31.1C17.8 21.1 34 17.2 45.4 22.5"
        stroke="#7357FF"
        strokeWidth="4.5"
        strokeLinecap="round"
      />
      <path
        d="M18.4 19.1C29.2 13.4 47.2 20.9 50.7 32.4C54.2 43.9 37.6 51.5 24.8 45.4C12.8 39.7 8.5 27.4 18.4 19.1Z"
        stroke="#F7F7F2"
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray="55 15"
      />
      <circle
        cx="49.2"
        cy="23.7"
        r="4.7"
        fill="#C8FF4D"
        stroke="#080A0F"
        strokeWidth="2.4"
      />
    </svg>
  );
};

export default BrandMark;
