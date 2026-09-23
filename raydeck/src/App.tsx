import { useCallback, useEffect, useMemo, useState } from 'react';

import { Chart } from '@/components/Chart';
import { type DeckSlide, SAMPLE_DECK } from '@/deck/sampleDeck';
import { ThemeContext } from '@/hooks/theme.context';
import { useAppTheme } from '@/hooks/use-theme';

const STORAGE_KEY = 'raydeck.sample-deck.v1';

function Icon({
  name,
  size = 18,
}: {
  name: 'chevron-left' | 'chevron-right' | 'expand' | 'moon' | 'play' | 'reset' | 'sun';
  size?: number;
}) {
  const paths = {
    'chevron-left': <path d="m15 18-6-6 6-6" />,
    'chevron-right': <path d="m9 18 6-6-6-6" />,
    expand: <><path d="M8 3H5a2 2 0 0 0-2 2v3" /><path d="M16 3h3a2 2 0 0 1 2 2v3" /><path d="M8 21H5a2 2 0 0 1-2-2v-3" /><path d="M16 21h3a2 2 0 0 0 2-2v-3" /></>,
    moon: <path d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5 8.5 8.5 0 1 0 20.5 14.2Z" />,
    play: <path d="m9 7 8 5-8 5Z" />,
    reset: <><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /></>,
    sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
  };

  return (
    <svg
      aria-hidden="true"
      fill="none"
      height={size}
      viewBox="0 0 24 24"
      width={size}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
    >
      {paths[name]}
    </svg>
  );
}

function EditableText({
  value,
  onChange,
  className,
  multiline = false,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  className: string;
  multiline?: boolean;
  label: string;
}) {
  if (multiline) {
    return (
      <textarea
        aria-label={label}
        className={className}
        onChange={(event) => onChange(event.target.value)}
        rows={3}
        value={value}
      />
    );
  }

  return (
    <input
      aria-label={label}
      className={className}
      onChange={(event) => onChange(event.target.value)}
      value={value}
    />
  );
}

function SlideFooter({ slide, total }: { slide: DeckSlide; total: number }) {
  return (
    <footer className="slide-footer">
      <span>Ray|Deck sample</span>
      <span>{slide.number} / {String(total).padStart(2, '0')}</span>
    </footer>
  );
}

function SlideCanvas({
  slide,
  total,
  onChange,
  readOnly,
}: {
  slide: DeckSlide;
  total: number;
  onChange: (field: 'body' | 'eyebrow' | 'title', value: string) => void;
  readOnly: boolean;
}) {
  const editable = (
    field: 'body' | 'eyebrow' | 'title',
    className: string,
    multiline = false,
  ) => (
    readOnly ? (
      multiline ? <p className={className}>{slide[field]}</p> : <div className={className}>{slide[field]}</div>
    ) : (
      <EditableText
        className={className}
        label={`Edit slide ${field}`}
        multiline={multiline}
        onChange={(value) => onChange(field, value)}
        value={slide[field]}
      />
    )
  );

  if (slide.kind === 'cover') {
    return (
      <article className="slide slide-cover">
        <div className="slide-orbit" />
        <img alt="Ray|Deck" className="slide-cover-logo logo-light" src="/raydeck.svg" />
        <img alt="Ray|Deck" className="slide-cover-logo logo-dark" src="/raydeck-dark.svg" />
        <div className="slide-cover-copy">
          {editable('eyebrow', 'slide-eyebrow')}
          {editable('title', 'slide-title slide-title-display')}
          {editable('body', 'slide-body slide-body-wide', true)}
        </div>
        <div className="slide-cover-mark" aria-hidden="true"><span /><span /><span /></div>
        <SlideFooter slide={slide} total={total} />
      </article>
    );
  }

  return (
    <article className={`slide slide-${slide.kind}`}>
      <header className="slide-header">
        <div>
          {editable('eyebrow', 'slide-eyebrow')}
          {editable('title', 'slide-title')}
        </div>
        <span className="slide-number">{slide.number}</span>
      </header>

      {slide.kind === 'metrics' && (
        <div className="metrics-layout">
          <div className="slide-narrative">
            {editable('body', 'slide-body', true)}
            <span className="narrative-rule" />
          </div>
          <div className="metric-stack">
            {slide.metrics?.map((metric) => (
              <div className="metric-row" key={metric.label}>
                <div>
                  <span className="metric-label">{metric.label}</span>
                  <strong>{metric.value}</strong>
                </div>
                <span className={metric.positive ? 'metric-change positive' : 'metric-change'}>
                  {metric.change}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {(slide.kind === 'chart' || slide.kind === 'comparison') && slide.chart && (
        <div className="chart-layout">
          <div className="slide-narrative">
            {editable('body', 'slide-body', true)}
            <div className="insight-chip"><span />Sample connected visual</div>
          </div>
          <div className="chart-frame">
            <Chart spec={slide.chart} />
            <span className="chart-source">{slide.source}</span>
          </div>
        </div>
      )}

      {slide.kind === 'closing' && (
        <div className="closing-layout">
          <div className="closing-statement">
            {editable('body', 'slide-body slide-body-wide', true)}
          </div>
          <ol className="priority-list">
            <li><span>01</span><strong>Shorten onboarding</strong><small>Remove friction from the first 30 days.</small></li>
            <li><span>02</span><strong>Scale partners</strong><small>Package the repeatable motion.</small></li>
            <li><span>03</span><strong>Operationalize expansion</strong><small>Turn product signals into action.</small></li>
          </ol>
        </div>
      )}

      <SlideFooter slide={slide} total={total} />
    </article>
  );
}

function Thumbnail({
  slide,
  active,
  onClick,
}: {
  slide: DeckSlide;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      aria-current={active ? 'page' : undefined}
      className={`thumbnail ${active ? 'thumbnail-active' : ''}`}
      onClick={onClick}
      type="button"
    >
      <span className="thumbnail-number">{slide.number}</span>
      <span className={`thumbnail-preview thumbnail-${slide.kind}`}>
        <span className="thumbnail-eyebrow">{slide.eyebrow}</span>
        <strong>{slide.title}</strong>
        <i />
      </span>
    </button>
  );
}

function loadDeck(): DeckSlide[] {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) as DeckSlide[] : SAMPLE_DECK;
  } catch {
    return SAMPLE_DECK;
  }
}

function App() {
  const theme = useAppTheme();
  const [slides, setSlides] = useState<DeckSlide[]>(loadDeck);
  const [activeIndex, setActiveIndex] = useState(0);
  const [presenting, setPresenting] = useState(false);
  const activeSlide = slides[activeIndex] ?? SAMPLE_DECK[0];

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(slides));
  }, [slides]);

  const goTo = useCallback((index: number) => {
    setActiveIndex(Math.max(0, Math.min(slides.length - 1, index)));
  }, [slides.length]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches('input, textarea')) return;
      if (event.key === 'ArrowRight' || event.key === 'PageDown' || event.key === ' ') {
        event.preventDefault();
        goTo(activeIndex + 1);
      }
      if (event.key === 'ArrowLeft' || event.key === 'PageUp') {
        event.preventDefault();
        goTo(activeIndex - 1);
      }
      if (event.key === 'Escape') setPresenting(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeIndex, goTo]);

  const updateSlide = useCallback(
    (field: 'body' | 'eyebrow' | 'title', value: string) => {
      setSlides((current) => current.map((slide, index) => (
        index === activeIndex ? { ...slide, [field]: value } : slide
      )));
    },
    [activeIndex],
  );

  const resetDeck = () => {
    window.localStorage.removeItem(STORAGE_KEY);
    setSlides(SAMPLE_DECK);
    setActiveIndex(0);
  };

  const progress = useMemo(
    () => `${((activeIndex + 1) / slides.length) * 100}%`,
    [activeIndex, slides.length],
  );

  return (
    <ThemeContext.Provider value={theme}>
      <div className={`deck-app ${presenting ? 'is-presenting' : ''}`}>
        <header className="app-header">
          <div className="brand-lockup">
            <img alt="Ray|Deck" className="app-logo logo-light" src="/raydeck.svg" />
            <img alt="Ray|Deck" className="app-logo logo-dark" src="/raydeck-dark.svg" />
            <span className="document-title">Quarterly business review</span>
          </div>
          <div className="header-actions">
            <span className="save-state"><i /> Saved locally</span>
            <button className="icon-button" onClick={resetDeck} aria-label="Reset sample deck" title="Reset sample deck" type="button">
              <Icon name="reset" />
            </button>
            <button className="icon-button" onClick={theme.toggleTheme} aria-label="Toggle theme" title="Toggle theme" type="button">
              <Icon name={theme.isDark ? 'sun' : 'moon'} />
            </button>
            <button className="present-button" onClick={() => setPresenting(true)} aria-label="Present" title="Present" type="button">
              <Icon name="play" size={16} />
              <span>Present</span>
            </button>
          </div>
        </header>

        <div className="deck-workspace">
          <aside className="thumbnail-rail" aria-label="Slides">
            <div className="rail-label">Slides</div>
            {slides.map((slide, index) => (
              <Thumbnail
                active={index === activeIndex}
                key={slide.id}
                onClick={() => goTo(index)}
                slide={slide}
              />
            ))}
          </aside>

          <main className="stage-area">
            <div className="stage-toolbar">
              <span>Edit text directly on the slide</span>
              <span>Use arrow keys to navigate</span>
            </div>
            <div className="stage-shell">
              <SlideCanvas
                onChange={updateSlide}
                readOnly={presenting}
                slide={activeSlide}
                total={slides.length}
              />
            </div>
            <div className="stage-controls">
              <button
                aria-label="Previous slide"
                className="nav-button"
                disabled={activeIndex === 0}
                onClick={() => goTo(activeIndex - 1)}
                type="button"
              >
                <Icon name="chevron-left" />
              </button>
              <div className="progress-track"><span style={{ width: progress }} /></div>
              <span className="progress-label">{activeIndex + 1} of {slides.length}</span>
              <button
                aria-label="Next slide"
                className="nav-button"
                disabled={activeIndex === slides.length - 1}
                onClick={() => goTo(activeIndex + 1)}
                type="button"
              >
                <Icon name="chevron-right" />
              </button>
            </div>
          </main>
        </div>

        {presenting && (
          <div className="presentation-controls">
            <button onClick={() => goTo(activeIndex - 1)} type="button"><Icon name="chevron-left" /></button>
            <span>{activeIndex + 1} / {slides.length}</span>
            <button onClick={() => goTo(activeIndex + 1)} type="button"><Icon name="chevron-right" /></button>
            <button onClick={() => setPresenting(false)} type="button"><Icon name="expand" /> Exit</button>
          </div>
        )}
      </div>
    </ThemeContext.Provider>
  );
}

export default App;
