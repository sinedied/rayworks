// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SecureRoot } from '@/components/SecureRoot';
import { AuthProvider } from '@/hooks/AuthContext';
import type { AuthUser, IAuthService } from '@/services/IAuthService';

const appMounted = vi.fn();
const audienceMounted = vi.fn();
vi.mock('@/App', () => ({
  default: ({ identity, onSignOut }: { identity: string; onSignOut: () => Promise<void> }) => {
    appMounted();
    return <div data-testid="app"><span>{identity}</span><button onClick={() => void onSignOut()}>App sign out</button></div>;
  },
}));
vi.mock('@/components/AudienceView', () => ({
  AudienceView: ({ sessionId }: { sessionId: string | null }) => {
    audienceMounted();
    return <div data-testid="audience">{sessionId || 'invalid'}</div>;
  },
}));

const authenticated = { id: 'u1', email: 'alex@contoso.com', name: 'Alex' };
let root: Root;
let container: HTMLDivElement;
let sessionListener: ((user: AuthUser | null) => void) | undefined;

function service(user: AuthUser | null = null): IAuthService {
  return {
    fabricAuthEnabled: true,
    getCurrentUser: vi.fn().mockResolvedValue(user),
    initEmbeddedAuth: vi.fn().mockResolvedValue(null),
    onSessionChange: vi.fn((listener) => {
      sessionListener = listener;
      return vi.fn();
    }),
    signIn: vi.fn().mockResolvedValue(authenticated),
    signOut: vi.fn().mockResolvedValue(undefined),
  };
}

async function mount(authService: IAuthService) {
  await act(async () => root.render(
    <AuthProvider authService={authService}><SecureRoot /></AuthProvider>
  ));
}

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  window.location.hash = '';
  appMounted.mockClear();
  audienceMounted.mockClear();
  sessionListener = undefined;
  localStorage.clear();
  vi.stubGlobal('matchMedia', vi.fn(() => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })));
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('SecureRoot', () => {
  it('does not mount protected roles or read deck storage before auth completes', async () => {
    let resolve: (user: AuthUser | null) => void = () => {};
    const getItem = vi.spyOn(Storage.prototype, 'getItem');
    await mount({
      ...service(),
      initEmbeddedAuth: vi.fn<() => Promise<AuthUser | null>>(
        () => new Promise((done) => { resolve = done; })
      ),
    });
    expect(container.textContent).toContain('Connecting securely');
    expect(appMounted).not.toHaveBeenCalled();
    expect(audienceMounted).not.toHaveBeenCalled();
    expect(getItem).not.toHaveBeenCalled();
    await act(async () => resolve(null));
    expect(container.textContent).toContain('Sign in to Ray|Deck');
    expect(getItem).not.toHaveBeenCalled();
  });

  it('preserves an audience hash through sign-in and mounts only AudienceView', async () => {
    const id = '85c401a9-a23f-4516-b6ed-1fcd8b3cc260';
    window.location.hash = `audience=${id}`;
    const authService = service();
    await mount(authService);
    expect(container.textContent).toContain('Sign in to Ray|Deck');
    await act(async () => container.querySelector<HTMLButtonElement>('.auth-submit')?.click());
    expect(container.querySelector('[data-testid="audience"]')?.textContent).toBe(id);
    expect(audienceMounted).toHaveBeenCalledOnce();
    expect(appMounted).not.toHaveBeenCalled();
    expect(window.location.hash).toContain(id);
  });

  it('keeps invalid audience requests out of the editor after auth', async () => {
    window.location.hash = 'audience=invalid';
    await mount(service(authenticated));
    expect(container.querySelector('[data-testid="audience"]')?.textContent).toBe('invalid');
    expect(appMounted).not.toHaveBeenCalled();
  });

  it('mounts App for an authenticated editor and unmounts it on auth loss', async () => {
    await mount(service(authenticated));
    expect(container.querySelector('[data-testid="app"]')?.textContent).toContain(authenticated.email);
    await act(async () => sessionListener?.(null));
    expect(container.querySelector('[data-testid="app"]')).toBeNull();
    expect(container.textContent).toContain('Sign in to Ray|Deck');
  });

  it('retains browser-local deck data after sign-out', async () => {
    localStorage.setItem('raydeck.sample-deck.v1', 'private draft');
    localStorage.setItem('raydeck.view-preferences.v1', 'private preferences');
    const authService = service(authenticated);
    await mount(authService);
    await act(async () => container.querySelector<HTMLButtonElement>('[data-testid="app"] button')?.click());
    expect(authService.signOut).toHaveBeenCalledOnce();
    expect(localStorage.getItem('raydeck.sample-deck.v1')).toBe('private draft');
    expect(localStorage.getItem('raydeck.view-preferences.v1')).toBe('private preferences');
    expect(container.textContent).toContain('Sign in to Ray|Deck');
  });
});
