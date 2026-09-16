import { ReactNode } from 'react';

import { AppHeader } from '@/components/AppHeader';
import { cn } from '@/lib/utils';

interface PageShellProps {
  children: ReactNode;
  /** `wide` suits the results dashboard; `narrow` suits reading and form filling. */
  width?: 'narrow' | 'regular' | 'wide';
  showSignOut?: boolean;
}

const WIDTHS = {
  narrow: 'max-w-2xl',
  regular: 'max-w-4xl',
  wide: 'max-w-6xl',
} as const;

export function PageShell({
  children,
  width = 'regular',
  showSignOut = true,
}: PageShellProps) {
  return (
    <div className="min-h-screen">
      <AppHeader showSignOut={showSignOut} />
      <main
        className={cn(
          'mx-auto w-full px-4 py-8 sm:px-6 sm:py-12',
          WIDTHS[width]
        )}
      >
        {children}
      </main>
    </div>
  );
}

interface PageTitleProps {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}

export function PageTitle({
  eyebrow,
  title,
  description,
  actions,
}: PageTitleProps) {
  return (
    <div className="fade-in mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <p className="label-caps">{eyebrow}</p>}
        <h1 className="font-heading mt-1 text-2xl text-[var(--text)] sm:text-3xl">
          {title}
        </h1>
        {description && (
          <p className="mt-1.5 max-w-prose text-sm text-[var(--text-muted)]">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex shrink-0 gap-2">{actions}</div>}
    </div>
  );
}
