import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthPage } from '@/components/AuthPage';
import { useAuth } from '@/hooks/AuthContext';

vi.mock('@/hooks/AuthContext');
vi.mock('@/components/MockSignInDialog', () => ({
  MockSignInDialog: ({
    open,
    onConfirm,
  }: {
    open: boolean;
    onConfirm: (email: string) => void;
  }) => open ? (
    <div role="dialog" aria-label="Local sign in">
      <button onClick={() => onConfirm('local@example.com')}>Confirm local sign in</button>
    </div>
  ) : null,
}));

const signInWithFabric = vi.fn();
const signInLocally = vi.fn();
const auth = {
  user: null,
  isAuthenticated: false,
  loading: false,
  error: null,
  signOut: vi.fn(),
  signInWithFabric,
  signInLocally,
  refreshUser: vi.fn(),
  fabricAuthEnabled: true,
};

function renderPage() {
  return render(<MemoryRouter><AuthPage /></MemoryRouter>);
}

describe('AuthPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuth).mockReturnValue(auth);
  });

  it('renders the shared intro-card composition with a brand-only header', () => {
    renderPage();
    expect(screen.getByRole('banner')).toContainElement(screen.getByRole('img', { name: 'Ray|Forms' }));
    expect(screen.getByRole('heading', { name: 'Build the form. Share the link. Collect the answers.' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Sign in to Ray|Forms' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Sign out' })).not.toBeInTheDocument();
  });

  it('keeps the Fabric sign-in handler and loading label', async () => {
    signInWithFabric.mockReturnValue(new Promise(() => {}));
    renderPage();
    await userEvent.click(screen.getByRole('button', { name: 'Sign in with Microsoft' }));
    expect(signInWithFabric).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: 'Opening Fabric...' })).toBeDisabled();
  });

  it('preserves the local mock dialog path', async () => {
    vi.mocked(useAuth).mockReturnValue({ ...auth, fabricAuthEnabled: false });
    renderPage();
    await userEvent.click(screen.getByRole('button', { name: 'Sign in with Microsoft' }));
    await userEvent.click(screen.getByRole('button', { name: 'Confirm local sign in' }));
    expect(signInLocally).toHaveBeenCalledWith('local@example.com');
  });

  it('shows Fabric sign-in failures as an alert', async () => {
    signInWithFabric.mockRejectedValue(new Error('Fabric sign-in failed'));
    renderPage();
    await userEvent.click(screen.getByRole('button', { name: 'Sign in with Microsoft' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Fabric sign-in failed');
  });
});
