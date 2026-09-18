import { useState } from 'react';

import { RayTripBrand } from '@/components/RayTripBrand';
import { useAuth } from '@/hooks/AuthContext';

const microsoftLogo = (
  <svg aria-hidden="true" viewBox="0 0 21 21" width="18" height="18">
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

  async function handleSignIn() {
    setError(null);
    setIsLoading(true);
    try {
      await signIn();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Failed to sign in.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="auth-page">
      <header className="auth-header">
        <RayTripBrand />
      </header>
      <section className="auth-content">
        <div className="auth-intro">
          <p className="section-label">Business travel reporting</p>
          <h1>Capture each day. Share what mattered.</h1>
          <p>
            Keep trip notes and photos together, then generate a structured
            report for review and secure sharing.
          </p>
        </div>
        <div className="auth-card">
          <h2>Sign in to Ray|Trip</h2>
          <p>Use your Microsoft Fabric identity to access your trips.</p>
          <button
            type="button"
            className="button button-primary button-full"
            onClick={() => void handleSignIn()}
            disabled={isLoading}
          >
            {microsoftLogo}
            {isLoading
              ? fabricAuthEnabled
                ? 'Opening Fabric…'
                : 'Signing in…'
              : 'Sign in with Microsoft'}
          </button>
          {error && (
            <div className="inline-error" role="alert">
              {error}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
