import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  applyDraft,
  camerasEqual,
  createChangePrompt,
  DRAFT_MESSAGES,
  getBrowserStorage,
  loadDraft,
  resetDraft,
  saveDraft,
  setChapterCamera,
  setChapterText,
  setMetricLabel,
  setStoryText,
  type ChangePrompt,
  type ChapterTextField,
  type DraftStorage,
  type StoryDraft,
  type StoryTextField,
} from '@/story/draft';
import type { Story, StoryCamera } from '@/story/types';

export type SaveStatus = 'saved' | 'saving' | 'error';

export interface SaveState {
  status: SaveStatus;
  /** Explains an `error` status and how to keep the work. */
  message?: string;
}

export interface StoryDraftApi {
  /** Bundled story with local edits applied. */
  story: Story;
  draft: StoryDraft;
  saveState: SaveState;
  changes: ChangePrompt;
  /** Chapter ids whose camera differs from the bundled story. */
  cameraOverrides: ReadonlySet<string>;
  setStoryText: (field: StoryTextField, value: string) => void;
  setChapterText: (chapterId: string, field: ChapterTextField, value: string) => void;
  setChapterCamera: (chapterId: string, camera: StoryCamera) => void;
  setMetricLabel: (chapterId: string, metricId: string, label: string) => void;
  reset: () => void;
}

export const AUTOSAVE_DELAY_MS = 300;

/**
 * Browser-local story edits, modeled on Ray|Deck's deck draft: changes autosave to localStorage,
 * a corrupt stored draft blocks autosave until an explicit reset, and nothing touches source files.
 */
export function useStoryDraft(
  baseStory: Story,
  storage: DraftStorage | null = getBrowserStorage(),
): StoryDraftApi {
  const [initial] = useState(() => loadDraft(baseStory, storage));
  const [draft, setDraft] = useState<StoryDraft>(initial.draft);
  const [blocked, setBlocked] = useState(initial.blocked);
  const [revision, setRevision] = useState(0);
  const [saveState, setSaveState] = useState<SaveState>(() =>
    initial.status === 'invalid' || initial.status === 'unavailable'
      ? { status: 'error', message: initial.message }
      : { status: 'saved' },
  );
  const storageRef = useRef(storage);
  const latest = useRef({ baseStory, draft, blocked });
  useEffect(() => {
    latest.current = { baseStory, draft, blocked };
  });

  useEffect(() => {
    if (revision === 0) return;
    const timer = setTimeout(() => {
      const { baseStory: story, draft: current, blocked: isBlocked } = latest.current;
      if (isBlocked) {
        setSaveState({ status: 'error', message: DRAFT_MESSAGES.invalid });
        return;
      }
      const result = saveDraft(story, current, storageRef.current);
      setSaveState(result.status === 'saved' ? { status: 'saved' } : { status: 'error', message: result.message });
    }, AUTOSAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [revision]);

  const update = useCallback((change: (current: StoryDraft) => StoryDraft) => {
    setDraft(change);
    setRevision((value) => value + 1);
    setSaveState((current) => (latest.current.blocked || !storageRef.current
      ? { status: 'error', message: current.message ?? DRAFT_MESSAGES.unavailable }
      : { status: 'saving' }));
  }, []);

  const reset = useCallback(() => {
    const result = resetDraft(latest.current.baseStory, storageRef.current);
    setDraft(result.draft);
    if (result.status === 'saved') {
      setBlocked(false);
      setSaveState({ status: 'saved' });
    } else {
      setSaveState({ status: 'error', message: result.message });
    }
  }, []);

  const updateStoryText = useCallback(
    (field: StoryTextField, value: string) => update((current) => setStoryText(current, field, value)),
    [update],
  );
  const updateChapterText = useCallback(
    (chapterId: string, field: ChapterTextField, value: string) =>
      update((current) => setChapterText(current, chapterId, field, value)),
    [update],
  );
  const updateChapterCamera = useCallback(
    (chapterId: string, camera: StoryCamera) => update((current) => setChapterCamera(current, chapterId, camera)),
    [update],
  );
  const updateMetricLabel = useCallback(
    (chapterId: string, metricId: string, label: string) =>
      update((current) => setMetricLabel(current, chapterId, metricId, label)),
    [update],
  );

  const story = useMemo(() => applyDraft(baseStory, draft), [baseStory, draft]);
  const changes = useMemo(() => createChangePrompt(baseStory, draft), [baseStory, draft]);
  const cameraOverrides = useMemo(() => {
    const ids = new Set<string>();
    for (const chapter of baseStory.chapters) {
      const camera = draft.chapters[chapter.id]?.camera;
      if (camera && !camerasEqual(camera, chapter.camera)) ids.add(chapter.id);
    }
    return ids;
  }, [baseStory, draft]);

  return {
    story,
    draft,
    saveState,
    changes,
    cameraOverrides,
    setStoryText: updateStoryText,
    setChapterText: updateChapterText,
    setChapterCamera: updateChapterCamera,
    setMetricLabel: updateMetricLabel,
    reset,
  };
}
