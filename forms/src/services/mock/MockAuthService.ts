import { AuthUser, IAuthService } from '../interfaces/IAuthService';
import { getRayfinClient } from '../rayfin/RayfinClientService';

const MOCK_USER_KEY = 'rayfin_mock_user';
const MOCK_PASSWORD = 'LocalDev!Pass123';

/**
 * Mock auth service for local development.
 * Bypasses Fabric/Entra by using email/password auth against the local backend.
 * Automatically creates the user account on first sign-in.
 */
export class MockAuthService implements IAuthService {
  private email = 'dev@contoso.com';

  get fabricAuthEnabled(): boolean {
    return false;
  }

  setMockEmail(email: string): void {
    this.email = email;
  }

  async signOut(): Promise<void> {
    localStorage.removeItem(MOCK_USER_KEY);
    const client = getRayfinClient();
    await client.auth.signOut();
  }

  async getCurrentUser(): Promise<AuthUser | null> {
    const client = getRayfinClient();
    const session = client.auth.getSession();
    if (session.isAuthenticated && session.user) {
      return {
        id: session.user.id,
        email: session.user.email,
        name: session.user.email.split('@')[0],
      };
    }

    // Fall back to localStorage for session restoration across reloads
    const stored = localStorage.getItem(MOCK_USER_KEY);
    if (!stored) return null;
    return JSON.parse(stored) as AuthUser;
  }

  async isAuthenticated(): Promise<boolean> {
    const client = getRayfinClient();
    return client.auth.getSession().isAuthenticated;
  }

  async initEmbeddedAuth(): Promise<AuthUser | null> {
    return null;
  }

  async initiateFabricLogin(): Promise<void> {
    // no-op in mock mode
  }

  async ensureSignedInWithFabric(): Promise<AuthUser> {
    const client = getRayfinClient();

    // Try sign-in first; if user doesn't exist, sign up then sign in
    try {
      await client.auth.signIn({ email: this.email, password: MOCK_PASSWORD });
    } catch {
      await client.auth.signUp({ email: this.email, password: MOCK_PASSWORD });
      await client.auth.signIn({ email: this.email, password: MOCK_PASSWORD });
    }

    const session = client.auth.getSession();
    if (!session.isAuthenticated || !session.user) {
      throw new Error('Local mock sign-in failed to establish a session.');
    }

    const user: AuthUser = {
      id: session.user.id,
      email: session.user.email,
      name: session.user.email.split('@')[0],
    };
    localStorage.setItem(MOCK_USER_KEY, JSON.stringify(user));
    return user;
  }
}
