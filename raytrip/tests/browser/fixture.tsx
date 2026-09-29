import { createRoot } from 'react-dom/client';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { AuthProvider } from '../../src/hooks/AuthContext';
import { AuthPage } from '../../src/components/AuthPage';
import { HomePage } from '../../src/pages/HomePage';
import { TripPage } from '../../src/pages/TripPage';
import { SharedReportPage } from '../../src/pages/SharedReportPage';
import { AppRoutes } from '../../src/AppRoutes';
import '../../src/main.css';

const user = { id: 'owner', name: 'Mobile tester', email: 'phone@example.test' };
const authScenario = new URLSearchParams(location.search).get('scenario') === 'auth';
let failSignIn = authScenario;
const auth = {
  fabricAuthEnabled: true,
  getCurrentUser: async () => authScenario ? null : user,
  initEmbeddedAuth: async () => authScenario ? null : user,
  signIn: async () => {
    await new Promise(resolve => setTimeout(resolve, 100));
    if (failSignIn) { failSignIn = false; throw new Error('Sign-in canceled. Please try again.'); }
    return user;
  },
  signOut: async () => {},
};
export const router = createMemoryRouter(authScenario ? [{ path: '*', element: <AppRoutes /> }] : [
  { path: '/', element: <HomePage /> },
  { path: '/auth', element: <AuthPage /> },
  { path: '/trips/:tripId', element: <TripPage /> },
  { path: '/reports/:shareId', element: <SharedReportPage /> },
], { initialEntries: [new URLSearchParams(location.search).get('route') || '/trips/trip-1'] });
createRoot(document.getElementById('root')!).render(<AuthProvider authService={auth}><RouterProvider router={router} /></AuthProvider>);
