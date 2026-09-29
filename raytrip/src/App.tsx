import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { AppRoutes } from '@/AppRoutes';

const router = createBrowserRouter([{ path: '*', element: <AppRoutes /> }]);

export default function App() {
  return <RouterProvider router={router} />;
}
