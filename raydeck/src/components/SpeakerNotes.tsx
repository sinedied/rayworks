import { useId } from 'react';

import { MAX_NOTES_SIZE, MIN_NOTES_SIZE, NOTES_SIZE_STEP } from '@/hooks/useViewPreferences';

import { Icon } from './Icon';

export function SpeakerNotes({ value, onChange, slideNumber, fontSize, onFontSizeChange }: {
  value: string; onChange: (value: string) => void; slideNumber: string;
  fontSize: number; onFontSizeChange: (size: number) => void;
}) {
  const id = useId();
  return (
    <section className="speaker-notes" aria-label="Speaker notes">
      <div className="notes-heading">
        <div className="notes-label">
          <label htmlFor={id}>Speaker notes</label>
          <span className="notes-slide-number">Slide {slideNumber}</span>
        </div>
        <div className="notes-zoom" role="group" aria-label="Notes text size">
          <button className="icon-button" type="button" aria-label="Decrease notes text size" title="Decrease notes text size"
            disabled={fontSize <= MIN_NOTES_SIZE} onClick={() => onFontSizeChange(fontSize - NOTES_SIZE_STEP)}>
            <Icon name="minus" />
          </button>
          <output aria-label="Notes text size" aria-live="polite">{fontSize}px</output>
          <button className="icon-button" type="button" aria-label="Increase notes text size" title="Increase notes text size"
            disabled={fontSize >= MAX_NOTES_SIZE} onClick={() => onFontSizeChange(fontSize + NOTES_SIZE_STEP)}>
            <Icon name="plus" />
          </button>
        </div>
      </div>
      <textarea id={id} value={value} onChange={(event) => onChange(event.target.value)}
        placeholder="Add talking points for this slide..." rows={5} style={{ fontSize }} />
    </section>
  );
}
