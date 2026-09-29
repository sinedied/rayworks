import { act, renderHook } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';

import { useRoomControls } from '@/hooks/useRoomControls';
import { requireManageableRoom } from '@/services/rooms';
import { goLive } from '@/services/activities';
import { openQuizSeries, startQuizQuestion } from '@/services/quizRuns';
import type { QuizRunData } from '@/lib/quizRuns';
import { activity as activityRow, room } from './helpers/roomData';

vi.mock('@/services/rooms', () => ({ requireManageableRoom: vi.fn(), updateRoom: vi.fn() }));
vi.mock('@/services/activities', () => ({
  goLive: vi.fn(), prepareActivity: vi.fn(), startPreparedActivity: vi.fn(),
  endActivity: vi.fn(), revealAnswers: vi.fn(),
}));
vi.mock('@/services/quizRuns', () => ({
  openQuizSeries: vi.fn(), startQuizQuestion: vi.fn(),
  closeQuizQuestion: vi.fn(), finishQuiz: vi.fn(),
}));
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireManageableRoom).mockResolvedValue(room);
});

it('disables shared presenter controls during a pending reset', () => {
  const { result } = renderHook(() => useRoomControls({ ...room, isResetting: true }, [], () => [], vi.fn()));
  expect(result.current.busy).toBe(true);
  expect(result.current.error).toContain('reset pending');
});

it('rechecks reset state before acting on a stale remote snapshot', async () => {
  vi.mocked(requireManageableRoom).mockRejectedValue(new Error('Response reset pending'));
  const { result } = renderHook(() => useRoomControls(room, [{
    ...activityRow, kind: 'multipleChoice', state: 'draft', startedAt: undefined,
  }], () => [], vi.fn()));
  await act(() => result.current.startOrAdvance());
  expect(goLive).not.toHaveBeenCalled();
  expect(result.current.error).toBe('Response reset pending');
});

const first = { ...activityRow, id: 'first', state: 'live' as const, position: 0 };
const second = { ...activityRow, id: 'second', state: 'draft' as const, position: 1 };
const quiz: QuizRunData = {
  run: { id: 'run', room_id: room.id, owner_id: room.owner_id, seriesKey: 'series', title: 'Quiz', state: 'lobby', createdAt: new Date() },
  questions: [{
    id: 'question-one', run_id: 'run', activity_id: first.id, room_id: room.id, owner_id: room.owner_id,
    snapshotKey: 'key', prompt: first.prompt, position: 0, timeLimitSeconds: 20,
    allowMultiple: false, allowChangeAnswer: false, showResults: true, published: true, state: 'lobby',
  }],
  options: [], participants: [], members: [], answers: [],
};

it('uses Next in the first lobby to start that question instead of skipping it', async () => {
  const { result } = renderHook(() => useRoomControls({
    ...room, quizRunId: 'run', displayedActivityId: first.id, displayedQuestionId: 'question-one',
  }, [first, second], () => [], vi.fn(), quiz));
  await act(() => result.current.next());
  expect(startQuizQuestion).toHaveBeenCalledWith(room.id, 'run', 'question-one');
  expect(openQuizSeries).not.toHaveBeenCalled();
});

it('advances after a revealed question using the displayed cursor', async () => {
  const revealed = {
    ...quiz, run: { ...quiz.run, state: 'running' as const },
    questions: [{ ...quiz.questions[0], state: 'revealed' as const, startedAt: new Date() }],
  };
  const { result } = renderHook(() => useRoomControls({
    ...room, quizRunId: 'run', displayedActivityId: first.id, displayedQuestionId: 'question-one',
  }, [{ ...first, state: 'ended' }, second], () => [], vi.fn(), revealed));
  await act(() => result.current.next());
  expect(openQuizSeries).toHaveBeenCalledWith(room.id, second.id);
});

it('does not offer an unanswered remaining question after the presenter finishes the series', () => {
  const finished = {
    ...quiz, run: { ...quiz.run, state: 'finished' as const },
    questions: [
      { ...quiz.questions[0], state: 'closed' as const, startedAt: new Date() },
      { ...quiz.questions[0], id: 'question-two', activity_id: second.id, position: 1, state: 'pending' as const },
    ],
  };
  const { result } = renderHook(() => useRoomControls({
    ...room, quizRunId: 'run', displayedActivityId: first.id, displayedQuestionId: 'question-one',
  }, [{ ...first, state: 'ended' }, second], () => [], vi.fn(), finished));
  expect(result.current.hasNext).toBe(false);
});
