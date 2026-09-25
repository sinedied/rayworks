import { act, renderHook } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';

import { useRoomControls } from '@/hooks/useRoomControls';
import { requireManageableRoom } from '@/services/rooms';
import { goLive } from '@/services/activities';
import { activity as activityRow, room } from './helpers/roomData';

vi.mock('@/services/rooms', () => ({ requireManageableRoom: vi.fn(), updateRoom: vi.fn() }));
vi.mock('@/services/activities', () => ({
  goLive: vi.fn(), prepareActivity: vi.fn(), startPreparedActivity: vi.fn(),
  endActivity: vi.fn(), revealAnswers: vi.fn(),
}));
beforeEach(() => vi.clearAllMocks());

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
