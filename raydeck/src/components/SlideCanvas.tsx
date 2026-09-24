import { useLayoutEffect, useRef, useState } from 'react';

import type { SlideTextField } from '@/deck/changes';
import type { DeckSlide } from '@/deck/sampleDeck';

import { Chart } from './Chart';

function SlideText({
  value, field, className, fontSize, minSize, maxHeight, readOnly, onChange, onOverflow,
}: {
  value: string;
  field: SlideTextField;
  className: string;
  fontSize: number;
  minSize: number;
  maxHeight: number;
  readOnly: boolean;
  onChange?: (field: SlideTextField, value: string) => void;
  onOverflow?: (field: SlideTextField, overflowing: boolean) => void;
}) {
  const mirror = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState(fontSize);
  const [overflow, setOverflow] = useState(false);

  useLayoutEffect(() => {
    const element = mirror.current;
    if (!element) return;
    let active = true;
    const measure = () => {
      if (!active || !element.clientWidth) return;
      const fits = (candidate: number) => {
        element.style.fontSize = `${candidate}px`;
        return element.scrollHeight <= maxHeight && element.scrollWidth <= element.clientWidth;
      };
      let low = minSize;
      let high = fontSize;
      while (low < high) {
        const middle = Math.ceil((low + high) / 2);
        if (fits(middle)) low = middle;
        else high = middle - 1;
      }
      const overflowing = !fits(low);
      setSize(low);
      setOverflow(overflowing);
      onOverflow?.(field, overflowing);
    };
    measure();
    void document.fonts?.ready.then(measure);
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    document.fonts?.addEventListener('loadingdone', measure);
    return () => {
      active = false;
      observer.disconnect();
      document.fonts?.removeEventListener('loadingdone', measure);
    };
  }, [value, field, fontSize, minSize, maxHeight, onOverflow]);

  return (
    <div className={`slide-text ${className} ${overflow ? 'text-overflow' : ''}`}
      data-field={field} data-overflow={overflow || undefined} style={{ fontSize: size }}>
      <div ref={mirror} className="slide-text-content" aria-hidden={!readOnly}
        style={{ maxHeight }}>{value || '\u200b'}{value.endsWith('\n') ? '\u200b' : ''}</div>
      {!readOnly && (
        <textarea aria-label={`Edit slide ${field}`} aria-invalid={overflow || undefined}
          className="slide-text-input" spellCheck value={value} rows={1}
          onChange={(event) => onChange?.(field, event.target.value)} />
      )}
    </div>
  );
}

export function SlideCanvas({
  slide, total, readOnly = true, onChange, onOverflow,
}: {
  slide: DeckSlide;
  total: number;
  readOnly?: boolean;
  onChange?: (field: SlideTextField, value: string) => void;
  onOverflow?: (field: SlideTextField, overflowing: boolean) => void;
}) {
  const cover = slide.kind === 'cover';
  const text = (field: SlideTextField, extraClass = '') => (
    <SlideText key={field} value={slide[field]} field={field} className={`slide-${field} ${extraClass}`}
      fontSize={field === 'title' ? (cover ? 86 : 54) : field === 'body' ? 22 : 14}
      minSize={field === 'title' ? 28 : field === 'body' ? 16 : 12}
      maxHeight={field === 'title' ? (cover ? 226 : 136) : field === 'body' ? (cover ? 142 : 300) : 44}
      readOnly={readOnly} onChange={onChange} onOverflow={onOverflow} />
  );

  return (
    <article className={`slide slide-${slide.kind}`} data-slide-id={slide.id}>
      {cover ? (
        <>
          <div className="slide-orbit" />
          <img alt="Ray|Deck" className="slide-cover-logo" src="/raydeck-dark.svg" />
          <div className="slide-cover-copy">
            {text('eyebrow')}
            {text('title', 'slide-title-display')}
            {text('body', 'slide-body-wide')}
          </div>
          <div className="slide-cover-mark" aria-hidden="true"><span /><span /><span /></div>
        </>
      ) : (
        <>
          <header className="slide-header">
            <div>{text('eyebrow')}{text('title')}</div>
            <span className="slide-number">{slide.number}</span>
          </header>

          {slide.kind === 'metrics' && (
            <div className="metrics-layout">
              <div className="slide-narrative">
                {text('body')}
                <span className="narrative-rule" />
              </div>
              <div className="metric-stack">
                {slide.metrics?.map((metric) => (
                  <div className="metric-row" key={metric.label}>
                    <div><span className="metric-label">{metric.label}</span><strong>{metric.value}</strong></div>
                    <span className={metric.positive ? 'metric-change positive' : 'metric-change'}>{metric.change}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(slide.kind === 'chart' || slide.kind === 'comparison') && slide.chart && (
            <div className="chart-layout">
              <div className="slide-narrative">
                {text('body')}
                <div className="insight-chip"><span />Sample connected visual</div>
              </div>
              <div className="chart-frame">
                <Chart spec={slide.chart} scaled />
                <span className="chart-source">{slide.source}</span>
              </div>
            </div>
          )}

          {slide.kind === 'closing' && (
            <div className="closing-layout">
              <div className="closing-statement">{text('body')}</div>
              <ol className="priority-list">
                <li><span>01</span><strong>Shorten onboarding</strong><small>Remove friction from the first 30 days.</small></li>
                <li><span>02</span><strong>Scale partners</strong><small>Package the repeatable motion.</small></li>
                <li><span>03</span><strong>Operationalize expansion</strong><small>Turn product signals into action.</small></li>
              </ol>
            </div>
          )}
        </>
      )}
      <footer className="slide-footer">
        <span>Ray|Deck sample</span>
        <span>{slide.number} / {String(total).padStart(2, '0')}</span>
      </footer>
    </article>
  );
}
