import { useState } from 'react';

import { useAuth } from '@/hooks/AuthContext';
import { RayLiveWordmark } from '@/components/RayLiveWordmark';

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
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-[#f7f9fc]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-[var(--brand-blue)]" />
      <div className="pointer-events-none absolute -top-24 -right-24 h-80 w-80 rounded-full bg-[#2f80ff]/10 blur-3xl" />

      <div className="relative flex flex-1 items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <div className="rounded-3xl border border-[#e5e7eb] bg-white p-8 shadow-[0_24px_70px_-36px_rgba(11,42,91,0.38)]">
            <div className="mb-8 text-center">
              <h1>
                <RayLiveWordmark className="text-2xl" />
              </h1>
              <p className="mt-2 text-sm text-gray-500">
                Sign in to run live Q&amp;A, polls, and quizzes.
              </p>
            </div>

            <button
              type="button"
              onClick={handleSignIn}
              disabled={isLoading}
              className="flex w-full items-center justify-center rounded-xl bg-[var(--brand-blue)] px-4 py-3 text-sm font-medium text-white shadow-md shadow-blue-600/20 transition-all hover:bg-[#246bdb] hover:shadow-lg disabled:opacity-50 disabled:shadow-none"
            >
              {msLogo}
              {buttonLabel}
            </button>

            {error && (
              <p className="mt-3 text-center text-sm text-red-600">{error}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
