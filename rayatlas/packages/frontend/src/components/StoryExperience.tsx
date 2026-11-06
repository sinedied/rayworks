import { useReducedMotion } from 'framer-motion';
import { Pencil, PencilOff } from 'lucide-react';
import type { NetworkData } from '@rayfin-app/shared';
import { useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState } from 'react';

import { ChapterRail, CompactProgress } from '@/components/ChapterRail';
import { PresentationOverlay } from '@/components/PresentationOverlay';
import { PresentMenu } from '@/components/PresentMenu';
import { SaveMenu } from '@/components/SaveMenu';
import { ChapterArticle, IntroArticle, OutroArticle } from '@/components/StoryArticles';
import { usePresentation } from '@/hooks/use-presentation';
import { useStoryDraft } from '@/hooks/use-story-draft';
import { useActiveIndex, useSettledValue, useViewport, type Viewport } from '@/hooks/use-viewport';
import type { CameraPadding } from '@/map/camera';
import { StoryMap, type StoryMapHandle } from '@/map/StoryMap';
import { countWords, sceneDwellMs, useAutoplay } from '@/story/autoplay';
import { isEditableTarget, navigationActionForKey, navigationReducer } from '@/story/navigation';
import { sampleStory } from '@/story/sampleStory';
import { buildScenes, readingMinutes } from '@/story/scenes';

type Mode = 'read' | 'edit';

/** Share of the viewport height the docked map takes on small screens (matches the CSS). */
const COMPACT_MAP_SHARE = 0.55;

/** Story column width on wide screens (matches `--story-column` in the CSS). */
function columnWidth(viewport: Viewport): number {
  return Math.min(500, Math.max(340, viewport.width * 0.36)) + Math.min(64, Math.max(24, viewport.width * 0.04));
}

function cameraPadding(viewport: Viewport, presenting: boolean): CameraPadding {
  if (presenting) {
    return viewport.compact
      ? { top: 64, right: 16, bottom: Math.round(viewport.height * 0.6), left: 16 }
      : { top: 80, right: 64, bottom: 96, left: Math.round(viewport.width * 0.06 + Math.min(720, viewport.width * 0.44) + 24) };
  }
  if (viewport.compact) return { top: 64, right: 16, bottom: 24, left: 16 };
  // Right padding clears the chapter rail and its current label (`--rail-reach` in the CSS).
  return { top: 72, right: 136, bottom: 48, left: Math.round(columnWidth(viewport)) };
}

function initialMode(): Mode {
  if (typeof window === 'undefined') return 'read';
  return new URLSearchParams(window.location.search).get('mode') === 'edit' ? 'edit' : 'read';
}

function writeUrl(mode: Mode, sceneKey: string | null) {
  const url = new URL(window.location.href);
  if (mode === 'edit') url.searchParams.set('mode', 'edit');
  else url.searchParams.delete('mode');
  url.hash = sceneKey && sceneKey !== 'intro' ? sceneKey : '';
  const next = `${url.pathname}${url.search}${url.hash}`;
  if (next !== `${window.location.pathname}${window.location.search}${window.location.hash}`) {
    window.history.replaceState(window.history.state, '', next);
  }
}

export interface StoryExperienceProps {
  network: NetworkData;
  sampleLabel: string;
}

export function StoryExperience({ network, sampleLabel }: StoryExperienceProps) {
  const draft = useStoryDraft(sampleStory);
  const { story, cameraOverrides } = draft;
  const scenes = useMemo(() => buildScenes(story, cameraOverrides), [story, cameraOverrides]);
  const reducedMotion = useReducedMotion() ?? false;
  const viewport = useViewport();
  const [mode, setMode] = useState<Mode>(initialMode);
  const editing = mode === 'edit';

  const root = useRef<HTMLDivElement>(null);
  const presentTrigger = useRef<HTMLButtonElement>(null);
  const overlay = useRef<HTMLDivElement>(null);
  const map = useRef<StoryMapHandle>(null);
  const articles = useRef<Array<HTMLElement | null>>([]);
  const presentation = usePresentation(root, presentTrigger);
  const { presenting, enterFullscreen, enterWindowed, exit } = presentation;
  const [nav, dispatch] = useReducer(navigationReducer, { index: 0, count: scenes.length });
  const [autoplay, setAutoplay] = useState(false);

  const readingLine = useCallback(() => {
    const height = window.innerHeight;
    if (window.innerWidth > 640) return height * 0.5;
    const mapBottom = 56 + height * COMPACT_MAP_SHARE;
    return mapBottom + (height - mapBottom) * 0.3;
  }, []);
  const readerIndex = useActiveIndex(articles, readingLine, !presenting);
  // Fast scrolling skips intermediate chapters instead of chaining camera flights.
  const settledReaderIndex = useSettledValue(readerIndex, 160);
  const activeIndex = presenting ? nav.index : settledReaderIndex;
  const scene = scenes[Math.min(activeIndex, scenes.length - 1)];
  const padding = useMemo(
    () => cameraPadding(viewport, presenting),
    [viewport, presenting],
  );

  // Deep link to a chapter (`#roastery`) once on load.
  useEffect(() => {
    const key = decodeURIComponent(window.location.hash.slice(1));
    const index = scenes.findIndex((item) => item.key === key);
    if (index > 0) articles.current[index]?.scrollIntoView({ block: 'center' });
    // Only on mount: later hash changes come from this component.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (presenting) return;
    writeUrl(mode, scenes[settledReaderIndex]?.key ?? null);
  }, [mode, scenes, settledReaderIndex, presenting]);

  const scrollToScene = useCallback((index: number, smooth = true) => {
    const element = articles.current[index];
    if (!element) return;
    element.scrollIntoView({ behavior: smooth && !reducedMotion ? 'smooth' : 'auto', block: 'center' });
  }, [reducedMotion]);

  const startPresentation = useCallback((kind: 'fullscreen' | 'windowed') => {
    dispatch({ type: 'go', index: readerIndex });
    setAutoplay(false);
    if (kind === 'fullscreen') void enterFullscreen();
    else enterWindowed();
  }, [dispatch, setAutoplay, enterFullscreen, enterWindowed, readerIndex]);

  // Hand the reader back at the scene the presentation ended on.
  const lastPresented = useRef<number | null>(null);
  useLayoutEffect(() => {
    if (presenting) {
      lastPresented.current = nav.index;
      overlay.current?.focus({ preventScroll: true });
      return;
    }
    if (lastPresented.current !== null) {
      scrollToScene(lastPresented.current, false);
      lastPresented.current = null;
    }
  }, [presenting, nav.index, scrollToScene]);

  useEffect(() => {
    if (!presenting) return;
    const previous = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    return () => { document.documentElement.style.overflow = previous; };
  }, [presenting]);

  const exitPresentation = useCallback(() => {
    setAutoplay(false);
    void exit();
  }, [setAutoplay, exit]);

  useEffect(() => {
    if (!presenting) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || isEditableTarget(event.target)) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        exitPresentation();
        return;
      }
      if (event.target instanceof HTMLButtonElement && (event.key === ' ' || event.key === 'Enter')) return;
      const action = navigationActionForKey(event.key, event.shiftKey);
      if (!action) return;
      event.preventDefault();
      setAutoplay(false);
      dispatch(action);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [presenting, exitPresentation]);

  const presentScene = scenes[nav.index];
  const presentChapter = presentScene?.chapterIndex != null ? story.chapters[presentScene.chapterIndex] : null;
  const dwellMs = presentScene
    ? sceneDwellMs(presentScene, presentChapter
      ? countWords(presentChapter.title, presentChapter.body)
      : countWords(story.title, story.subtitle))
    : 0;
  useAutoplay({
    playing: presenting && autoplay,
    index: nav.index,
    count: scenes.length,
    dwellMs,
    onAdvance: () => dispatch({ type: 'next' }),
    onFinish: () => setAutoplay(false),
  });

  const captureView = (chapterId: string) => {
    const camera = map.current?.getCamera();
    if (camera) draft.setChapterCamera(chapterId, camera);
  };

  const toggleEdit = () => setMode((current) => (current === 'edit' ? 'read' : 'edit'));
  const minutes = readingMinutes(story);

  return (
    <div
      ref={root}
      className="story-root"
      data-presenting={presenting || undefined}
      data-editing={editing || undefined}
    >
      <div className="story-dock">
        <StoryMap
          ref={map}
          network={network}
          scene={scene}
          padding={padding}
          interactive={editing && !presenting}
          reducedMotion={reducedMotion}
        />
        <div className="story-scrim" aria-hidden />
        <CompactProgress count={story.chapters.length} activeIndex={readerIndex} />
      </div>

      {!presenting && (
        <>
          <div className="story-toolbar" role="group" aria-label="Story actions">
            <span className="sample-chip">{sampleLabel}</span>
            {editing && <SaveMenu saveState={draft.saveState} changes={draft.changes} onReset={draft.reset} />}
            <button type="button" className="stage-button" aria-pressed={editing} onClick={toggleEdit}>
              {editing ? <PencilOff className="icon-size-200" aria-hidden /> : <Pencil className="icon-size-200" aria-hidden />}
              <span className="toolbar-label">{editing ? 'Done editing' : 'Edit story'}</span>
            </button>
            <PresentMenu
              trigger={presentTrigger}
              onFullscreen={() => startPresentation('fullscreen')}
              onWindowed={() => startPresentation('windowed')}
            />
          </div>
          {editing && (
            <p className="edit-hint">
              Editing. Drag the map to pan, right-drag or Ctrl-drag to tilt and turn, scroll to zoom. Changes save in this browser.
            </p>
          )}
        </>
      )}

      <main className="story-flow" aria-label="Story" hidden={presenting}>
        <section className="story-section story-section-intro">
          <IntroArticle
            ref={(element) => { articles.current[0] = element; }}
            story={story}
            editing={editing}
            draft={draft}
            chapterCount={story.chapters.length}
            minutes={minutes}
            sampleLabel={sampleLabel}
            onBegin={() => scrollToScene(1)}
            onPresent={() => startPresentation('fullscreen')}
          />
        </section>
        {story.chapters.map((chapter, index) => (
          <section className="story-section" key={chapter.id}>
            <ChapterArticle
              ref={(element) => { articles.current[index + 1] = element; }}
              chapter={chapter}
              index={index}
              total={story.chapters.length}
              active={readerIndex === index + 1}
              editing={editing}
              reducedMotion={reducedMotion}
              network={network}
              draft={draft}
              cameraOverridden={cameraOverrides.has(chapter.id)}
              onUseCurrentView={() => captureView(chapter.id)}
              onReturnToView={() => map.current?.returnToScene()}
            />
          </section>
        ))}
        <section className="story-section story-section-outro">
          <OutroArticle
            ref={(element) => { articles.current[scenes.length - 1] = element; }}
            story={story}
            activeChapter={null}
            onJump={(chapterIndex) => scrollToScene(chapterIndex + 1)}
            onReplay={() => scrollToScene(0)}
            onPresent={() => startPresentation('fullscreen')}
          />
        </section>
      </main>

      {!presenting && <ChapterRail story={story} activeIndex={readerIndex} onSelect={(index) => scrollToScene(index)} />}

      {presenting && (
        <PresentationOverlay
          ref={overlay}
          story={story}
          scenes={scenes}
          index={nav.index}
          network={network}
          reducedMotion={reducedMotion}
          sampleLabel={sampleLabel}
          autoplay={autoplay}
          dwellMs={dwellMs}
          fullscreen={presentation.fullscreen}
          canFullscreen={presentation.canFullscreen}
          notice={presentation.notice}
          onPrevious={() => { setAutoplay(false); dispatch({ type: 'previous' }); }}
          onNext={() => { setAutoplay(false); dispatch({ type: 'next' }); }}
          onGo={(index) => { setAutoplay(false); dispatch({ type: 'go', index }); }}
          onToggleAutoplay={() => {
            if (!autoplay && nav.index === scenes.length - 1) dispatch({ type: 'first' });
            setAutoplay((value) => !value);
          }}
          onToggleFullscreen={() => void presentation.toggleFullscreen()}
          onExit={exitPresentation}
        />
      )}
    </div>
  );
}
