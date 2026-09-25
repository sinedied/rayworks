import {
  createBrowserRouter,
  Navigate,
  Route,
  Routes,
  RouterProvider,
  useLocation,
} from 'react-router-dom';

import { AppErrorBoundary } from '@/components/AppErrorBoundary';
import { AuthPage } from '@/components/AuthPage';
import { useAuth } from '@/hooks/AuthContext';
import { HomePage } from '@/pages/HomePage';
import { SharedReportPage } from '@/pages/SharedReportPage';
import { TripPage } from '@/pages/TripPage';

function AuthGuard({
  children,
  requireAuth,
}: {
  children: React.ReactNode;
  requireAuth: boolean;
}) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <main className="page-state">
        <div className="spinner" aria-hidden="true" />
        <h1>Preparing Ray|Trip</h1>
        <p>Connecting securely to your Fabric workspace.</p>
      </main>
    );
  }
  if (requireAuth && !isAuthenticated) return <Navigate to="/auth" replace />;
  if (!requireAuth && isAuthenticated) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function AppRoutes() {
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

const router = createBrowserRouter([{ path: '*', element: <AppRoutes /> }]);

function App() {
  return <RouterProvider router={router} />;
}

export default App;
