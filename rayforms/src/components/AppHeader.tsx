import { Link } from 'react-router-dom';

import { RayFormsWordmark } from '@/components/RayFormsWordmark';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/AuthContext';

/** App-wide header. Sign-out is hidden for anonymous visitors on public form pages. */
export function AppHeader({
  showSignOut = true,
  showAccount = true,
}: {
  showSignOut?: boolean;
  showAccount?: boolean;
}) {
  const { user, isAuthenticated, signOut } = useAuth();
  const identity = user?.email || user?.name;

  return (
    <header className="app-header">
      <Link to="/" className="flex shrink-0 items-center" aria-label="Ray|Forms home">
        <RayFormsWordmark />
      </Link>

      {showAccount && (
        <div className="flex min-w-0 items-center gap-3">
          {identity && (
            <span className="hidden truncate text-sm text-[var(--text-muted)] sm:block" title={identity}>
              {identity}
            </span>
          )}
          {showSignOut && isAuthenticated && (
            <Button
              variant="ghost"
              className="shrink-0"
              onClick={() => signOut()}
            >
              Sign out
            </Button>
          )}
        </div>
      )}
    </header>
  );
}
