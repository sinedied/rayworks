import { lazy, Suspense } from 'react';
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom';

import { AuthPage } from '@/components/AuthPage';
import { useAuth } from '@/hooks/AuthContext';
import { AuthCallback } from '@/pages/AuthCallback.tsx';
import { Dashboard } from '@/pages/Dashboard';
import { FormEditor } from '@/pages/FormEditor';
import { PublicForm } from '@/pages/PublicForm';

// Charts are heavy and only the results dashboard needs them. Splitting keeps the public
// form — the page most visitors land on — light.
const FormResults = lazy(() =>
  import('@/pages/FormResults').then((m) => ({ default: m.FormResults }))
);

const REDIRECT_KEY = 'rayforms:redirect-after-auth';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    // Remember the share link so recipients land on the form, not the dashboard.
    sessionStorage.setItem(
      REDIRECT_KEY,
      `${location.pathname}${location.search}`
    );
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (isAuthenticated) {
    const target = sessionStorage.getItem(REDIRECT_KEY);
    sessionStorage.removeItem(REDIRECT_KEY);
    return <Navigate to={target || '/'} replace />;
  }

  return <>{children}</>;
}

function App() {
  return (
    <BrowserRouter>
      {/* ensure all new routes require auth */}
      <Routes>
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route
          path="/auth"
          element={
            <PublicRoute>
              <AuthPage />
            </PublicRoute>
          }
        />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/forms/new"
          element={
            <ProtectedRoute>
              <FormEditor />
            </ProtectedRoute>
          }
        />
        <Route
          path="/forms/:id/edit"
          element={
            <ProtectedRoute>
              <FormEditor />
            </ProtectedRoute>
          }
        />
        <Route
          path="/forms/:id/results"
          element={
            <ProtectedRoute>
              <Suspense
                fallback={
                  <div className="p-8 text-sm text-[var(--text-muted)]">
                    Loading results…
                  </div>
                }
              >
                <FormResults />
              </Suspense>
            </ProtectedRoute>
          }
        />
        {/* Share links are open to anyone: no auth guard, respondents need not sign in. */}
        <Route path="/f/:token" element={<PublicForm />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
