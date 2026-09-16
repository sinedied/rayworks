import { ReactNode } from 'react';

import { cn } from '@/lib/utils';

interface StatCardProps {
  label: string;
  value: ReactNode;
  hint?: string;
  className?: string;
}

/** A single KPI: small caps label above a prominent figure. */
export function StatCard({ label, value, hint, className }: StatCardProps) {
  return (
    <div className={cn('card p-4', className)}>
      <p className="label-caps">{label}</p>
      <p className="font-heading mt-1.5 text-2xl leading-none text-[var(--text)]">
        {value}
      </p>
      {hint && (
        <p className="mt-1.5 text-xs text-[var(--text-muted)]">{hint}</p>
      )}
    </div>
  );
}
