import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

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

  if (loading) return <div className="loading-page">Preparing your travel log…</div>;
  if (requireAuth && !isAuthenticated) return <Navigate to="/auth" replace />;
  if (!requireAuth && isAuthenticated) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function App() {
  return (
    <BrowserRouter>
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
    </BrowserRouter>
  );
}

export default App;
