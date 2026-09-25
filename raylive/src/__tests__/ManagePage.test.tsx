import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useAuth } from '@/hooks/AuthContext';
import { useLiveRoom, type LiveRoomState } from '@/hooks/useLiveRoom';
import { ManagePage } from '@/pages/ManagePage';
import { currentUserIdOrNull, updateRoom } from '@/services/rooms';
import { resetRoomResponses } from '@/services/roomReset';
import { saveActivityConfiguration } from '@/services/activities';
import { deleteAnswer, deleteWordCloudEntry } from '@/services/answers';
import { deleteQuestion } from '@/services/questions';
import { activity as activityRow, answer, question } from './helpers/roomData';

vi.mock('@/hooks/AuthContext');
vi.mock('@/hooks/useLiveRoom');
vi.mock('@/services/rooms', () => ({
  updateRoom: vi.fn().mockResolvedValue(undefined),
  currentUserIdOrNull: vi.fn(() => 'user-1'),
  requireManageableRoom: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/services/roomReset', () => ({ resetRoomResponses: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/services/activities');
vi.mock('@/services/answers');
vi.mock('@/services/questions');
vi.mock('@/components/QrCode', () => ({ QrCode: () => null }));
vi.mock('@/components/ThemePicker', () => ({ ThemePicker: () => null }));

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
    vi.mocked(currentUserIdOrNull).mockReturnValue('user-1');
    vi.mocked(resetRoomResponses).mockResolvedValue(undefined);
    vi.mocked(useAuth).mockReturnValue({
      user: { id: 'user-1', email: 'alex@example.com', name: 'Alex' },
      isAuthenticated: true, loading: false, error: null, fabricAuthEnabled: false,
      signIn: vi.fn(), signOut: vi.fn(),
    });
    vi.mocked(useLiveRoom).mockReturnValue(roomState);
    vi.mocked(deleteAnswer).mockResolvedValue(undefined);
    vi.mocked(deleteWordCloudEntry).mockResolvedValue(undefined);
    vi.mocked(deleteQuestion).mockResolvedValue(undefined);
  });
  afterEach(() => vi.restoreAllMocks());

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

  it('requires confirmation for a room-wide reset and refreshes after success', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderPage();
    await userEvent.click(screen.getByRole('button', { name: 'Reset all responses' }));
    expect(resetRoomResponses).not.toHaveBeenCalled();
    confirm.mockReturnValue(true);
    await userEvent.click(screen.getByRole('button', { name: 'Reset all responses' }));
    expect(confirm).toHaveBeenLastCalledWith(expect.stringContaining('Quarterly review'));
    expect(resetRoomResponses).toHaveBeenCalledExactlyOnceWith(room.id);
    expect(screen.getByRole('status')).toHaveTextContent('All responses reset');
    expect(refresh).toHaveBeenCalledWith(true);
    confirm.mockRestore();
  });

  it('disables conflicting actions during a reset and reports failure without success', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    let rejectReset: (error: Error) => void = () => {};
    vi.mocked(resetRoomResponses).mockImplementation(() => new Promise((_resolve, reject) => { rejectReset = reject; }));
    renderPage();
    await userEvent.click(screen.getByRole('button', { name: 'Reset all responses' }));
    expect(screen.getByRole('button', { name: 'Reset all responses' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'End room' })).toBeDisabled();
    rejectReset(new Error('Reset incomplete. Retry.'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Reset incomplete');
    expect(screen.queryByText('All responses reset')).not.toBeInTheDocument();
    vi.mocked(window.confirm).mockRestore();
  });

  it('offers a retry for a durable pending reset after a reload', () => {
    vi.mocked(useLiveRoom).mockReturnValue({
      ...roomState, room: { ...room, isResetting: true, isAcceptingQuestions: false, resetResumeQuestions: true },
    });
    renderPage();
    expect(screen.getByRole('button', { name: 'Retry response reset' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Resume questions' })).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent('paused');
  });

  it('does not expose the management actions to a non-owner', () => {
    vi.mocked(currentUserIdOrNull).mockReturnValue('someone-else');
    renderPage();
    expect(screen.queryByRole('button', { name: 'Reset all responses' })).not.toBeInTheDocument();
    expect(screen.getByText('Sign in as the room owner to manage this room.')).toBeInTheDocument();
  });

  it('opens a fixed-type editor, preserves a failed save, and closes on success', async () => {
    const activity = { ...activityRow, kind: 'openText' as const, startedAt: undefined };
    vi.mocked(useLiveRoom).mockReturnValue({ ...roomState, activities: [activity] });
    vi.mocked(saveActivityConfiguration).mockRejectedValueOnce(new Error('Save failed')).mockResolvedValue(undefined);
    renderPage();
    await userEvent.click(screen.getByRole('button', { name: 'Edit' }));
    const prompt = screen.getByRole('textbox', { name: 'Question' });
    await userEvent.clear(prompt);
    await userEvent.type(prompt, 'Updated prompt');
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Save failed');
    expect(prompt).toHaveValue('Updated prompt');
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(screen.queryByRole('form', { name: 'Edit activity' })).not.toBeInTheDocument());
    expect(saveActivityConfiguration).toHaveBeenLastCalledWith(activity.id, expect.objectContaining({
      prompt: 'Updated prompt', kind: 'openText',
    }));
  });

  it.each(['answered', 'live', 'lobby'])('blocks editing an %s activity', (scenario) => {
    const activity = {
      ...activityRow, startedAt: undefined,
      state: scenario === 'answered' ? 'ended' as const : 'live' as const,
      isPrepared: scenario === 'lobby',
    };
    vi.mocked(useLiveRoom).mockReturnValue({
      ...roomState, activities: [activity],
      answersFor: () => scenario === 'answered' ? [answer] : [],
    });
    renderPage();
    expect(screen.getByRole('button', { name: 'Edit' })).toBeDisabled();
    expect(screen.getByText(scenario === 'answered'
      ? 'Clear all responses before editing this activity.'
      : 'End this activity before editing, including a prepared quiz.')).toBeVisible();
  });

  it('confirms individual Open text deletion and refreshes the complete list', async () => {
    const activity = { ...activityRow, kind: 'openText' as const, startedAt: undefined, state: 'live' as const };
    const response = { ...answer, textValue: 'Selected text' };
    const state = { ...roomState, activities: [activity], answersFor: () => [response] };
    vi.mocked(useLiveRoom).mockReturnValue(state);
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderPage();
    await userEvent.click(screen.getByRole('button', { name: 'Manage responses' }));
    await userEvent.click(screen.getByRole('button', { name: 'Delete response' }));
    expect(deleteAnswer).not.toHaveBeenCalled();
    expect(confirm).toHaveBeenLastCalledWith(expect.stringContaining('Older replacement versions'));
    confirm.mockReturnValue(true);
    vi.mocked(deleteAnswer).mockImplementationOnce(async () => {
      vi.mocked(useLiveRoom).mockReturnValue({ ...state, answersFor: () => [] });
    });
    await userEvent.click(screen.getByRole('button', { name: 'Delete response' }));
    expect(deleteAnswer).toHaveBeenCalledExactlyOnceWith(activity.id, answer.id);
    expect(screen.getByRole('status')).toHaveTextContent('Response and any older replacement versions deleted');
    expect(screen.getByText('No stored responses to manage.')).toBeVisible();
  });

  it('confirms bulk cloud deletion and preserves a failed action for retry', async () => {
    const activity = { ...activityRow, kind: 'wordCloud' as const, startedAt: undefined };
    vi.mocked(useLiveRoom).mockReturnValue({
      ...roomState, activities: [activity],
      answersFor: () => [{ ...answer, textValue: 'term' }, { ...answer, id: 'second', textValue: ' TERM ' }],
    });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.mocked(deleteWordCloudEntry).mockRejectedValueOnce(new Error('Deletion incomplete'));
    renderPage();
    await userEvent.click(screen.getByRole('button', { name: 'Manage responses' }));
    await userEvent.click(screen.getByRole('button', { name: 'Delete all occurrences' }));
    expect(window.confirm).toHaveBeenLastCalledWith(expect.stringContaining('2 stored occurrences'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Deletion incomplete');
    expect(screen.queryByText(/Matching word-cloud entries.*deleted/)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Delete all occurrences' }));
    expect(deleteWordCloudEntry).toHaveBeenLastCalledWith(activity.id, 'term');
    expect(screen.getByRole('status')).toHaveTextContent('Matching word-cloud entries');
  });

  it('confirms Q&A question and vote deletion', async () => {
    vi.mocked(useLiveRoom).mockReturnValue({
      ...roomState, questions: [{ ...question, voteCount: 3, hasVoted: false }],
    });
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderPage();
    await userEvent.click(screen.getByRole('button', { name: 'Q&A (1)' }));
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(deleteQuestion).not.toHaveBeenCalled();
    confirm.mockReturnValue(true);
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(confirm).toHaveBeenLastCalledWith(expect.stringContaining('question and all its votes'));
    expect(deleteQuestion).toHaveBeenCalledExactlyOnceWith(question.id);
    expect(screen.getByRole('status')).toHaveTextContent('Question and its votes deleted');
  });

  it.each(['multipleChoice', 'rating', 'ranking', 'quiz'] as const)(
    'does not offer freeform moderation for %s', (kind) => {
      vi.mocked(useLiveRoom).mockReturnValue({
        ...roomState, activities: [{ ...activityRow, kind, startedAt: undefined }],
      });
      renderPage();
      expect(screen.queryByRole('button', { name: 'Manage responses' })).not.toBeInTheDocument();
    }
  );
});
