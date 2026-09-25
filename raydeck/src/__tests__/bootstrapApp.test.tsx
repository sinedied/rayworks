// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';

import { startRayDeck, type BootstrapDependencies } from '@/bootstrapApp';
import type { IAuthService } from '@/services/IAuthService';

function service(): IAuthService {
  return {
    fabricAuthEnabled: true,
    getCurrentUser: vi.fn().mockResolvedValue(null),
    initEmbeddedAuth: vi.fn().mockResolvedValue(null),
    onSessionChange: vi.fn(() => vi.fn()),
    signIn: vi.fn().mockRejectedValue(new Error('not used')),
    signOut: vi.fn().mockResolvedValue(undefined),
  };
}

describe('startRayDeck', () => {
  it('runs the legacy callback bridge before auth bootstrap and rendering', () => {
    const calls: string[] = [];
    const dependencies: BootstrapDependencies = {
      bridge: vi.fn(() => { calls.push('bridge'); return true; }),
      create: vi.fn(() => ({ render: () => { calls.push('render'); } })),
      createAuthService: vi.fn(() => { calls.push('auth'); return service(); }),
    };
    expect(startRayDeck(document.createElement('div'), dependencies)).toEqual({ bridged: true });
    expect(calls).toEqual(['bridge']);
  });

  it('renders a branded fatal state when auth configuration is missing', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const render = vi.fn();
    startRayDeck(document.createElement('div'), {
      bridge: () => false,
      create: () => ({ render }),
      createAuthService: () => { throw new Error('Missing Fabric configuration'); },
    });
    expect(render).toHaveBeenCalledOnce();
    expect(JSON.stringify(render.mock.calls[0][0])).toContain('Ray|Deck could not start');
    expect(JSON.stringify(render.mock.calls[0][0])).toContain('Missing Fabric configuration');
  });
});
