import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const clientConstructor = vi.hoisted(() => vi.fn());
vi.mock('@microsoft/rayfin-client', () => ({
  RayfinClient: class {
    constructor(config: unknown) {
      clientConstructor(config);
    }
  },
}));

beforeEach(() => {
  vi.resetModules();
  clientConstructor.mockClear();
});
afterEach(() => vi.unstubAllEnvs());

describe('Rayfin client compatibility', () => {
  it('keeps explicit initialization, direct routing, and auth storage', async () => {
    const { initRayfinClient, getRayfinClient } = await import('../services/rayfinClient');
    expect(() => getRayfinClient()).toThrow('not initialized');
    const config = { baseUrl: 'https://example.test/appbackends/deck/', publishableKey: 'test-key' };
    const client = initRayfinClient(config);
    expect(getRayfinClient()).toBe(client);
    expect(clientConstructor).toHaveBeenCalledExactlyOnceWith({ ...config, authStorage: true });
    expect(() => initRayfinClient(config)).toThrow('already initialized');
  });

  it('retains the lazy analytics client and missing-environment errors', async () => {
    vi.stubEnv('VITE_RAYFIN_API_URL', '');
    vi.stubEnv('VITE_RAYFIN_PUBLISHABLE_KEY', '');
    const { getRayfinClient } = await import('../lib/rayfin-client');
    expect(() => getRayfinClient()).toThrow('Missing required env vars');
    vi.stubEnv('VITE_RAYFIN_API_URL', 'https://example.test/appbackends/deck/');
    expect(() => getRayfinClient()).toThrow('Missing required env vars');
    vi.stubEnv('VITE_RAYFIN_PUBLISHABLE_KEY', 'test-key');
    const client = getRayfinClient();
    expect(getRayfinClient()).toBe(client);
    expect(clientConstructor).toHaveBeenCalledExactlyOnceWith({
      baseUrl: 'https://example.test/appbackends/deck/',
      publishableKey: 'test-key',
      authStorage: true,
    });
  });
});
