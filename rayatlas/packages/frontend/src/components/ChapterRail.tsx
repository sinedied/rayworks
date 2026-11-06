import type { Story } from '@/story/types';

/** Supply-line progress rail: one stop per chapter, filled up to the chapter in view. */
export function ChapterRail({ story, activeIndex, onSelect }: {
  story: Story;
  /** Scene index: 0 is the title card, chapters start at 1. */
  activeIndex: number;
  onSelect: (sceneIndex: number) => void;
}) {
  const count = story.chapters.length;
  const progress = count > 1 ? Math.min(1, Math.max(0, (activeIndex - 1) / (count - 1))) : 0;
  return (
    <nav className="chapter-rail" aria-label="Story chapters">
      <span className="chapter-rail-track" aria-hidden>
        <span className="chapter-rail-fill" style={{ transform: `scaleY(${progress})` }} />
      </span>
      <ol>
        {story.chapters.map((chapter, index) => {
          const sceneIndex = index + 1;
          const state = sceneIndex < activeIndex ? 'past' : sceneIndex === activeIndex ? 'current' : 'future';
          return (
            <li key={chapter.id} data-state={state}>
              <button
                type="button"
                className="chapter-rail-stop"
                aria-label={`Chapter ${index + 1}: ${chapter.eyebrow}. ${chapter.title}`}
                aria-current={state === 'current' ? 'step' : undefined}
                onClick={() => onSelect(sceneIndex)}
              >
                <span
                  className="chapter-rail-label"
                  aria-hidden
                  data-map-obstacle={state === 'current' ? '' : undefined}
                >
                  {chapter.eyebrow}
                </span>
                <span className="chapter-rail-dot" aria-hidden />
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** Thin progress line along the bottom of the docked map on small screens. */
export function CompactProgress({ count, activeIndex }: { count: number; activeIndex: number }) {
  return (
    <div className="compact-progress" aria-hidden>
      {Array.from({ length: count }, (_, index) => (
        <span key={index} data-state={index + 1 < activeIndex ? 'past' : index + 1 === activeIndex ? 'current' : 'future'} />
      ))}
    </div>
  );
}
