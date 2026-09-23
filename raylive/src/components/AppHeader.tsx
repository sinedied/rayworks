import { Link } from 'react-router-dom';

import { RayLiveWordmark } from '@/components/RayLiveWordmark';
import { useAuth } from '@/hooks/AuthContext';

export function AppHeader({ showAccount = true }: { showAccount?: boolean }) {
  const { user, signOut } = useAuth();
  const identity = user?.email || user?.name;

  return (
    <header className="app-header">
      <Link to="/" className="app-brand-link" aria-label="Ray|Live home">
        <RayLiveWordmark />
      </Link>
      {showAccount && user && (
        <div className="app-account">
          <span className="app-identity" title={identity}>{identity}</span>
          <button type="button" className="app-sign-out" onClick={() => void signOut()}>
            Sign out
          </button>
        </div>
      )}
    </header>
  );
}
