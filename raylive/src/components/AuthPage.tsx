import { useState } from 'react';

import { useAuth } from '@/hooks/AuthContext';
import { AppHeader } from '@/components/AppHeader';

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
    <div className="admin-app auth-page">
      <AppHeader showAccount={false} />

      <main className="auth-content">
        <section className="auth-intro">
          <p className="auth-eyebrow">Live audience interaction</p>
          <h1>Ask the room. See the response live.</h1>
          <p>
            Run Q&amp;A, polls, and quizzes from one presenter workspace while
            your audience joins from any device.
          </p>
        </section>

        <section className="auth-card" aria-labelledby="auth-title">
          <h2 id="auth-title">Sign in to Ray|Live</h2>
          <p>Use your Microsoft Fabric identity to create and run rooms.</p>

          <button
            type="button"
            onClick={handleSignIn}
            disabled={isLoading}
            className="admin-primary auth-submit"
          >
            {msLogo}
            {buttonLabel}
          </button>

          {error && (
            <p className="auth-inline-error" role="alert">{error}</p>
          )}
        </section>
      </main>
    </div>
  );
}
