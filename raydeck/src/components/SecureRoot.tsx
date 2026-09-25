import App from '@/App';
import { audienceSessionId } from '@/presentation/session';
import { useAuth } from '@/hooks/AuthContext';

import { AudienceView } from './AudienceView';
import { AuthPage } from './AuthPage';
import { AuthStatePage } from './AuthStatePage';

export function SecureRoot() {
  const { user, loading, error, isAuthenticated, signOut, signingOut } = useAuth();
  const audienceRequested = new URLSearchParams(window.location.hash.slice(1)).has('audience');

  if (loading) {
    return (
      <AuthStatePage
        title="Preparing Ray|Deck"
        message="Connecting securely to your Fabric workspace."
      />
    );
  }

  if (!isAuthenticated || !user) return <AuthPage />;

  if (audienceRequested) {
    return <AudienceView sessionId={audienceSessionId(window.location.hash)} />;
  }

  return (
    <App
      authError={error}
      identity={user.email || user.name}
      onSignOut={signOut}
      signingOut={signingOut}
    />
  );
}
