import { LogOutIcon } from 'lucide-react';
import { Link } from 'react-router-dom';

import { RayFormsWordmark } from '@/components/RayFormsWordmark';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/AuthContext';

/** App-wide header. Sign-out is hidden for anonymous visitors on public form pages. */
export function AppHeader({ showSignOut = true }: { showSignOut?: boolean }) {
  const { user, isAuthenticated, signOut } = useAuth();

  return (
    <header className="sticky top-0 z-20 border-b border-[var(--border-subtle)] bg-[var(--surface)]">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link to="/" className="flex min-w-0 items-center">
          <RayFormsWordmark />
        </Link>

        <div className="flex min-w-0 items-center gap-3">
          {user?.email && (
            <span className="hidden truncate text-sm text-[var(--text-muted)] sm:block">
              {user.email}
            </span>
          )}
          {showSignOut && isAuthenticated && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8"
              onClick={() => signOut()}
            >
              <LogOutIcon className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Sign out</span>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
