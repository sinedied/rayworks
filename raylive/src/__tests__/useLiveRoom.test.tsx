import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { useLiveRoom } from '@/hooks/useLiveRoom';
import { listAnswers } from '@/services/answers';
import { getRoomByCode } from '@/services/rooms';
import { answer, room } from './helpers/roomData';

vi.mock('@/services/rooms', () => ({ getRoomByCode: vi.fn() }));
vi.mock('@/services/activities', () => ({
  listActivities: vi.fn().mockResolvedValue([]),
  listOptions: vi.fn().mockResolvedValue([]),
}));
vi.mock('@/services/answers', () => ({ listAnswers: vi.fn() }));
vi.mock('@/services/questions', () => ({
  listQuestions: vi.fn().mockResolvedValue([]),
  listVotes: vi.fn().mockResolvedValue([]),
  tallyQuestions: vi.fn(() => []),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getRoomByCode).mockResolvedValue(room);
  vi.mocked(listAnswers).mockResolvedValue([]);
});
afterEach(() => vi.useRealTimers());

it('does not overwrite post-reset state with a delayed pre-reset poll', async () => {
  let finishOld: (rows: typeof answer[]) => void = () => {};
  vi.mocked(listAnswers).mockReturnValueOnce(new Promise((resolve) => { finishOld = resolve; }));
  const { result } = renderHook(() => useLiveRoom(room.code));
  await waitFor(() => expect(listAnswers).toHaveBeenCalledOnce());
  await act(() => result.current.refresh(true));
  expect(result.current.answersFor(answer.activity_id)).toEqual([]);
  await act(async () => finishOld([answer]));
  expect(result.current.answersFor(answer.activity_id)).toEqual([]);
});

it('does not starve a slow paginated read by starting another poll every interval', async () => {
  vi.useFakeTimers();
  let finish: (rows: typeof answer[]) => void = () => {};
  vi.mocked(listAnswers).mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
  const { result } = renderHook(() => useLiveRoom(room.code));
  await act(async () => { await vi.advanceTimersByTimeAsync(10000); });
  expect(listAnswers).toHaveBeenCalledOnce();
  await act(async () => finish([answer]));
  expect(result.current.loading).toBe(false);
  expect(result.current.answersFor(answer.activity_id)).toEqual([answer]);
});

it('surfaces an explicit refresh failure to a management mutation caller', async () => {
  const { result } = renderHook(() => useLiveRoom(room.code));
  await waitFor(() => expect(result.current.loading).toBe(false));
  vi.mocked(listAnswers).mockRejectedValue(new Error('Refresh failed'));
  await act(async () => {
    await expect(result.current.refresh(true)).rejects.toThrow('Refresh failed');
  });
  expect(result.current.error).toBe('Refresh failed');
});
