import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useQuizAutoReveal } from '@/hooks/useQuizAutoReveal';
import { autoRevealQuiz } from '@/services/quizRuns';
import { currentUserIdOrNull } from '@/services/rooms';
import type { QuizRunData } from '@/lib/quizRuns';
import { room, activity } from './helpers/roomData';

vi.mock('@/services/quizRuns', () => ({ autoRevealQuiz: vi.fn() }));
vi.mock('@/services/rooms', () => ({ currentUserIdOrNull: vi.fn() }));

const quiz: QuizRunData = {
  run: { id: 'run', room_id: room.id, owner_id: room.owner_id, seriesKey: 'series', title: 'Quiz', state: 'running', createdAt: new Date(0), startedAt: new Date(0) },
  questions: [{
    id: 'q', run_id: 'run', activity_id: activity.id, room_id: room.id, owner_id: room.owner_id,
    snapshotKey: 'key', prompt: 'Quiz?', position: 0, timeLimitSeconds: 1,
    allowMultiple: false, allowChangeAnswer: false, showResults: true, published: true,
    state: 'running', startedAt: new Date(Date.now() - 10000),
  }],
  options: [], members: [], answers: [], participants: [],
};
const currentRoom = { ...room, quizRunId: 'run', displayedQuestionId: 'q', quizAutoReveal: true };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(autoRevealQuiz).mockResolvedValue(true);
  vi.mocked(currentUserIdOrNull).mockReturnValue(room.owner_id);
});
afterEach(() => vi.useRealTimers());

it('attempts auto-reveal and refreshes when an owner sees an expired question', async () => {
  const refresh = vi.fn().mockResolvedValue(undefined);
  renderHook(() => useQuizAutoReveal(currentRoom, quiz, refresh));
  await waitFor(() => expect(autoRevealQuiz).toHaveBeenCalledWith(room.id, 'run', 'q'));
  expect(refresh).toHaveBeenCalledWith(true);
});

it.each(['non-owner', 'disabled', 'reset', 'embedded'])('does not mutate for %s', async (mode) => {
  if (mode === 'non-owner') vi.mocked(currentUserIdOrNull).mockReturnValue('other');
  renderHook(() => useQuizAutoReveal({
    ...currentRoom, quizAutoReveal: mode !== 'disabled', isResetting: mode === 'reset',
  }, quiz, vi.fn(), mode !== 'embedded'));
  await act(async () => {});
  expect(autoRevealQuiz).not.toHaveBeenCalled();
});

it('reports failure without looping, and permits an explicit retry', async () => {
  vi.mocked(autoRevealQuiz).mockRejectedValueOnce(new Error('Reveal failed'));
  const { result } = renderHook(() => useQuizAutoReveal(currentRoom, quiz, vi.fn()));
  await waitFor(() => expect(result.current.error).toBe('Reveal failed'));
  await act(() => result.current.retry());
  expect(autoRevealQuiz).toHaveBeenCalledTimes(2);
  expect(result.current.error).toBeNull();
});
