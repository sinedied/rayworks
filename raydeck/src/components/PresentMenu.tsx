import { useEffect, useId, useRef, useState, type RefObject } from 'react';

import { Icon } from './Icon';

export function PresentMenu({ trigger, onFullscreen, onWindowed, onPresenter }: {
  trigger: RefObject<HTMLButtonElement | null>;
  onFullscreen: () => void;
  onWindowed: () => void;
  onPresenter: () => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapper = useRef<HTMLDivElement>(null);
  const options = useRef<(HTMLButtonElement | null)[]>([]);
  const firstFocus = useRef(0);
  const id = useId();
  const actions = [
    { label: 'Present fullscreen', icon: 'expand' as const, onSelect: onFullscreen },
    { label: 'Present in this window', icon: 'play' as const, onSelect: onWindowed },
    { label: 'Enter presenter mode', icon: 'presenter' as const, onSelect: onPresenter },
  ];
  useEffect(() => {
    if (!open) return;
    options.current[firstFocus.current]?.focus();
    const dismiss = (event: PointerEvent) => {
      if (event.target instanceof Node && !wrapper.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, [open]);
  return (
    <div className="present-menu" ref={wrapper}
      onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && open) {
          event.preventDefault(); event.stopPropagation(); setOpen(false); trigger.current?.focus();
        } else if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
          event.preventDefault(); event.stopPropagation();
          const current = options.current.findIndex((option) => option === document.activeElement);
          firstFocus.current = event.key === 'Home' ? 0 : event.key === 'End' ? actions.length - 1
            : (current + (event.key === 'ArrowDown' ? 1 : -1) + actions.length) % actions.length;
          if (!open) { firstFocus.current = event.key === 'ArrowUp' ? actions.length - 1 : 0; setOpen(true); }
          else options.current[firstFocus.current]?.focus();
        }
      }}>
      <button ref={trigger} className="present-button" aria-label="Present" aria-haspopup="menu"
        aria-expanded={open} aria-controls={open ? id : undefined} type="button"
        onClick={() => { firstFocus.current = 0; setOpen((value) => !value); }}>
        <Icon name="play" size={16} /><span>Present</span><Icon name="chevron-down" size={16} />
      </button>
      {open && <div className="present-panel" role="menu" aria-label="Presentation options" id={id}>
        {actions.map((action, index) => (
          <button
            className="save-action"
            key={action.label}
            onClick={() => {
              setOpen(false);
              trigger.current?.focus();
              action.onSelect();
            }}
            ref={(element) => { options.current[index] = element; }}
            role="menuitem"
            type="button"
          >
            <Icon name={action.icon} />{action.label}
          </button>
        ))}
        <p className="save-description">
          Use this window, request fullscreen, or open a separate presenter console.
        </p>
      </div>}
    </div>
  );
}
