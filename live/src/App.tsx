import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import { AuthPage } from '@/components/AuthPage';
import { useAuth } from '@/hooks/AuthContext';
import { AudiencePage } from '@/pages/AudiencePage';
import { ControlPage } from '@/pages/ControlPage';
import { HomePage } from '@/pages/HomePage';
import { ManagePage } from '@/pages/ManagePage';
import { PresentPage } from '@/pages/PresentPage';

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
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

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

        {/* Presenter routes: sign-in required. */}
        <Route
          path="/"
          element={
            <AuthGuard requireAuth={true}>
              <HomePage />
            </AuthGuard>
          }
        />
        <Route
          path="/manage/:code"
          element={
            <AuthGuard requireAuth={true}>
              <ManagePage />
            </AuthGuard>
          }
        />
        <Route
          path="/control/:code"
          element={
            <AuthGuard requireAuth={true}>
              <ControlPage />
            </AuthGuard>
          }
        />

        {/* Audience routes: intentionally public, no auth guard. */}
        <Route path="/r/:code" element={<AudiencePage />} />
        <Route path="/present/:code" element={<PresentPage />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
