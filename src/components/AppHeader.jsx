'use client';

import Logo from '@/components/Logo';

/**
 * Shared sticky app header — Replit-inspired clean bar with brand lockup.
 */
export default function AppHeader({
  right = null,
  badge = null,
  href = '/',
  onDark = false,
  maxWidthClass = 'max-w-6xl',
}) {
  return (
    <header
      className={`sticky top-0 z-40 border-b backdrop-blur-xl ${
        onDark
          ? 'bg-[#0E1014]/80 border-white/10'
          : 'bg-white/80 border-brand-line'
      }`}
    >
      <div className={`${maxWidthClass} mx-auto px-5 h-14 flex items-center justify-between gap-4`}>
        <div className="flex items-center gap-2.5 min-w-0">
          <Logo size="sm" href={href} onDark={onDark} />
          {badge}
        </div>
        {right ? <div className="flex items-center gap-3 flex-shrink-0">{right}</div> : null}
      </div>
    </header>
  );
}
