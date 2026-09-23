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
  signIn: vi.fn(),
  signOut,
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

  it('links the product home and calls the existing sign-out handler', async () => {
    renderHeader();
    expect(screen.getByRole('link', { name: 'Ray|Live home' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('img', { name: 'Ray|Live' })).toBeInTheDocument();
    expect(screen.getByText('alex@example.com')).toHaveAttribute('title', 'alex@example.com');
    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(signOut).toHaveBeenCalledOnce();
  });

  it('falls back to the name', () => {
    vi.mocked(useAuth).mockReturnValue({ ...signedIn, user: { ...signedIn.user, email: '' } });
    renderHeader();
    expect(screen.getByText('Alex')).toBeInTheDocument();
  });

  it('hides identity and sign out in a brand-only header', () => {
    renderHeader({ showAccount: false });
    expect(screen.getByRole('img', { name: 'Ray|Live' })).toBeInTheDocument();
    expect(screen.queryByText('alex@example.com')).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('does not show account controls for anonymous visitors', () => {
    vi.mocked(useAuth).mockReturnValue({ ...signedIn, user: null, isAuthenticated: false });
    renderHeader();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
