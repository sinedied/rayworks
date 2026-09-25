import { bridgeFabricCallback } from '@microsoft/rayfin-auth-provider-fabric';
import { createRoot, type Root } from 'react-dom/client';

import { AuthStatePage } from '@/components/AuthStatePage';
import { SecureRoot } from '@/components/SecureRoot';
import { AuthProvider } from '@/hooks/AuthContext';
import { bootstrapAuth } from '@/services/bootstrap';
import type { IAuthService } from '@/services/IAuthService';

type RootLike = Pick<Root, 'render'>;

export interface BootstrapDependencies {
  bridge: () => boolean;
  create: (element: Element | DocumentFragment) => RootLike;
  createAuthService: () => IAuthService;
}

const defaults: BootstrapDependencies = {
  bridge: bridgeFabricCallback,
  create: createRoot,
  createAuthService: bootstrapAuth,
};

export function startRayDeck(
  element: HTMLElement,
  dependencies: BootstrapDependencies = defaults,
) {
  if (dependencies.bridge()) return { bridged: true };

  const root = dependencies.create(element);
  try {
    const authService = dependencies.createAuthService();
    root.render(
      <AuthProvider authService={authService}>
        <SecureRoot />
      </AuthProvider>
    );
    return { bridged: false };
  } catch (reason) {
    console.error('Could not initialize Ray|Deck authentication:', reason);
    root.render(
      <AuthStatePage
        error
        title="Ray|Deck could not start"
        message={
          reason instanceof Error
            ? reason.message
            : 'Authentication configuration is unavailable.'
        }
      />
    );
    return { bridged: false };
  }
}
