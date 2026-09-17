import { Link } from 'react-router-dom';

import { useAuth } from '@/hooks/AuthContext';

export function AppHeader() {
  const { user, signOut } = useAuth();

  return (
    <header className="app-header">
      <Link className="brand" to="/">
        <span className="brand-mark">R|T</span>
        <span>
          <strong>Ray|Trip</strong>
          <small>Field notes to final report</small>
        </span>
      </Link>
      <div className="user-menu">
        <span className="user-avatar">
          {(user?.name || user?.email || 'R').slice(0, 1).toUpperCase()}
        </span>
        <span className="user-copy">
          <strong>{user?.name}</strong>
          <small>{user?.email}</small>
        </span>
        <button className="text-button" onClick={() => void signOut()}>
          Sign out
        </button>
      </div>
    </header>
  );
}
