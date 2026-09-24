import { useId } from 'react';

export function SpeakerNotes({ value, onChange, slideNumber }: {
  value: string; onChange: (value: string) => void; slideNumber: string;
}) {
  const id = useId();
  return (
    <section className="speaker-notes" aria-label="Speaker notes">
      <div className="notes-heading">
        <label htmlFor={id}>Speaker notes</label>
        <span>Slide {slideNumber} · Not shown to the audience</span>
      </div>
      <textarea id={id} value={value} onChange={(event) => onChange(event.target.value)}
        placeholder="Add talking points for this slide..." rows={5} />
    </section>
  );
}
