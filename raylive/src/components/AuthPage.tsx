import { useState } from 'react';

import { useAuth } from '@/hooks/AuthContext';
import { AppHeader } from '@/components/AppHeader';

const msLogo = (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="16"
    height="16"
    viewBox="0 0 21 21"
    className="mr-2"
  >
    <rect x="1" y="1" width="9" height="9" fill="#f25022" />
    <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
    <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
    <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
  </svg>
);

export function AuthPage() {
  const { signIn, fabricAuthEnabled } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSignIn = async () => {
    setError(null);
    setIsLoading(true);

    try {
      await signIn();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign in.');
    } finally {
      setIsLoading(false);
    }
  };

  const buttonLabel = isLoading
    ? fabricAuthEnabled
      ? 'Opening Fabric...'
      : 'Signing in...'
    : 'Sign in with Microsoft';

  return (
    <div className="admin-app flex min-h-screen flex-col">
      <AppHeader showAccount={false} />

      <div className="relative flex flex-1 items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <div className="rounded-lg border border-admin-border bg-white p-7 shadow-sm">
            <div className="mb-6">
              <h1 className="text-xl font-semibold text-admin-heading">Sign in</h1>
              <p className="mt-2 text-sm text-admin-muted">
                Sign in to run live Q&amp;A, polls, and quizzes.
              </p>
            </div>

            <button
              type="button"
              onClick={handleSignIn}
              disabled={isLoading}
              className="admin-primary flex w-full items-center justify-center rounded-lg px-4 py-2.5 text-sm font-medium disabled:opacity-50"
            >
              {msLogo}
              {buttonLabel}
            </button>

            {error && (
              <p className="mt-3 text-center text-sm text-admin-danger">{error}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
