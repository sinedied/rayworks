import {
  Navigate,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom';

import { AppErrorBoundary } from '@/components/AppErrorBoundary';
import { AuthPage } from '@/components/AuthPage';
import { useAuth } from '@/hooks/AuthContext';
import { HomePage } from '@/pages/HomePage';
import { SharedReportPage } from '@/pages/SharedReportPage';
import { TripPage } from '@/pages/TripPage';

function returnPath(state: unknown): string {
  if (!state || typeof state !== 'object' || !('returnTo' in state)
    || typeof state.returnTo !== 'string' || !state.returnTo.startsWith('/')
    || state.returnTo.startsWith('//') || /[\\\s]/.test(state.returnTo)) return '/';
  const target = new URL(state.returnTo, window.location.origin);
  if (target.origin !== window.location.origin
    || (target.pathname !== '/' && !/^\/(?:trips|reports)\/[^/]+$/.test(target.pathname))) return '/';
  return `${target.pathname}${target.search}${target.hash}`;
}

function AuthGuard({
  children,
  requireAuth,
}: {
  children: React.ReactNode;
  requireAuth: boolean;
}) {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <main className="page-state">
        <div className="spinner" aria-hidden="true" />
        <h1>Preparing Ray|Trip</h1>
        <p>Connecting securely to your Fabric workspace.</p>
      </main>
    );
  }
  if (requireAuth && !isAuthenticated) {
    return <Navigate to="/auth" state={{ returnTo: `${location.pathname}${location.search}${location.hash}` }} replace />;
  }
  if (!requireAuth && isAuthenticated) return <Navigate to={returnPath(location.state)} replace />;
  return <>{children}</>;
}

export function AppRoutes() {
  const location = useLocation();

  return (
    <AppErrorBoundary resetKey={location.pathname}>
      <Routes>
        <Route
          path="/auth"
          element={
            <AuthGuard requireAuth={false}>
              <AuthPage />
            </AuthGuard>
          }
        />
        <Route
          path="/"
          element={
            <AuthGuard requireAuth>
              <HomePage />
            </AuthGuard>
          }
        />
        <Route
          path="/trips/:tripId"
          element={
            <AuthGuard requireAuth>
              <TripPage />
            </AuthGuard>
          }
        />
        <Route
          path="/reports/:shareId"
          element={
            <AuthGuard requireAuth>
              <SharedReportPage />
            </AuthGuard>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppErrorBoundary>
  );
}
