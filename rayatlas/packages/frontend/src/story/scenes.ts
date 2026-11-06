import type { Story, StoryCamera, StoryChapter, StoryFocus } from './types';

/**
 * A scene is one camera stop of the story: the title card, each chapter, and the end card. The
 * reader and presentation both walk the same list, so the map always receives the same shape.
 */
export type SceneKind = 'intro' | 'chapter' | 'outro';

export interface StoryScene {
  /** `intro`, `outro`, or the chapter id. */
  key: string;
  kind: SceneKind;
  /** Index into `story.chapters`, or `null` for the title and end cards. */
  chapterIndex: number | null;
  camera: StoryCamera;
  focus: StoryFocus;
  /** Frame the focused sites and routes instead of flying to `camera`. */
  fit: boolean;
  terrain: boolean;
  animateRoutes: boolean;
  /** Camera flight duration in milliseconds. */
  duration: number;
  /** Slowly turn the globe once the camera settles. */
  spin: boolean;
}

export const DEFAULT_FLIGHT_MS = 4500;

function chapterScene(chapter: StoryChapter, index: number, cameraOverridden: boolean): StoryScene {
  return {
    key: chapter.id,
    kind: 'chapter',
    chapterIndex: index,
    camera: chapter.camera,
    focus: chapter.focus,
    // A saved "Use current view" camera replaces automatic framing.
    fit: Boolean(chapter.focus.fit) && !cameraOverridden,
    terrain: Boolean(chapter.terrain),
    animateRoutes: Boolean(chapter.animateRoutes),
    duration: chapter.duration ?? DEFAULT_FLIGHT_MS,
    spin: false,
  };
}

/**
 * Builds `[intro, ...chapters, outro]`. `cameraOverrides` lists chapter ids whose camera was
 * replaced in the local draft.
 */
export function buildScenes(story: Story, cameraOverrides: ReadonlySet<string> = new Set()): StoryScene[] {
  const first = story.chapters[0];
  const last = story.chapters.at(-1);
  const introCamera: StoryCamera = first
    ? { ...first.camera, zoom: Math.max(1, first.camera.zoom - 0.25), pitch: 0, bearing: 0 }
    : { center: [-20, 18], zoom: 1.4, bearing: 0, pitch: 0 };
  const outroCamera: StoryCamera = last
    ? { ...last.camera, pitch: 0, bearing: 0 }
    : introCamera;

  return [
    {
      key: 'intro',
      kind: 'intro',
      chapterIndex: null,
      camera: introCamera,
      focus: {},
      fit: false,
      terrain: false,
      animateRoutes: false,
      duration: 2600,
      spin: true,
    },
    ...story.chapters.map((chapter, index) => chapterScene(chapter, index, cameraOverrides.has(chapter.id))),
    {
      key: 'outro',
      kind: 'outro',
      chapterIndex: null,
      camera: outroCamera,
      focus: last?.focus ?? {},
      fit: false,
      terrain: false,
      animateRoutes: false,
      duration: 3800,
      spin: true,
    },
  ];
}

/** Stable identity for camera moves: text edits must never re-trigger a flight. */
export function sceneCameraKey(scene: StoryScene): string {
  const { center, zoom, bearing, pitch } = scene.camera;
  return [scene.key, scene.fit ? 'fit' : 'camera', center[0], center[1], zoom, bearing, pitch].join('|');
}

/** Rough reading time for a story in whole minutes (at least one). */
export function readingMinutes(story: Story, wordsPerMinute = 200): number {
  const words = story.chapters
    .flatMap((chapter) => [chapter.title, chapter.body])
    .join(' ')
    .split(/\s+/)
    .filter(Boolean).length;
  return Math.max(1, Math.round(words / wordsPerMinute));
}
