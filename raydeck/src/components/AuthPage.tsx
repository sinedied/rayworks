import { useAuth } from '@/hooks/AuthContext';
import { useAppTheme } from '@/hooks/use-theme';

import { BrandHeader } from './BrandHeader';

const microsoftLogo = (
  <svg aria-hidden="true" height="18" viewBox="0 0 21 21" width="18">
    <rect x="1" y="1" width="9" height="9" fill="#f25022" />
    <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
    <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
    <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
  </svg>
);

export function AuthPage() {
  useAppTheme();
  const { signIn, signingIn, error } = useAuth();

  return (
    <div className="auth-page">
      <BrandHeader />
      <main className="auth-content">
        <section className="auth-intro">
          <p className="auth-eyebrow">Private Fabric presentations</p>
          <h1>Turn trusted data into a story worth presenting.</h1>
          <p>
            Create, rehearse, and present Ray|Deck narratives inside your
            Microsoft Fabric workspace. Every deck surface requires your Fabric
            identity.
          </p>
        </section>
        <section className="auth-card" aria-labelledby="auth-title">
          <h2 id="auth-title">Sign in to Ray|Deck</h2>
          <p>Continue with Microsoft Fabric to access private decks.</p>
          <button
            className="auth-submit"
            disabled={signingIn}
            onClick={() => void signIn().catch(() => {})}
            type="button"
          >
            {microsoftLogo}
            {signingIn ? 'Opening Fabric…' : 'Sign in with Microsoft'}
          </button>
          {error && <p className="auth-inline-error" role="alert">{error}</p>}
        </section>
      </main>
    </div>
  );
}
