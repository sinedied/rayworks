import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useLiveRoom, type LiveRoomState } from '@/hooks/useLiveRoom';
import { AudiencePage } from '@/pages/AudiencePage';
import { activityAnswerKey, getAnsweredActivityIds, getParticipantName, rememberAnswered, setParticipantName } from '@/services/identity';
import { activity as activityRow, option, room } from './helpers/roomData';

vi.mock('@/hooks/useLiveRoom');
vi.mock('@/services/answers', () => ({
  submitChoice: vi.fn().mockResolvedValue(undefined),
  submitText: vi.fn().mockResolvedValue(undefined),
}));

let state: LiveRoomState;
const page = () => <MemoryRouter><AudiencePage /></MemoryRouter>;
beforeEach(() => {
  const activity = {
    ...activityRow, id: crypto.randomUUID(), kind: 'multipleChoice' as const,
    state: 'live' as const, startedAt: undefined, timeLimitSeconds: 0, showResults: false,
  };
  state = {
    room, liveActivity: activity, activities: [activity], questions: [],
    optionsFor: () => [option], answersFor: () => [],
    loading: false, notFound: false, error: null, refresh: vi.fn().mockResolvedValue(undefined),
  };
  vi.mocked(useLiveRoom).mockImplementation(() => state);
});

describe('audience after a reset', () => {
  it('unlocks a previously answered activity in the same tab and after a reload', async () => {
    const activity = state.liveActivity!;
    rememberAnswered(activity.id);
    setParticipantName('Ada');
    const view = render(page());
    expect(screen.getByText(/Answer sent/)).toBeInTheDocument();
    state = { ...state, liveActivity: { ...activity, answerResetId: 'reset-1' } };
    view.rerender(page());
    expect(screen.getByRole('button', { name: 'One' })).toBeEnabled();
    await userEvent.click(screen.getByRole('button', { name: 'One' }));
    expect(screen.getByText(/Answer sent/)).toBeInTheDocument();
    state = { ...state, liveActivity: { ...activity, answerResetId: 'reset-2' } };
    view.rerender(page());
    expect(screen.getByRole('button', { name: 'One' })).toBeEnabled();
    view.unmount();
    render(page());
    expect(screen.getByRole('button', { name: 'One' })).toBeEnabled();
    expect(getParticipantName()).toBe('Ada');
    expect(getAnsweredActivityIds().has(activityAnswerKey(activity.id))).toBe(true);
    expect(getAnsweredActivityIds().has(activityAnswerKey(activity.id, 'reset-2'))).toBe(false);
  });

  it('keeps a moderated answer locked until the reset marker actually changes', () => {
    rememberAnswered(state.liveActivity!.id, 'current');
    state = { ...state, liveActivity: { ...state.liveActivity!, answerResetId: 'current' } };
    render(page());
    expect(screen.queryByRole('button', { name: 'One' })).not.toBeInTheDocument();
    expect(screen.getByText(/Answer sent/)).toBeInTheDocument();
  });

  it('hides all submission controls while reset is pending', () => {
    state = { ...state, room: { ...room, isResetting: true } };
    render(page());
    expect(screen.getByRole('status')).toHaveTextContent('Participation is paused');
    expect(screen.queryByRole('button', { name: 'One' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Send' })).not.toBeInTheDocument();
  });

  it('discards an unsent text draft after the marker changes', async () => {
    state = { ...state, liveActivity: { ...state.liveActivity!, kind: 'openText' } };
    const view = render(page());
    const textbox = screen.getByRole('textbox');
    await userEvent.type(textbox, 'Old unsent answer');
    state = { ...state, liveActivity: { ...state.liveActivity!, answerResetId: 'new-run' } };
    view.rerender(page());
    expect(screen.getByRole('textbox')).toHaveValue('');
  });
});
