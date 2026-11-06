import { ChevronDown, Maximize, MonitorPlay, Play } from 'lucide-react';
import { useEffect, useId, useRef, useState, type RefObject } from 'react';

/** Present button with fullscreen and in-window options, mirroring Ray|Deck. */
export function PresentMenu({ trigger, onFullscreen, onWindowed }: {
  trigger: RefObject<HTMLButtonElement | null>;
  onFullscreen: () => void;
  onWindowed: () => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapper = useRef<HTMLDivElement>(null);
  const options = useRef<(HTMLButtonElement | null)[]>([]);
  const firstFocus = useRef(0);
  const id = useId();
  const actions = [
    { label: 'Present fullscreen', Icon: Maximize, onSelect: onFullscreen },
    { label: 'Present in this window', Icon: MonitorPlay, onSelect: onWindowed },
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
      <button ref={trigger} className="stage-button stage-button-primary" aria-label="Present" aria-haspopup="menu"
        aria-expanded={open} aria-controls={open ? id : undefined} type="button"
        onClick={() => { firstFocus.current = 0; setOpen((value) => !value); }}>
        <Play className="icon-size-200" aria-hidden /><span className="toolbar-label">Present</span>
        <ChevronDown className="icon-size-200" aria-hidden />
      </button>
      {open && (
        <div className="stage-panel present-panel" role="menu" aria-label="Presentation options" id={id}>
          {actions.map(({ label, Icon, onSelect }, index) => (
            <button
              className="panel-action"
              key={label}
              onClick={() => {
                setOpen(false);
                trigger.current?.focus();
                onSelect();
              }}
              ref={(element) => { options.current[index] = element; }}
              role="menuitem"
              type="button"
            >
              <Icon className="icon-size-200" aria-hidden />{label}
            </button>
          ))}
          <p className="panel-description">
            Play the story chapter by chapter with the arrow keys, Space, or autoplay. Press Esc to stop.
          </p>
        </div>
      )}
    </div>
  );
}
