import { useCallback, useRef, useState } from 'react';

import { MAX_SPLIT_RATIO, MIN_SPLIT_RATIO } from '@/presentation/layout';

export const VIEW_PREFERENCES_KEY = 'raydeck.view-preferences.v1';
export const MIN_NOTES_SIZE = 14;
export const MAX_NOTES_SIZE = 48;
export const NOTES_SIZE_STEP = 2;
export type ViewPreferences = { splitRatio: number; notesFontSize: number };
const DEFAULTS: ViewPreferences = { splitRatio: 1 / 3, notesFontSize: 16 };

function loadPreferences(): { preferences: ViewPreferences; notice: string } {
  try {
    const stored = window.localStorage.getItem(VIEW_PREFERENCES_KEY);
    if (stored === null) return { preferences: DEFAULTS, notice: '' };
    const value: unknown = JSON.parse(stored);
    if (typeof value !== 'object' || value === null || !('version' in value) || value.version !== 1
      || !('splitRatio' in value) || typeof value.splitRatio !== 'number' || !Number.isFinite(value.splitRatio)
      || value.splitRatio < MIN_SPLIT_RATIO || value.splitRatio > MAX_SPLIT_RATIO
      || !('notesFontSize' in value) || typeof value.notesFontSize !== 'number' || !Number.isInteger(value.notesFontSize)
      || value.notesFontSize < MIN_NOTES_SIZE || value.notesFontSize > MAX_NOTES_SIZE
      || value.notesFontSize % NOTES_SIZE_STEP !== 0) {
      throw new Error('Invalid stored Ray|Deck view preferences.');
    }
    return { preferences: { splitRatio: value.splitRatio, notesFontSize: value.notesFontSize }, notice: '' };
  } catch (error) {
    console.error('Could not read Ray|Deck view preferences:', error);
    return {
      preferences: DEFAULTS,
      notice: 'Could not read view preferences. Using the default layout and notes size; stored settings have not been overwritten.',
    };
  }
}

export function useViewPreferences() {
  const [initial] = useState(loadPreferences);
  const [preferences, setPreferences] = useState(initial.preferences);
  const [notice, setNotice] = useState(initial.notice);
  const latest = useRef(preferences);

  const update = useCallback((change: Partial<ViewPreferences>) => {
    const next = { ...latest.current, ...change };
    latest.current = next;
    setPreferences(next);
    try {
      window.localStorage.setItem(VIEW_PREFERENCES_KEY, JSON.stringify({ version: 1, ...next }));
      setNotice('');
    } catch (error) {
      console.error('Could not save Ray|Deck view preferences:', error);
      setNotice('View preferences could not be remembered in this browser. Your layout and notes size still apply in this tab.');
    }
  }, []);

  const setSplitRatio = useCallback((splitRatio: number) => update({ splitRatio }), [update]);
  const setNotesFontSize = useCallback((notesFontSize: number) => update({ notesFontSize }), [update]);
  return { preferences, notice, setSplitRatio, setNotesFontSize };
}
