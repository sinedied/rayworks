import { useEffect, useId, useRef, useState } from 'react';

import type { DeckSlide } from '@/deck/sampleDeck';

import { Icon } from './Icon';

export function SlidePicker({ slides, index, onNavigate }: {
  slides: DeckSlide[]; index: number; onNavigate: (index: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapper = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const items = useRef<(HTMLButtonElement | null)[]>([]);
  const initialFocus = useRef(index);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    items.current[initialFocus.current]?.focus();
    const dismiss = (event: PointerEvent) => {
      if (event.target instanceof Node && !wrapper.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, [open]);

  const close = () => { setOpen(false); trigger.current?.focus(); };
  return (
    <div className="slide-picker" ref={wrapper}
      onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}
      onKeyDown={(event) => {
        if (!open) return;
        if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); }
        if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
          event.preventDefault(); event.stopPropagation();
          const active = items.current.findIndex((item) => item === document.activeElement);
          const target = event.key === 'Home' ? 0 : event.key === 'End' ? slides.length - 1
            : (active + (event.key === 'ArrowDown' ? 1 : -1) + slides.length) % slides.length;
          items.current[target]?.focus();
        }
      }}>
      <button className="slide-picker-trigger secondary-button" ref={trigger} type="button" aria-label="Jump to slide"
        aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? id : undefined}
        onClick={() => { initialFocus.current = index; setOpen((value) => !value); }}>
        <span>{index + 1} / {slides.length}</span><Icon name="chevron-up" size={16} />
      </button>
      {open && <div className="presenter-slide-picker" id={id} role="dialog" aria-label="Slide selection">
        <nav className="presenter-slide-list" aria-label="Jump to slide">
          <h2>Slides</h2>
          {slides.map((slide, position) => <button type="button" key={slide.id}
            ref={(element) => { items.current[position] = element; }}
            aria-current={position === index ? 'step' : undefined}
            onClick={() => { onNavigate(position); close(); }}>
            <span>{slide.number}</span><span>{slide.title || 'Untitled slide'}</span>
          </button>)}
        </nav>
      </div>}
    </div>
  );
}
