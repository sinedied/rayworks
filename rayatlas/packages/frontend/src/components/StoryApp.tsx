import { Moon, RefreshCw, Sun } from 'lucide-react';

import rayatlasDark from '@/assets/rayatlas-dark.svg';
import rayatlasLight from '@/assets/rayatlas.svg';
import { StoryExperience } from '@/components/StoryExperience';
import { useAuth } from '@/hooks/auth.context';
import { useNetwork } from '@/hooks/use-network';
import { useTheme } from '@/hooks/theme.context';

function sessionLabel(session: ReturnType<typeof useAuth>['session']): string {
  const user = session?.user;
  if (!user || typeof user !== 'object') return 'Fabric user';

  for (const key of ['email', 'displayName', 'name']) {
    const value = Reflect.get(user, key);
    if (typeof value === 'string' && value.trim()) return value;
  }

  return 'Fabric user';
}

function AppHeader() {
  const { session, signOut } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  return (
    <header className="atlas-header">
      <a href="/" className="atlas-brand" aria-label="Ray Atlas home">
        <img src={isDark ? rayatlasDark : rayatlasLight} alt="Ray Atlas" />
      </a>
      <div className="ml-auto flex min-w-0 items-center gap-200">
        <button
          type="button"
          className="icon-button"
          onClick={toggleTheme}
          aria-label={isDark ? 'Use light theme' : 'Use dark theme'}
        >
          {isDark ? <Sun className="icon-size-200" aria-hidden /> : <Moon className="icon-size-200" aria-hidden />}
        </button>
        <span className="hidden max-w-48 truncate text-300 text-muted-foreground sm:block">
          {sessionLabel(session)}
        </span>
        <button type="button" className="quiet-button" onClick={() => void signOut()}>
          Sign out
        </button>
      </div>
    </header>
  );
}

/** Authenticated Ray|Atlas shell: brand header over the Ridgeline Coffee story map. */
export function StoryApp() {
  const { network, status, error, source, retry } = useNetwork();
  const sampleLabel = source === 'sample' ? 'Sample data' : 'Sample story';

  return (
    <div className="atlas-frame">
      <AppHeader />
      {network ? (
        <>
          {error && (
            <div className="network-warning" role="status">
              <span>Showing the last loaded network. {error}</span>
              <button type="button" className="stage-link" onClick={retry}>Try again</button>
            </div>
          )}
          <StoryExperience network={network} sampleLabel={sampleLabel} />
        </>
      ) : (
        <main className="story-state">
          {status === 'error' ? (
            <div role="alert" className="story-state-panel">
              <h1>The story map couldn’t load</h1>
              <p>{error ?? 'The network data could not be loaded.'}</p>
              <button type="button" className="stage-button" onClick={retry}>
                <RefreshCw className="icon-size-200" aria-hidden />
                Try again
              </button>
            </div>
          ) : (
            <p role="status" className="story-state-loading">
              <span className="story-map-loading-mark" aria-hidden />
              Loading the story map…
            </p>
          )}
        </main>
      )}
    </div>
  );
}
