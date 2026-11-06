import { AnimatePresence, motion, type Variants } from 'framer-motion';
import { ChevronLeft, ChevronRight, Maximize, Minimize, Pause, Play, X } from 'lucide-react';
import type { NetworkData } from '@rayfin-app/shared';
import type { Ref } from 'react';

import { MetricLedger, StoryTitle } from '@/components/StoryArticles';
import { usePresentationControls } from '@/hooks/use-presentation-controls';
import type { StoryScene } from '@/story/scenes';
import type { Story } from '@/story/types';

const EASE_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1];

function captionVariants(reducedMotion: boolean): Variants {
  return {
    hidden: {},
    shown: { transition: { staggerChildren: reducedMotion ? 0 : 0.09, delayChildren: reducedMotion ? 0 : 0.35 } },
    gone: { opacity: 0, transition: { duration: reducedMotion ? 0 : 0.3 } },
  };
}

function lineVariants(reducedMotion: boolean): Variants {
  return reducedMotion
    ? { hidden: { opacity: 1 }, shown: { opacity: 1 } }
    : {
        hidden: { opacity: 0, y: 22, filter: 'blur(8px)' },
        shown: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.9, ease: EASE_OUT } },
      };
}

export interface PresentationOverlayProps {
  story: Story;
  scenes: StoryScene[];
  index: number;
  network: NetworkData;
  reducedMotion: boolean;
  sampleLabel: string;
  autoplay: boolean;
  dwellMs: number;
  fullscreen: boolean;
  canFullscreen: boolean;
  notice: string;
  onPrevious: () => void;
  onNext: () => void;
  onGo: (index: number) => void;
  onToggleAutoplay: () => void;
  onToggleFullscreen: () => void;
  onExit: () => void;
  ref?: Ref<HTMLDivElement>;
}

/** Large-type captions and auto-hiding controls over the full-bleed map. */
export function PresentationOverlay({
  story, scenes, index, network, reducedMotion, sampleLabel, autoplay, dwellMs, fullscreen, canFullscreen, notice,
  onPrevious, onNext, onGo, onToggleAutoplay, onToggleFullscreen, onExit, ref,
}: PresentationOverlayProps) {
  const { visible, controls, ...controlEvents } = usePresentationControls();
  const scene = scenes[index];
  const chapter = scene?.chapterIndex !== null && scene ? story.chapters[scene.chapterIndex] : null;
  const total = scenes.length;
  const line = lineVariants(reducedMotion);
  const announcement = chapter
    ? `Chapter ${scene.chapterIndex! + 1} of ${story.chapters.length}: ${chapter.title}`
    : scene?.kind === 'intro' ? story.title : 'End of story';

  return (
    <div ref={ref} className="present" role="region" aria-roledescription="presentation" aria-label={story.title}
      tabIndex={-1} data-controls={visible ? 'visible' : 'hidden'}>
      <div className="present-scrim" aria-hidden />
      <div className="present-top">
        <span className="present-story">{story.title}</span>
        <span className="sample-chip">{sampleLabel}</span>
      </div>

      <p className="sr-only" aria-live="polite">{announcement}</p>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={scene?.key ?? 'empty'}
          className={`present-caption present-caption-${scene?.kind ?? 'chapter'}`}
          variants={captionVariants(reducedMotion)}
          initial="hidden"
          animate="shown"
          exit="gone"
        >
          {scene?.kind === 'intro' && (
            <>
              <motion.div variants={line}><StoryTitle title={story.title} as="h2" className="present-title present-title-hero" /></motion.div>
              <motion.p variants={line} className="present-body">{story.subtitle}</motion.p>
              <motion.p variants={line} className="present-hint">Press → or Space to begin</motion.p>
            </>
          )}
          {chapter && scene && (
            <>
              <motion.p variants={line} className="present-leg">
                <span className="chapter-leg-mark" aria-hidden />
                <span>{chapter.eyebrow}</span>
                <span className="present-leg-count">{scene.chapterIndex! + 1} / {story.chapters.length}</span>
              </motion.p>
              <motion.h2 variants={line} className="present-title">{chapter.title}</motion.h2>
              <motion.p variants={line} className="present-body">{chapter.body}</motion.p>
              <motion.div variants={line}>
                <MetricLedger chapter={chapter} network={network} active reducedMotion={reducedMotion} layout="strip" />
              </motion.div>
            </>
          )}
          {scene?.kind === 'outro' && (
            <>
              <motion.h2 variants={line} className="present-title">The whole line, end to end</motion.h2>
              <motion.p variants={line} className="present-body">
                {story.chapters.length} chapters from highland farms to European cafés. Ridgeline Coffee is fictional;
                every figure comes from the bundled sample network.
              </motion.p>
            </>
          )}
        </motion.div>
      </AnimatePresence>

      {notice && <p className="present-notice" role="status">{notice}</p>}

      <div ref={controls} {...controlEvents} className="present-dock" role="group" aria-label="Presentation controls">
        <ol className="present-progress" aria-label="Scenes">
          {scenes.map((item, sceneIndex) => {
            const state = sceneIndex < index ? 'past' : sceneIndex === index ? 'current' : 'future';
            const label = item.kind === 'intro' ? 'Title'
              : item.kind === 'outro' ? 'End'
                : `Chapter ${item.chapterIndex! + 1}: ${story.chapters[item.chapterIndex!]?.eyebrow ?? ''}`;
            return (
              <li key={item.key} data-state={state}>
                <button type="button" aria-label={label} aria-current={state === 'current' ? 'step' : undefined}
                  onClick={() => onGo(sceneIndex)}>
                  <span className="present-progress-bar">
                    <span
                      key={`${index}-${autoplay}`}
                      className="present-progress-fill"
                      data-playing={state === 'current' && autoplay ? true : undefined}
                      style={state === 'current' && autoplay ? { animationDuration: `${dwellMs}ms` } : undefined}
                    />
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
        <div className="present-controls">
          <button type="button" className="present-control" aria-label="Previous" onClick={onPrevious} disabled={index === 0}>
            <ChevronLeft className="icon-size-300" aria-hidden />
          </button>
          <span className="present-count" aria-hidden>{index + 1} / {total}</span>
          <button type="button" className="present-control" aria-label="Next" onClick={onNext} disabled={index === total - 1}>
            <ChevronRight className="icon-size-300" aria-hidden />
          </button>
          <span className="present-divider" aria-hidden />
          <button type="button" className="present-control present-control-wide" aria-pressed={autoplay} onClick={onToggleAutoplay}>
            {autoplay ? <Pause className="icon-size-200" aria-hidden /> : <Play className="icon-size-200" aria-hidden />}
            <span>{autoplay ? 'Pause' : 'Autoplay'}</span>
          </button>
          {canFullscreen && (
            <button type="button" className="present-control" aria-label={fullscreen ? 'Leave fullscreen' : 'Enter fullscreen'}
              onClick={onToggleFullscreen}>
              {fullscreen ? <Minimize className="icon-size-200" aria-hidden /> : <Maximize className="icon-size-200" aria-hidden />}
            </button>
          )}
          <button type="button" className="present-control present-control-wide" onClick={onExit}>
            <X className="icon-size-200" aria-hidden />
            <span>Exit</span>
          </button>
        </div>
      </div>
    </div>
  );
}
