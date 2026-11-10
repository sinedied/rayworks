import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Answer } from '../../rayfin/data/Answer';
import { useLiveRoom, type LiveRoomState } from '@/hooks/useLiveRoom';
import { AudiencePage } from '@/pages/AudiencePage';
import { submitPlace } from '@/services/answers';
import { getParticipantKey } from '@/services/identity';
import { activity as activityRow, room } from './helpers/roomData';

vi.mock('@/hooks/useLiveRoom');
vi.mock('@/services/answers', () => ({ submitPlace: vi.fn() }));

const HAMBURG = '2911298';
let state: LiveRoomState;
let answers: Answer[];
const page = () => <MemoryRouter><AudiencePage /></MemoryRouter>;

function globe(overrides: Partial<typeof activityRow> = {}) {
  return {
    ...activityRow, id: crypto.randomUUID(), kind: 'globe' as const, prompt: 'Where are you joining from?',
    state: 'live' as const, startedAt: undefined, timeLimitSeconds: undefined, showResults: false,
    allowChangeAnswer: true, ...overrides,
  };
}

function live(activity: ReturnType<typeof globe>) {
  state = {
    room, liveActivity: activity, activities: [activity], questions: [],
    optionsFor: () => [], answersFor: () => answers,
    loading: false, notFound: false, error: null, refresh: vi.fn().mockResolvedValue(undefined),
  };
}

async function pickHamburg() {
  await userEvent.type(screen.getByRole('combobox', { name: 'Your city' }), 'hamburg');
  await userEvent.click(await screen.findByRole('option', { name: 'Hamburg Germany' }));
}

beforeEach(() => {
  answers = [];
  live(globe());
  vi.mocked(useLiveRoom).mockImplementation(() => state);
  vi.mocked(submitPlace).mockReset().mockImplementation(async (activity, placeId) => {
    answers = [...answers, {
      id: crypto.randomUUID(), activity_id: activity.id, room_id: room.id, owner_id: room.owner_id,
      participantKey: getParticipantKey(), placeId, isHidden: false, createdAt: new Date(),
    }];
  });
});

describe('audience globe answer', () => {
  it('submits the picked city and confirms it on the map', async () => {
    render(page());
    expect(screen.getByText(/Only your city is shared/)).toBeInTheDocument();
    const submit = screen.getByRole('button', { name: 'Put me on the map' });
    expect(submit).toBeDisabled();

    await pickHamburg();
    expect(screen.getByRole('group', { name: 'Your city' })).toHaveTextContent('Hamburg, Germany');
    await userEvent.click(submit);

    expect(submitPlace).toHaveBeenCalledWith(state.liveActivity, HAMBURG);
    expect(await screen.findByText("You're on the map — Hamburg, Germany.")).toBeInTheDocument();
  });

  it('changes an answer starting from the current city', async () => {
    render(page());
    await pickHamburg();
    await userEvent.click(screen.getByRole('button', { name: 'Put me on the map' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Change my answer' }));

    expect(await screen.findByRole('group', { name: 'Your city' })).toHaveTextContent('Hamburg, Germany');
    await userEvent.click(screen.getByRole('button', { name: 'Change city: Hamburg, Germany' }));
    await userEvent.type(screen.getByRole('combobox', { name: 'Your city' }), 'cologne');
    await userEvent.click(await screen.findByRole('option', { name: /^Köln/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Put me on the map' }));

    expect(submitPlace).toHaveBeenLastCalledWith(state.liveActivity, '2886242');
    await waitFor(() =>
      expect(screen.getByText("You're on the map — Köln, Germany.")).toBeInTheDocument()
    );
  });

  it('locks the answer when changes are not allowed', async () => {
    live(globe({ allowChangeAnswer: false }));
    render(page());
    await pickHamburg();
    await userEvent.click(screen.getByRole('button', { name: 'Put me on the map' }));
    expect(await screen.findByText(/You're on the map — Hamburg, Germany\. Answers are final\./)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Change my answer' })).not.toBeInTheDocument();
  });

  it('surfaces submission errors and keeps the selection', async () => {
    vi.mocked(submitPlace).mockRejectedValueOnce(new Error('Network down'));
    render(page());
    await pickHamburg();
    await userEvent.click(screen.getByRole('button', { name: 'Put me on the map' }));
    expect(await screen.findByText('Network down')).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Your city' })).toHaveTextContent('Hamburg, Germany');
  });
});
