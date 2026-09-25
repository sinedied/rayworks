import { useAppTheme } from '@/hooks/use-theme';

import { BrandHeader } from './BrandHeader';

export function AuthStatePage({
  title,
  message,
  error = false,
}: {
  title: string;
  message: string;
  error?: boolean;
}) {
  useAppTheme();
  return (
    <div className="auth-page">
      <BrandHeader />
      <main className="auth-state">
        {!error && <span className="auth-spinner" aria-hidden="true" />}
        <h1>{title}</h1>
        <p className={error ? 'auth-error' : undefined} role={error ? 'alert' : undefined}>
          {message}
        </p>
      </main>
    </div>
  );
}
