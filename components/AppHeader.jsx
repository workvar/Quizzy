'use client';

import { MdButton } from '@awc-ui/react';
import Logo from '@/components/Logo';

/**
 * Shared sticky app header — MD3 surface tokens + brand lockup.
 */
export default function AppHeader({
  right = null,
  badge = null,
  href = '/',
  onDark = false,
  maxWidthClass = 'max-w-6xl',
  title = '',
}) {
  return (
    <header
      data-theme={onDark ? 'dark' : undefined}
      className="sticky top-0 z-40 border-b backdrop-blur-xl"
      style={{
        background: 'color-mix(in srgb, var(--md-sys-color-surface) 88%, transparent)',
        borderColor: 'var(--md-sys-color-outline-variant)',
      }}
      role="banner"
    >
      <div className={`${maxWidthClass} mx-auto px-5 h-14 flex items-center justify-between gap-4`}>
        <div className="flex items-center gap-2.5 min-w-0">
          <Logo size="sm" href={href} onDark={onDark} />
          {badge}
          {title ? (
            <span className="font-display font-semibold text-sm truncate text-[var(--md-sys-color-on-surface)]">
              {title}
            </span>
          ) : null}
        </div>
        {right ? <div className="flex items-center gap-2 flex-shrink-0">{right}</div> : null}
      </div>
    </header>
  );
}

/** Convenience logout / text action button for headers */
export function HeaderAction({ children, onClick, href, icon, variant = 'text' }) {
  return (
    <MdButton
      variant={variant}
      size="sm"
      icon={icon}
      href={href}
      onMdClick={onClick ? () => onClick() : undefined}
    >
      {children}
    </MdButton>
  );
}
