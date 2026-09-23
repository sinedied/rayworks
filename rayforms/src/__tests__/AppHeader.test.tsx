import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppHeader } from '@/components/AppHeader';
import { useAuth } from '@/hooks/AuthContext';

vi.mock('@/hooks/AuthContext');

const signOut = vi.fn().mockResolvedValue(undefined);
const signedIn = {
  user: { id: 'user-1', email: 'alex@example.com', name: 'Alex' },
  isAuthenticated: true,
  loading: false,
  error: null,
  signOut,
  signInWithFabric: vi.fn(),
  signInLocally: vi.fn(),
  refreshUser: vi.fn(),
  fabricAuthEnabled: false,
};

function renderHeader(props: React.ComponentProps<typeof AppHeader> = {}) {
  return render(<MemoryRouter><AppHeader {...props} /></MemoryRouter>);
}

describe('AppHeader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuth).mockReturnValue(signedIn);
  });

  it('links the product logo home and calls the existing sign-out handler', async () => {
    renderHeader();
    expect(screen.getByRole('link', { name: 'Ray|Forms home' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('img', { name: 'Ray|Forms' })).toBeInTheDocument();
    expect(screen.getByText('alex@example.com')).toHaveAttribute('title', 'alex@example.com');
    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(signOut).toHaveBeenCalledOnce();
  });

  it('falls back to the name when email is absent', () => {
    vi.mocked(useAuth).mockReturnValue({ ...signedIn, user: { ...signedIn.user, email: '' } });
    renderHeader();
    expect(screen.getByText('Alex')).toBeInTheDocument();
  });

  it('keeps public form sign-out suppression for signed-in visitors', () => {
    renderHeader({ showSignOut: false });
    expect(screen.queryByRole('button', { name: 'Sign out' })).not.toBeInTheDocument();
  });

  it('does not show account controls for anonymous visitors', () => {
    vi.mocked(useAuth).mockReturnValue({ ...signedIn, user: null, isAuthenticated: false });
    renderHeader();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('supports a brand-only auth header', () => {
    renderHeader({ showAccount: false });
    expect(screen.getByRole('img', { name: 'Ray|Forms' })).toBeInTheDocument();
    expect(screen.queryByText('alex@example.com')).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
