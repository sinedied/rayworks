import { RayfinClient } from '@microsoft/rayfin-client';
import { ensureSignedInWithFabric, initEmbeddedAuth } from '@microsoft/rayfin-auth-provider-fabric';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { UniversalAppSchema } from '../../rayfin/data/schema';
import { RayfinAuthService } from '../services/RayfinAuthService';

vi.mock('@microsoft/rayfin-auth-provider-fabric', () => ({
  ensureSignedInWithFabric: vi.fn(),
  initEmbeddedAuth: vi.fn(),
}));

const client = new RayfinClient<UniversalAppSchema>({
  baseUrl: 'https://example.test/appbackends/deck/',
  publishableKey: 'test-key',
  authStorage: false,
  persistSession: false,
  multiTabSync: false,
  autoRefreshToken: false,
});
const options = {
  workspaceId: 'test-workspace', projectId: 'test-project',
  fabricPortalUrl: 'https://app.fabric.microsoft.com', returnOrigin: 'https://example.test',
};
const service = new RayfinAuthService(client, options);
afterEach(() => vi.restoreAllMocks());

describe('Fabric auth wrapper compatibility', () => {
  it('forwards login options and rejects an unauthenticated result', async () => {
    vi.mocked(ensureSignedInWithFabric).mockResolvedValue(client.auth.getSession());
    await expect(service.signIn()).rejects.toThrow('no session was established');
    expect(ensureSignedInWithFabric).toHaveBeenCalledWith(client.auth, options);
  });

  it('retains the non-embedded no-session behavior', async () => {
    vi.mocked(initEmbeddedAuth).mockResolvedValue(null);
    await expect(service.initEmbeddedAuth()).resolves.toBeNull();
    expect(initEmbeddedAuth).toHaveBeenCalledWith(client.auth, options);
    await expect(service.getCurrentUser()).resolves.toBeNull();
  });

  it('propagates SDK errors instead of claiming success', async () => {
    const failure = new Error('Broker unavailable');
    vi.mocked(ensureSignedInWithFabric).mockRejectedValue(failure);
    vi.mocked(initEmbeddedAuth).mockRejectedValue(failure);
    await expect(service.signIn()).rejects.toBe(failure);
    await expect(service.initEmbeddedAuth()).rejects.toBe(failure);
    const signOut = vi.spyOn(client.auth, 'signOut').mockRejectedValue(failure);
    await expect(service.signOut()).rejects.toBe(failure);
    expect(signOut).toHaveBeenCalledOnce();
  });

  it('maps SDK session changes to app users and sign-out', () => {
    const unsubscribe = vi.fn();
    let emit: Parameters<typeof client.auth.onSessionChange>[0] = () => {};
    const onSessionChange = vi.spyOn(client.auth, 'onSessionChange')
      .mockImplementation((callback) => {
        emit = callback;
        return unsubscribe;
      });
    const listener = vi.fn();
    expect(service.onSessionChange(listener)).toBe(unsubscribe);
    emit({
      isAuthenticated: true,
      isAnonymous: false,
      user: { id: 'u1', email: 'alex@contoso.com' },
    });
    emit(null);
    expect(onSessionChange).toHaveBeenCalledOnce();
    expect(listener).toHaveBeenNthCalledWith(1, {
      id: 'u1',
      email: 'alex@contoso.com',
      name: 'alex',
    });
    expect(listener).toHaveBeenNthCalledWith(2, null);
  });
});
