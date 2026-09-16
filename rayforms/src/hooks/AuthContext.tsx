import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';

import { ServiceContainer } from '../services/ServiceContainer';
import { AuthUser } from '../services/interfaces/IAuthService';
import { MockAuthService } from '../services/mock/MockAuthService';

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  error: string | null;
  signInWithFabric: () => Promise<AuthUser>;
  signInLocally: (email: string) => Promise<void>;
  refreshUser: () => Promise<void>;
  signOut: () => Promise<void>;
  isAuthenticated: boolean;
  fabricAuthEnabled: boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const authService = ServiceContainer.create().authService;

  useEffect(() => {
    authService
      .initEmbeddedAuth()
      .then((embeddedUser) => {
        if (embeddedUser) {
          setUser(embeddedUser);
          return null;
        }
        return authService.getCurrentUser();
      })
      .then((currentUser) => {
        if (currentUser) setUser(currentUser);
      })
      .catch(() => {
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, [authService]);

  const signInWithFabric = useCallback(async () => {
    setError(null);
    setLoading(true);

    try {
      const loggedInUser = await authService.ensureSignedInWithFabric();
      setUser(loggedInUser);
      setLoading(false);
      return loggedInUser;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed';
      setError(message);
      setLoading(false);
      throw err;
    }
  }, [authService]);

  const refreshUser = useCallback(async () => {
    try {
      const currentUser = await authService.getCurrentUser();
      setUser(currentUser);
    } catch {
      setUser(null);
    }
  }, [authService]);

  const signOut = useCallback(async () => {
    try {
      await authService.signOut();
      setUser(null);
      setError(null);
    } catch (err) {
      console.error('Logout error:', err);
    }
  }, [authService]);

  const signInLocally = useCallback(
    async (email: string) => {
      if (!(authService instanceof MockAuthService)) return;
      authService.setMockEmail(email);
      const loggedInUser = await authService.ensureSignedInWithFabric();
      setUser(loggedInUser);
    },
    [authService]
  );

  const contextValue: AuthContextValue = {
    user,
    loading,
    error,
    signInWithFabric,
    signInLocally,
    refreshUser,
    signOut,
    isAuthenticated: !!user,
    fabricAuthEnabled: authService.fabricAuthEnabled,
  };

  return (
    <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
