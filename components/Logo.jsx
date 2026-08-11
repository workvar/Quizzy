'use client';

import Link from 'next/link';
import { useId } from 'react';

const SIZES = {
  sm: 24,
  md: 32,
  lg: 48,
  xl: 64,
  hero: 80,
};

/** Quizzy mark — stylized Q with quiz pointer, Replit-inspired orange gradient. */
export function LogoMark({ size = 'md', className = '' }) {
  const px = typeof size === 'number' ? size : (SIZES[size] || SIZES.md);
  const uid = useId().replace(/:/g, '');
  const gradId = `qzMarkGrad-${uid}`;
  return (
    <svg
      width={px}
      height={px}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`flex-shrink-0 ${className}`}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradId} x1="8" y1="4" x2="56" y2="60" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FF8A4C" />
          <stop offset="0.55" stopColor="#F26207" />
          <stop offset="1" stopColor="#E24A0F" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill={`url(#${gradId})`} />
      <path
        d="M32 14c-9.94 0-18 8.06-18 18 0 7.2 4.23 13.42 10.35 16.3L21.2 54.4c-.55.95.14 2.15 1.24 2.15h9.52c.45 0 .87-.24 1.1-.63L38.3 47.5A17.9 17.9 0 0 0 50 32c0-9.94-8.06-18-18-18Zm0 8.5a9.5 9.5 0 1 1 0 19 9.5 9.5 0 0 1 0-19Z"
        fill="#fff"
      />
      <circle cx="32" cy="32" r="4.25" fill="#fff" fillOpacity="0.92" />
    </svg>
  );
}

/**
 * Full Quizzy brand lockup (mark + wordmark).
 * Use `hero` on login / branded first viewports so the brand leads.
 */
export default function Logo({
  size = 'md',
  href = '/',
  showWordmark = true,
  wordmarkClassName = '',
  className = '',
  onDark = false,
}) {
  const content = (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoMark size={size} />
      {showWordmark && (
        <span
          className={`font-display font-bold tracking-tight leading-none ${
            onDark ? 'text-white' : 'text-brand-ink'
          } ${
            size === 'hero' || size === 'xl' ? 'text-3xl sm:text-4xl' :
            size === 'lg' ? 'text-2xl' :
            size === 'sm' ? 'text-base' : 'text-lg'
          } ${wordmarkClassName}`}
        >
          Quizzy
        </span>
      )}
    </span>
  );

  if (!href) return content;
  return (
    <Link href={href} className="inline-flex focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange focus-visible:ring-offset-2 rounded-lg">
      {content}
    </Link>
  );
}
