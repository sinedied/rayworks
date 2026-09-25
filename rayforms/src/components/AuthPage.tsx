import { useState } from 'react';

import { MockSignInDialog } from '@/components/MockSignInDialog';
import { AppHeader } from '@/components/AppHeader';
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
      aria-hidden="true"
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
    <div className="auth-page">
      <AppHeader showAccount={false} />

      <main className="auth-content">
        <section className="auth-intro">
          <p className="auth-eyebrow">Enterprise form workflows</p>
          <h1>Build the form. Share the link. Collect the answers.</h1>
          <p>
            Create polished forms for your organization, share them in a click,
            and review every response in one focused workspace.
          </p>
        </section>

        <section className="fade-in card auth-card" aria-labelledby="auth-title">
          <h2 id="auth-title">Sign in to Ray|Forms</h2>
          <p>
            Use your Microsoft Fabric identity to manage forms. Respondents can
            use shared links without signing in.
          </p>
          <button
            type="button"
            onClick={handleSignIn}
            disabled={isLoading}
            className="auth-submit"
          >
            {msLogo}
            {buttonLabel}
          </button>
          {error && (
            <p className="auth-inline-error" role="alert">
              {error}
            </p>
          )}
        </section>
      </main>

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
