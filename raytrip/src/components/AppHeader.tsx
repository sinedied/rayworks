import { Link } from 'react-router-dom';

import { RayTripBrand } from '@/components/RayTripBrand';
import { useAuth } from '@/hooks/AuthContext';

export function AppHeader({ showAccount = true }: { showAccount?: boolean }) {
  const { user, signOut } = useAuth();
  const identity = user?.email || user?.name;

  return (
    <header className="app-header">
      <Link className="app-brand-link" to="/" aria-label="Ray|Trip home">
        <RayTripBrand compact />
      </Link>
      {showAccount && user && (
        <div className="user-menu">
          <span className="user-copy" title={identity}>{identity}</span>
          <button type="button" className="button button-quiet" onClick={() => void signOut()}>
            Sign out
          </button>
        </div>
      )}
    </header>
  );
}
