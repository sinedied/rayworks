import { useCallback, useMemo, useRef, useState } from 'react';

import type { Activity } from '../../rayfin/data/Activity';
import type { ActivityOption } from '../../rayfin/data/ActivityOption';
import type { Room } from '../../rayfin/data/Room';

import {
  activationMode,
  canStartPrepared,
  currentActivity,
  nextActivity,
  previousActivity,
} from '@/lib/runOrder';
import {
  endActivity,
  goLive,
  prepareActivity,
  revealAnswers,
  startPreparedActivity,
} from '@/services/activities';
import { requireManageableRoom, updateRoom } from '@/services/rooms';

export interface RoomControls {
  current: Activity | null;
  /** True when the primary action would start a question waiting in the lobby. */
  canStart: boolean;
  hasNext: boolean;
  hasPrevious: boolean;
  showJoinInfo: boolean;
  busy: boolean;
  error: string | null;
  next: () => Promise<void>;
  previous: () => Promise<void>;
  /** Starts a prepared question, or opens the next activity when nothing is running. */
  startOrAdvance: () => Promise<void>;
  end: () => Promise<void>;
  reveal: () => Promise<void>;
  toggleJoinInfo: () => Promise<void>;
}

/**
 * One implementation of the presenter's actions, shared by the control bar, the keyboard
 * shortcuts, and the phone remote so they cannot drift apart.
 */
export function useRoomControls(
  room: Room | null,
  activities: Activity[],
  optionsFor: (activityId: string) => ActivityOption[],
  refresh: () => Promise<void>
): RoomControls {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef(false);

  const current = useMemo(() => currentActivity(activities), [activities]);
  const next = useMemo(() => nextActivity(activities), [activities]);
  const previous = useMemo(() => previousActivity(activities), [activities]);

  const run = useCallback(
    async (action: () => Promise<void>) => {
      if (pending.current) return;
      pending.current = true;
      setBusy(true);
      try {
        if (!room) throw new Error('Room not available.');
        await requireManageableRoom(room.id);
        await action();
        await refresh();
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Action failed.');
      } finally {
        pending.current = false;
        setBusy(false);
      }
    },
    [room, refresh]
  );

  const open = useCallback(
    async (activity: Activity) => {
      if (activationMode(activity) === 'prepare') {
        await prepareActivity(activity.id, activities);
      } else {
        await goLive(activity.id, activities);
      }
    },
    [activities]
  );

  return {
    current,
    canStart: canStartPrepared(current),
    hasNext: !!next,
    hasPrevious: !!previous,
    showJoinInfo: room?.showJoinInfo !== false,
    busy: busy || room?.isResetting === true,
    error: error ?? (room?.isResetting ? 'Response reset pending. Retry from the management console.' : null),

    next: () =>
      run(async () => {
        if (next) await open(next);
      }),
    previous: () =>
      run(async () => {
        if (previous) await open(previous);
      }),

    startOrAdvance: () =>
      run(async () => {
        // A quiz sitting in the lobby starts; otherwise this advances the run order.
        if (canStartPrepared(current)) {
          await startPreparedActivity(current!.id);
        } else if (next) {
          await open(next);
        }
      }),

    end: () =>
      run(async () => {
        if (current) await endActivity(current.id);
      }),

    reveal: () =>
      run(async () => {
        if (current) await revealAnswers(optionsFor(current.id));
      }),

    toggleJoinInfo: () =>
      run(async () => {
        if (!room) return;
        await updateRoom(room.id, { showJoinInfo: room.showJoinInfo === false });
      }),
  };
}
