import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useAuth } from '@/hooks/AuthContext';
import { useLiveRoom, type LiveRoomState } from '@/hooks/useLiveRoom';
import { ManagePage } from '@/pages/ManagePage';
import { updateRoom } from '@/services/rooms';

vi.mock('@/hooks/AuthContext');
vi.mock('@/hooks/useLiveRoom');
vi.mock('@/services/rooms', () => ({ updateRoom: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/services/activities');
vi.mock('@/services/questions');
vi.mock('@/components/QrCode', () => ({ QrCode: () => null }));
vi.mock('@/components/ThemePicker', () => ({ ThemePicker: () => null }));
vi.mock('@/components/ActivityBuilder', () => ({ ActivityBuilder: () => null }));

const refresh = vi.fn().mockResolvedValue(undefined);
const room = {
  id: 'room-1', code: 'TEST', title: 'Quarterly review', owner_id: 'user-1',
  isOpen: true, isAcceptingQuestions: true, qnaEnabled: true, createdAt: new Date(),
};
const roomState: LiveRoomState = {
  room, questions: [], activities: [], liveActivity: null,
  optionsFor: () => [], answersFor: () => [],
  loading: false, notFound: false, error: null, refresh,
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/manage/TEST']}>
      <Routes><Route path="/manage/:code" element={<ManagePage />} /></Routes>
    </MemoryRouter>
  );
}

describe('management shell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuth).mockReturnValue({
      user: { id: 'user-1', email: 'alex@example.com', name: 'Alex' },
      isAuthenticated: true, loading: false, error: null, fabricAuthEnabled: false,
      signIn: vi.fn(), signOut: vi.fn(),
    });
    vi.mocked(useLiveRoom).mockReturnValue(roomState);
  });

  it('keeps branding/account in the header and workflow actions in main', async () => {
    renderPage();
    const header = screen.getByRole('banner');
    expect(within(header).getByRole('img', { name: 'Ray|Live' })).toBeInTheDocument();
    expect(within(header).getByRole('button', { name: 'Sign out' })).toBeInTheDocument();
    expect(within(header).queryByText('Quarterly review')).not.toBeInTheDocument();
    const main = within(screen.getByRole('main'));
    expect(main.getByRole('heading', { name: 'Quarterly review' })).toBeInTheDocument();
    expect(main.getByRole('link', { name: 'Present' })).toHaveAttribute('href', '/present/TEST');
    await userEvent.click(main.getByRole('button', { name: 'Turn Q&A off' }));
    expect(updateRoom).toHaveBeenLastCalledWith('room-1', { qnaEnabled: false });
    await userEvent.click(main.getByRole('button', { name: 'Pause questions' }));
    expect(updateRoom).toHaveBeenLastCalledWith('room-1', { isAcceptingQuestions: false });
    await userEvent.click(main.getByRole('button', { name: 'End room' }));
    expect(updateRoom).toHaveBeenLastCalledWith('room-1', { isOpen: false });
    expect(refresh).toHaveBeenCalledTimes(3);
  });

  it.each(['loading', 'notFound'] as const)('retains the header in the %s state', (state) => {
    vi.mocked(useLiveRoom).mockReturnValue({
      ...roomState, room: null, [state]: true,
    });
    renderPage();
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('main')).toHaveTextContent(state === 'loading' ? 'Loading' : 'Room not found');
  });
});
