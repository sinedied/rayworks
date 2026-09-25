// @vitest-environment jsdom

import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthProvider, useAuth } from '@/hooks/AuthContext';
import type { AuthUser, IAuthService } from '@/services/IAuthService';

const authenticated = { id: 'u1', email: 'alex@contoso.com', name: 'Alex' };
let container: HTMLDivElement;
let root: Root;
let sessionListener: ((user: AuthUser | null) => void) | undefined;
let unsubscribe: ReturnType<typeof vi.fn<() => void>>;

function service(overrides: Partial<IAuthService> = {}): IAuthService {
  return {
    fabricAuthEnabled: true,
    getCurrentUser: vi.fn().mockResolvedValue(null),
    initEmbeddedAuth: vi.fn<() => Promise<AuthUser | null>>().mockResolvedValue(null),
    onSessionChange: vi.fn((listener) => {
      sessionListener = listener;
      return unsubscribe;
    }),
    signIn: vi.fn().mockResolvedValue(authenticated),
    signOut: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function Probe() {
  const auth = useAuth();
  return (
    <div>
      <output aria-label="auth-state">
        {auth.loading ? 'loading' : auth.user?.email || 'signed-out'}
      </output>
      <output aria-label="auth-error">{auth.error}</output>
      <button onClick={() => void auth.signIn().catch(() => {})}>Sign in probe</button>
      <button onClick={() => void auth.signOut().catch(() => {})}>Sign out probe</button>
      <span>{auth.signingIn ? 'signing-in' : ''}</span>
      <span>{auth.signingOut ? 'signing-out' : ''}</span>
    </div>
  );
}

async function render(children: ReactNode, authService: IAuthService) {
  await act(async () => root.render(
    <AuthProvider authService={authService}>{children}</AuthProvider>
  ));
}

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  sessionListener = undefined;
  unsubscribe = vi.fn<() => void>();
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.restoreAllMocks();
});

describe('AuthProvider', () => {
  it('prefers embedded SSO and subscribes to future session changes', async () => {
    const getCurrentUser = vi.fn().mockResolvedValue(null);
    const authService = service({
      initEmbeddedAuth: vi.fn().mockResolvedValue(authenticated),
      getCurrentUser,
    });
    await render(<Probe />, authService);
    expect(container.querySelector('[aria-label="auth-state"]')?.textContent).toBe(authenticated.email);
    expect(getCurrentUser).not.toHaveBeenCalled();
    await act(async () => sessionListener?.(null));
    expect(container.querySelector('[aria-label="auth-state"]')?.textContent).toBe('signed-out');
    await act(async () => sessionListener?.(authenticated));
    expect(container.querySelector('[aria-label="auth-state"]')?.textContent).toBe(authenticated.email);
    expect(authService.onSessionChange).toHaveBeenCalledOnce();
  });

  it('falls back to a stored session outside embedded mode', async () => {
    await render(<Probe />, service({
      getCurrentUser: vi.fn().mockResolvedValue(authenticated),
    }));
    expect(container.querySelector('[aria-label="auth-state"]')?.textContent).toBe(authenticated.email);
  });

  it('surfaces startup, sign-in, and sign-out failures', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const authService = service({
      initEmbeddedAuth: vi.fn().mockRejectedValue(new Error('Embedded handoff failed')),
      signIn: vi.fn().mockRejectedValue(new Error('Popup blocked')),
      signOut: vi.fn().mockRejectedValue(new Error('Sign out failed')),
    });
    await render(<Probe />, authService);
    expect(container.querySelector('[aria-label="auth-error"]')?.textContent).toBe('Embedded handoff failed');
    await act(async () => container.querySelectorAll('button')[0].click());
    expect(container.querySelector('[aria-label="auth-error"]')?.textContent).toBe('Popup blocked');
    await act(async () => sessionListener?.(authenticated));
    await act(async () => container.querySelectorAll('button')[1].click());
    expect(container.querySelector('[aria-label="auth-error"]')?.textContent).toBe('Sign out failed');
    expect(container.querySelector('[aria-label="auth-state"]')?.textContent).toBe(authenticated.email);
  });

  it('unsubscribes and ignores late initialization after unmount', async () => {
    let resolveUser: (user: AuthUser | null) => void = () => {};
    const authService = service({
      initEmbeddedAuth: vi.fn<() => Promise<AuthUser | null>>(
        () => new Promise((resolve) => { resolveUser = resolve; })
      ),
    });
    await act(async () => root.render(
      <AuthProvider authService={authService}><Probe /></AuthProvider>
    ));
    await act(async () => root.unmount());
    await act(async () => resolveUser(authenticated));
    expect(unsubscribe).toHaveBeenCalledOnce();
  });
});
