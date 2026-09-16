import { useState } from 'react';

import { MockSignInDialog } from '@/components/MockSignInDialog';
import { RayFormsWordmark } from '@/components/RayFormsWordmark';
import { useAuth } from '@/hooks/AuthContext';

export function AuthPage() {
  const { signInWithFabric, signInLocally, fabricAuthEnabled } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [mockDialogOpen, setMockDialogOpen] = useState(false);

  const handleFabricSignIn = async () => {
    setError(null);
    setIsLoading(true);

    try {
      await signInWithFabric();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to sign in with Fabric.'
      );
      setIsLoading(false);
    }
  };

  const handleMockSignIn = async (email: string) => {
    setError(null);
    setIsLoading(true);
    setMockDialogOpen(false);

    try {
      await signInLocally(email);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to sign in locally.'
      );
    } finally {
      setIsLoading(false);
    }
  };

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

  const handleSignIn = fabricAuthEnabled
    ? handleFabricSignIn
    : () => setMockDialogOpen(true);

  const buttonLabel = isLoading
    ? fabricAuthEnabled
      ? 'Opening Fabric...'
      : 'Signing in...'
    : 'Sign in with Microsoft';

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex h-14 items-center border-b border-[var(--border-subtle)] bg-[var(--surface)] px-4 sm:px-6">
        <RayFormsWordmark className="text-[17px]" />
      </header>

      <div className="flex flex-1 items-center justify-center p-4">
        <div className="fade-in card w-full max-w-sm p-7">
          <h1 className="font-heading text-xl text-[var(--text)]">Sign in</h1>
          <p className="mt-2 text-sm leading-relaxed text-[var(--text-muted)]">
            Continue with Microsoft Fabric to manage your forms. Responding to a
            shared form never requires an account.
          </p>
          <button
            type="button"
            onClick={handleSignIn}
            disabled={isLoading}
            className="mt-6 flex w-full items-center justify-center rounded-md bg-[var(--brand)] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[var(--brand-hover)] disabled:opacity-50"
          >
            {msLogo}
            {buttonLabel}
          </button>
          {error && (
            <p className="mt-3 text-center text-sm text-[var(--danger)]">
              {error}
            </p>
          )}
        </div>
      </div>

      {!fabricAuthEnabled && (
        <MockSignInDialog
          open={mockDialogOpen}
          onConfirm={handleMockSignIn}
          onCancel={() => setMockDialogOpen(false)}
        />
      )}
    </div>
  );
}
