export interface AuthUser {
  id: string;
  email: string;
  name: string;
}

export interface IAuthService {
  readonly fabricAuthEnabled: boolean;

  signOut(): Promise<void>;
  getCurrentUser(): Promise<AuthUser | null>;
  isAuthenticated(): Promise<boolean>;
  initEmbeddedAuth(): Promise<AuthUser | null>;
  initiateFabricLogin(): Promise<void>;
  ensureSignedInWithFabric(): Promise<AuthUser>;
}
