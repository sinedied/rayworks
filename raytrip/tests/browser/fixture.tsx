import { createRoot } from 'react-dom/client';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { AuthProvider } from '../../src/hooks/AuthContext';
import { AuthPage } from '../../src/components/AuthPage';
import { HomePage } from '../../src/pages/HomePage';
import { TripPage } from '../../src/pages/TripPage';
import { SharedReportPage } from '../../src/pages/SharedReportPage';
import '../../src/main.css';

const user = { id: 'owner', name: 'Mobile tester', email: 'phone@example.test' };
const auth = {
  fabricAuthEnabled: true,
  getCurrentUser: async () => user,
  initEmbeddedAuth: async () => user,
  signIn: async () => user,
  signOut: async () => {},
};
export const router = createMemoryRouter([
  { path: '/', element: <HomePage /> },
  { path: '/auth', element: <AuthPage /> },
  { path: '/trips/:tripId', element: <TripPage /> },
  { path: '/reports/:shareId', element: <SharedReportPage /> },
], { initialEntries: [new URLSearchParams(location.search).get('route') || '/trips/trip-1'] });
createRoot(document.getElementById('root')!).render(<AuthProvider authService={auth}><RouterProvider router={router} /></AuthProvider>);
