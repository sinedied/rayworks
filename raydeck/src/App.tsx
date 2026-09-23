import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Icon } from '@/components/Icon';
import { SaveMenu } from '@/components/SaveMenu';
import { SlideCanvas } from '@/components/SlideCanvas';
import { SlideViewport } from '@/components/SlideViewport';
import { createChangePrompt, type EditableField } from '@/deck/changes';
import { SAMPLE_DECK, type DeckSlide } from '@/deck/sampleDeck';
import { ThemeContext } from '@/hooks/theme.context';
import { useAppTheme } from '@/hooks/use-theme';
import { useDeckDraft } from '@/hooks/useDeckDraft';
import { usePresentation } from '@/hooks/usePresentation';

function Thumbnail({
  slide, total, active, onClick, onOverflow,
}: {
  slide: DeckSlide;
  total: number;
  active: boolean;
  onClick: () => void;
  onOverflow: (id: string, field: EditableField, overflowing: boolean) => void;
}) {
  const reportOverflow = useCallback((field: EditableField, overflowing: boolean) => {
    onOverflow(slide.id, field, overflowing);
  }, [slide.id, onOverflow]);

  return (
    <div className={`thumbnail ${active ? 'thumbnail-active' : ''}`}>
      <span className="thumbnail-number" aria-hidden="true">{slide.number}</span>
      <div className="thumbnail-preview">
        <div className="thumbnail-content" aria-hidden="true" inert>
          <SlideViewport>
            <SlideCanvas slide={slide} total={total} onOverflow={reportOverflow} />
          </SlideViewport>
        </div>
        <button aria-current={active ? 'page' : undefined} className="thumbnail-select"
          aria-label={`Slide ${slide.number}: ${slide.title}`} onClick={onClick} type="button" />
      </div>
    </div>
  );
}

function App() {
  const theme = useAppTheme();
  const { slides, saveState, updateSlide, resetDeck } = useDeckDraft();
  const [activeIndex, setActiveIndex] = useState(0);
  const [overflowFields, setOverflowFields] = useState<Record<string, boolean>>({});
  const root = useRef<HTMLDivElement>(null);
  const presentButton = useRef<HTMLButtonElement>(null);
  const { presenting, notice, enter, exit } = usePresentation(root, presentButton);
  const activeSlide = slides[activeIndex];
  const changes = useMemo(() => createChangePrompt(slides, SAMPLE_DECK), [slides]);
  const progress = `${((activeIndex + 1) / slides.length) * 100}%`;
  const overflowing = Object.keys(overflowFields).filter((field) => overflowFields[field]);

  const reportOverflow = useCallback((id: string, field: EditableField, value: boolean) => {
    const key = `${id}:${field}`;
    setOverflowFields((current) => (Boolean(current[key]) === value ? current : { ...current, [key]: value }));
  }, []);

  const goTo = useCallback((index: number) => {
    setActiveIndex(Math.max(0, Math.min(slides.length - 1, index)));
  }, [slides.length]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest('input, textarea, select, [contenteditable="true"], [role="menu"], .save-menu')) return;
      if (event.key === 'Escape' && presenting) {
        event.preventDefault();
        void exit();
        return;
      }
      if (event.key === ' ' && target?.closest('button, a, [role="button"]')) return;
      if (event.key === 'ArrowRight' || event.key === 'PageDown' || event.key === ' ') {
        event.preventDefault();
        goTo(activeIndex + 1);
      }
      if (event.key === 'ArrowLeft' || event.key === 'PageUp') {
        event.preventDefault();
        goTo(activeIndex - 1);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeIndex, goTo, presenting, exit]);

  return (
    <ThemeContext.Provider value={theme}>
      <div ref={root} className={`deck-app ${presenting ? 'is-presenting' : ''}`}>
        <header className="app-header">
          <div className="brand-lockup">
            <img alt="Ray|Deck" className="app-logo logo-light" src="/raydeck.svg" />
            <img alt="Ray|Deck" className="app-logo logo-dark" src="/raydeck-dark.svg" />
            <span className="document-title">Quarterly business review</span>
          </div>
          <div className="header-actions">
            <SaveMenu saveState={saveState} changes={changes} />
            <button className="icon-button" onClick={() => { resetDeck(); setActiveIndex(0); }}
              aria-label="Reset sample deck" title="Reset sample deck" type="button">
              <Icon name="reset" />
            </button>
            <button className="icon-button header-theme-button" onClick={theme.toggleTheme} aria-label="Toggle theme" title="Toggle theme" type="button">
              <Icon name={theme.isDark ? 'sun' : 'moon'} />
            </button>
            <button ref={presentButton} className="present-button" onClick={() => void enter()}
              aria-label="Present" title="Present" type="button">
              <Icon name="play" size={16} /><span>Present</span>
            </button>
          </div>
        </header>

        <div className="deck-workspace">
          <aside className="thumbnail-rail" aria-label="Slides">
            <div className="rail-label">Slides</div>
            {slides.map((slide, index) => (
              <Thumbnail active={index === activeIndex} key={slide.id} onClick={() => goTo(index)}
                onOverflow={reportOverflow} slide={slide} total={slides.length} />
            ))}
          </aside>

          <main className="stage-area">
            {!presenting && (
              <div className="stage-notices">
                {saveState.status === 'error' && <p className="notice notice-error" role="alert">{saveState.message}</p>}
                {overflowing.length > 0 && (
                  <p className="notice notice-warning" role="status">
                    Some text does not fit, even at the minimum font size. Shorten it before presenting:
                    {' '}{overflowing.map((key) => {
                      const [id, field] = key.split(':');
                      return `slide ${slides.find((slide) => slide.id === id)?.number} ${field}`;
                    }).join(', ')}. Full text is still available in the editor and changes prompt.
                  </p>
                )}
              </div>
            )}
            <div className="stage-toolbar">
              <span>Edit text directly on the slide</span><span>Use arrow keys to navigate</span>
              <button className="icon-button mobile-theme-button" onClick={theme.toggleTheme}
                aria-label="Toggle theme" title="Toggle theme" type="button">
                <Icon name={theme.isDark ? 'sun' : 'moon'} />
              </button>
            </div>
            <div className="stage-shell">
              <SlideViewport>
                <SlideCanvas key={activeSlide.id} slide={activeSlide} total={slides.length} readOnly={presenting}
                  onChange={(field, value) => updateSlide(activeSlide.id, field, value)} />
              </SlideViewport>
            </div>
            <div className="stage-controls">
              <button aria-label="Previous slide" className="nav-button" disabled={activeIndex === 0}
                onClick={() => goTo(activeIndex - 1)} type="button"><Icon name="chevron-left" /></button>
              <div className="progress-track"><span style={{ width: progress }} /></div>
              <span className="progress-label">{activeIndex + 1} of {slides.length}</span>
              <button aria-label="Next slide" className="nav-button" disabled={activeIndex === slides.length - 1}
                onClick={() => goTo(activeIndex + 1)} type="button"><Icon name="chevron-right" /></button>
            </div>
          </main>
        </div>

        {presenting && (
          <>
            {notice && <p className="presentation-notice" role="status">{notice}</p>}
            <div className="presentation-controls">
              <button aria-label="Previous slide" disabled={activeIndex === 0}
                onClick={() => goTo(activeIndex - 1)} type="button"><Icon name="chevron-left" /></button>
              <span>{activeIndex + 1} / {slides.length}</span>
              <button aria-label="Next slide" disabled={activeIndex === slides.length - 1}
                onClick={() => goTo(activeIndex + 1)} type="button"><Icon name="chevron-right" /></button>
              <button onClick={() => void exit()} type="button"><Icon name="expand" /> Exit</button>
            </div>
          </>
        )}
      </div>
    </ThemeContext.Provider>
  );
}

export default App;
