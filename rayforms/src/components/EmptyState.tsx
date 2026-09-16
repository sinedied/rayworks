import { ReactNode } from 'react';

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="card px-6 py-14 text-center">
      <h2 className="font-heading text-lg text-[var(--text)]">{title}</h2>
      {description && (
        <p className="mx-auto mt-1.5 max-w-sm text-sm text-[var(--text-muted)]">
          {description}
        </p>
      )}
      {action && <div className="mt-6 flex justify-center">{action}</div>}
    </div>
  );
}
