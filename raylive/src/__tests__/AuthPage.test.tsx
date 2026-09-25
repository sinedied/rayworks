import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthPage } from '@/components/AuthPage';
import { useAuth } from '@/hooks/AuthContext';

vi.mock('@/hooks/AuthContext');

const signIn = vi.fn();
const auth = {
  user: null,
  isAuthenticated: false,
  loading: false,
  error: null,
  signIn,
  signOut: vi.fn(),
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
    expect(screen.getByRole('banner')).toContainElement(screen.getByRole('img', { name: 'Ray|Live' }));
    expect(screen.getByRole('heading', { name: 'Ask the room. See the response live.' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Sign in to Ray|Live' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Sign out' })).not.toBeInTheDocument();
  });

  it('keeps the sign-in handler and loading label', async () => {
    signIn.mockReturnValue(new Promise(() => {}));
    renderPage();
    await userEvent.click(screen.getByRole('button', { name: 'Sign in with Microsoft' }));
    expect(signIn).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: 'Opening Fabric...' })).toBeDisabled();
  });

  it('shows sign-in failures as an alert', async () => {
    signIn.mockRejectedValue(new Error('Live sign-in failed'));
    renderPage();
    await userEvent.click(screen.getByRole('button', { name: 'Sign in with Microsoft' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Live sign-in failed');
  });
});
