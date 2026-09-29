// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { AppRoutes } from '../src/AppRoutes';
import { AuthProvider, useAuth } from '../src/hooks/AuthContext';
import type { AuthUser } from '../src/services/IAuthService';

const reads = vi.hoisted(() => ({ home: vi.fn(), trip: vi.fn(), report: vi.fn() }));
vi.mock('@/pages/HomePage', () => ({ HomePage: () => { reads.home(); return <p>Private dashboard</p>; } }));
vi.mock('@/pages/TripPage', () => ({ TripPage: () => { reads.trip(); return <p>Private trip</p>; } }));
vi.mock('@/pages/SharedReportPage', () => ({ SharedReportPage: () => { reads.report(); return <p>Authenticated report</p>; } }));

const user: AuthUser = { id: 'owner', email: 'owner@example.test', name: 'Owner' };
const auth = {
  fabricAuthEnabled: true,
  initEmbeddedAuth: vi.fn<() => Promise<AuthUser | null>>(),
  getCurrentUser: vi.fn<() => Promise<AuthUser | null>>(),
  signIn: vi.fn<() => Promise<AuthUser>>(),
  signOut: vi.fn<() => Promise<void>>(),
};
const routers: ReturnType<typeof createMemoryRouter>[] = [];

function SessionControls() {
  const { isAuthenticated, signOut } = useAuth();
  return isAuthenticated ? <button onClick={() => void signOut()}>End session</button> : null;
}

function mount(path = '/', state?: unknown) {
  const router = createMemoryRouter([{ path: '*', element: <AppRoutes /> }], {
    initialEntries: [{ pathname: path.split(/[?#]/)[0], search: path.includes('?') ? `?${path.split('?')[1].split('#')[0]}` : '',
      hash: path.includes('#') ? `#${path.split('#')[1]}` : '', state }],
  });
  routers.push(router);
  render(<AuthProvider authService={auth}><SessionControls /><RouterProvider router={router} /></AuthProvider>);
  return router;
}

beforeEach(() => {
  vi.resetAllMocks();
  auth.initEmbeddedAuth.mockResolvedValue(null);
  auth.getCurrentUser.mockResolvedValue(null);
  auth.signIn.mockResolvedValue(user);
  auth.signOut.mockResolvedValue();
});
afterEach(() => {
  cleanup();
  routers.splice(0).forEach(router => router.dispose());
});

describe('branded sign-in and protected routing', () => {
  it.each(['/', '/auth', '/trips/trip-1', '/reports/share-1'])('shows branded sign-in at %s without rendering private pages', async path => {
    const router = mount(path);
    expect(await screen.findByRole('heading', { name: 'Sign in to Ray|Trip' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Capture each day. Share what mattered.' })).toBeTruthy();
    expect(router.state.location.pathname).toBe('/auth');
    expect(reads.home).not.toHaveBeenCalled();
    expect(reads.trip).not.toHaveBeenCalled();
    expect(reads.report).not.toHaveBeenCalled();
  });

  it.each(['/trips/trip-1?tab=report#summary', '/reports/share-1?view=full#takeaways'])('returns to the complete requested URL %s after login', async path => {
    const router = mount(path);
    fireEvent.click(await screen.findByRole('button', { name: 'Sign in with Microsoft' }));
    await waitFor(() => {
      const { pathname, search, hash } = router.state.location;
      expect(`${pathname}${search}${hash}`).toBe(path);
    });
    expect(auth.signIn).toHaveBeenCalledOnce();
  });

  it('keeps the card mounted during sign-in and displays cancellation before retry', async () => {
    let rejectLogin!: (error: Error) => void;
    auth.signIn.mockReturnValueOnce(new Promise((_resolve, reject) => { rejectLogin = reject; }));
    mount('/reports/share-1');
    const button = await screen.findByRole('button', { name: 'Sign in with Microsoft' });
    const card = button.closest('.auth-card');
    fireEvent.click(button);
    expect(await screen.findByRole('button', { name: 'Opening Fabric…' })).toBe(button);
    expect(button).toHaveProperty('disabled', true);
    expect(document.querySelector('.auth-card')).toBe(card);
    expect(reads.report).not.toHaveBeenCalled();
    await act(async () => rejectLogin(new Error('Sign-in canceled. Try again.')));
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Sign-in canceled. Try again.');
    expect(button).toHaveProperty('disabled', false);
    fireEvent.click(button);
    expect(await screen.findByText('Authenticated report')).toBeTruthy();
    expect(auth.signIn).toHaveBeenCalledTimes(2);
  });

  it('waits for embedded authentication before showing private content', async () => {
    let resolveSession!: (value: AuthUser | null) => void;
    auth.initEmbeddedAuth.mockReturnValue(new Promise(resolve => { resolveSession = resolve; }));
    mount('/trips/trip-1');
    expect(screen.getByRole('heading', { name: 'Preparing Ray|Trip' })).toBeTruthy();
    expect(reads.trip).not.toHaveBeenCalled();
    expect(auth.getCurrentUser).not.toHaveBeenCalled();
    await act(async () => resolveSession(user));
    expect(await screen.findByText('Private trip')).toBeTruthy();
    expect(auth.getCurrentUser).not.toHaveBeenCalled();
  });

  it('uses an existing session and returns to branded sign-in after sign-out', async () => {
    auth.getCurrentUser.mockResolvedValue(user);
    mount('/trips/trip-1');
    expect(await screen.findByText('Private trip')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Sign in to Ray|Trip' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'End session' }));
    expect(await screen.findByRole('heading', { name: 'Sign in to Ray|Trip' })).toBeTruthy();
    expect(screen.queryByText('Private trip')).toBeNull();
    expect(auth.signOut).toHaveBeenCalledOnce();
  });

  it.each([undefined, {}, { returnTo: 123 }, { returnTo: 'https://evil.example/' },
    { returnTo: '//evil.example/' }, { returnTo: '/\\evil.example/' },
    { returnTo: '/auth' }, { returnTo: '/unknown' }, { returnTo: '/\n/evil.example' }])(
    'falls back to the dashboard for an absent or unsafe return destination: %j', async state => {
      auth.getCurrentUser.mockResolvedValue(user);
      const router = mount('/auth', state);
      expect(await screen.findByText('Private dashboard')).toBeTruthy();
      expect(router.state.location.pathname).toBe('/');
    },
  );
});
