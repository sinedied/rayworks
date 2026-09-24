import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { Icon } from '@/components/Icon';
import { SaveMenu } from '@/components/SaveMenu';
import { PresentMenu } from '@/components/PresentMenu';
import { PresentationControls } from '@/components/PresentationControls';
import { PresenterView } from '@/components/PresenterView';
import { SpeakerNotes } from '@/components/SpeakerNotes';
import { SlideCanvas } from '@/components/SlideCanvas';
import { SlideViewport } from '@/components/SlideViewport';
import { createChangePrompt, type SlideTextField } from '@/deck/changes';
import { SAMPLE_DECK, type DeckSlide } from '@/deck/sampleDeck';
import { ThemeContext } from '@/hooks/theme.context';
import { useAppTheme } from '@/hooks/use-theme';
import { useDeckDraft } from '@/hooks/useDeckDraft';
import { usePresentation } from '@/hooks/usePresentation';
import { usePresenterSession } from '@/hooks/usePresenterSession';
import { useViewPreferences } from '@/hooks/useViewPreferences';
import { navigateIndex, type Navigation } from '@/presentation/session';
import { ignoresPresentationShortcut } from '@/presentation/shortcuts';

function Thumbnail({
  slide, total, active, onClick, onOverflow,
}: {
  slide: DeckSlide;
  total: number;
  active: boolean;
  onClick: () => void;
  onOverflow: (id: string, field: SlideTextField, overflowing: boolean) => void;
}) {
  const reportOverflow = useCallback((field: SlideTextField, overflowing: boolean) => {
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
  const view = useViewPreferences();
  const [activeIndex, setActiveIndex] = useState(0);
  const [overflowFields, setOverflowFields] = useState<Record<string, boolean>>({});
  const root = useRef<HTMLDivElement>(null);
  const presentButton = useRef<HTMLButtonElement>(null);
  const { presenting, notice, enter, exit } = usePresentation(root, presentButton);
  const activeSlide = slides[activeIndex];
  const changes = useMemo(() => createChangePrompt(slides, SAMPLE_DECK), [slides]);
  const progress = `${((activeIndex + 1) / slides.length) * 100}%`;
  const overflowing = Object.keys(overflowFields).filter((field) => overflowFields[field]);

  const reportOverflow = useCallback((id: string, field: SlideTextField, value: boolean) => {
    const key = `${id}:${field}`;
    setOverflowFields((current) => (Boolean(current[key]) === value ? current : { ...current, [key]: value }));
  }, []);

  const navigate = useCallback((command: Navigation) => {
    setActiveIndex((index) => navigateIndex(index, slides, command));
  }, [slides]);
  const goTo = useCallback((index: number) => {
    navigate({ type: 'goTo', slideId: slides[Math.max(0, Math.min(slides.length - 1, index))].id });
  }, [slides, navigate]);
  const session = usePresenterSession(slides, activeSlide.id, navigate);
  useLayoutEffect(() => {
    if (!session.active) return;
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;
    const overflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    window.scrollTo(0, 0);
    return () => {
      document.documentElement.style.overflow = overflow;
      window.scrollTo(scrollX, scrollY);
    };
  }, [session.active]);
  const wasPresenter = useRef(false);
  useEffect(() => {
    if (wasPresenter.current && !session.active) presentButton.current?.focus();
    wasPresenter.current = session.active;
  }, [session.active]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (ignoresPresentationShortcut(event)) return;
      if (event.key === 'Escape' && presenting) {
        event.preventDefault();
        void exit();
        return;
      }
      if (event.key === 'ArrowRight' || event.key === 'PageDown' || event.key === ' ') {
        event.preventDefault();
        navigate({ type: 'next' });
      }
      if (event.key === 'ArrowLeft' || event.key === 'PageUp') {
        event.preventDefault();
        navigate({ type: 'previous' });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate, presenting, exit]);

  return (
    <ThemeContext.Provider value={theme}>
      <div ref={root} className={`deck-app ${presenting ? 'is-presenting' : ''} ${session.active ? 'is-presenter' : ''}`}>
        {!session.active && <header className="app-header">
          <div className="brand-lockup">
            <img alt="Ray|Deck" className="app-logo logo-light" src="/raydeck.svg" />
            <img alt="Ray|Deck" className="app-logo logo-dark" src="/raydeck-dark.svg" />
            <span className="document-title">Quarterly business review</span>
          </div>
          <div className="header-actions">
            <SaveMenu saveState={saveState} changes={changes} />
            {!session.active && <button className="icon-button" onClick={() => { resetDeck(); setActiveIndex(0); }}
              aria-label="Reset sample deck" title="Reset sample deck" type="button">
              <Icon name="reset" />
            </button>}
            <button className={`icon-button ${session.active ? '' : 'header-theme-button'}`} onClick={theme.toggleTheme} aria-label="Toggle theme" title="Toggle theme" type="button">
              <Icon name={theme.isDark ? 'sun' : 'moon'} />
            </button>
            {!session.active && <PresentMenu trigger={presentButton} onPresent={() => void enter()} onPresenter={session.open} />}
          </div>
        </header>}

        {session.active ? (
          <PresenterView slides={slides} index={activeIndex} connection={session.connection} onNavigate={goTo}
            onNotes={(value) => updateSlide(activeSlide.id, 'notes', value)} onOpen={session.open} onEnd={session.end}
            saveState={saveState} changes={changes} isDark={theme.isDark} onTheme={theme.toggleTheme} error={session.error}
            preferences={view.preferences} preferenceNotice={view.notice} onSplitRatio={view.setSplitRatio} onNotesSize={view.setNotesFontSize} />
        ) : <div className="deck-workspace">
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
                {session.error && <p className="notice notice-error" role="alert">{session.error}</p>}
                {view.notice && <p className="notice notice-warning" role="status">{view.notice}</p>}
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
            {!presenting && <div className="editor-notes">
              <SpeakerNotes value={activeSlide.notes ?? ''} slideNumber={activeSlide.number}
                onChange={(value) => updateSlide(activeSlide.id, 'notes', value)}
                fontSize={view.preferences.notesFontSize} onFontSizeChange={view.setNotesFontSize} />
            </div>}
          </main>
        </div>}

        {presenting && (
          <>
            {notice && <p className="presentation-notice" role="status">{notice}</p>}
            <PresentationControls index={activeIndex} total={slides.length}
              onPrevious={() => navigate({ type: 'previous' })} onNext={() => navigate({ type: 'next' })}
              onExit={() => void exit()} />
          </>
        )}
      </div>
    </ThemeContext.Provider>
  );
}

export default App;
