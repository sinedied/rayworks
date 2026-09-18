import { Link } from 'react-router-dom';

import { RayTripBrand } from '@/components/RayTripBrand';
import { useAuth } from '@/hooks/AuthContext';

export function AppHeader() {
  const { user, signOut } = useAuth();

  return (
    <header className="app-header">
      <Link className="app-brand-link" to="/">
        <RayTripBrand compact />
      </Link>
      <div className="user-menu">
        <span className="user-avatar">
          {(user?.name || user?.email || 'R').slice(0, 1).toUpperCase()}
        </span>
        <span className="user-copy">
          <strong>{user?.name}</strong>
          <small>{user?.email}</small>
        </span>
        <button className="button button-quiet" onClick={() => void signOut()}>
          Sign out
        </button>
      </div>
    </header>
  );
}
