import { useLayoutEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react';

import { clampSplit, splitBounds } from '@/presentation/layout';

export function PresenterPanes({ ratio, onRatioChange, current, sidebar, currentId, sidebarId }: {
  ratio: number; onRatioChange: (ratio: number) => void;
  current: ReactNode; sidebar: ReactNode; currentId: string; sidebarId: string;
}) {
  const grid = useRef<HTMLDivElement>(null);
  const separator = useRef<HTMLDivElement>(null);
  const [availableWidth, setAvailableWidth] = useState(0);
  const [dragRatio, setDragRatio] = useState<number | null>(null);
  const drag = useRef<{ pointerId: number; startX: number; startRatio: number } | null>(null);
  const effectiveRatio = clampSplit(dragRatio ?? ratio, availableWidth);
  const { min, max } = splitBounds(availableWidth);

  useLayoutEffect(() => {
    const element = grid.current;
    const divider = separator.current;
    if (!element || !divider) return;
    const measure = () => {
      const style = getComputedStyle(element);
      setAvailableWidth(Math.max(0, element.clientWidth - parseFloat(style.paddingLeft || '0')
        - parseFloat(style.paddingRight || '0') - divider.offsetWidth));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    observer.observe(divider);
    return () => observer.disconnect();
  }, []);

  const cancelDrag = () => {
    const active = drag.current;
    drag.current = null;
    setDragRatio(null);
    if (active && separator.current?.hasPointerCapture(active.pointerId)) {
      separator.current.releasePointerCapture(active.pointerId);
    }
  };
  const pointerRatio = (event: PointerEvent<HTMLDivElement>) => {
    const active = drag.current;
    return active && availableWidth > 0
      ? clampSplit(active.startRatio + (event.clientX - active.startX) / availableWidth, availableWidth)
      : effectiveRatio;
  };

  return (
    <div className={`presenter-grid ${dragRatio !== null ? 'is-resizing' : ''}`} ref={grid}
      style={{ gridTemplateColumns: `minmax(0, ${effectiveRatio}fr) var(--presenter-divider-width) minmax(0, ${1 - effectiveRatio}fr)` }}>
      {current}
      <div className="presenter-divider" ref={separator} role="separator" tabIndex={0}
        aria-label="Resize presenter panes" aria-orientation="vertical" aria-controls={`${currentId} ${sidebarId}`}
        aria-valuemin={min * 100} aria-valuemax={max * 100} aria-valuenow={effectiveRatio * 100}
        aria-valuetext={`${Math.round(effectiveRatio * 100)}% current slide, ${Math.round((1 - effectiveRatio) * 100)}% next slide and notes`}
        title="Drag to resize. Use Left/Right arrows, Home, or End."
        onPointerDown={(event) => {
          if (event.button !== 0 || drag.current || availableWidth <= 0) return;
          event.preventDefault();
          event.currentTarget.focus();
          event.currentTarget.setPointerCapture(event.pointerId);
          drag.current = { pointerId: event.pointerId, startX: event.clientX, startRatio: effectiveRatio };
          setDragRatio(effectiveRatio);
        }}
        onPointerMove={(event) => {
          if (drag.current?.pointerId === event.pointerId) setDragRatio(pointerRatio(event));
        }}
        onPointerUp={(event) => {
          const active = drag.current;
          if (!active || active.pointerId !== event.pointerId) return;
          const next = pointerRatio(event);
          cancelDrag();
          if (Math.abs(next - active.startRatio) > 0.0001) onRatioChange(next);
        }}
        onPointerCancel={(event) => { if (drag.current?.pointerId === event.pointerId) cancelDrag(); }}
        onLostPointerCapture={(event) => { if (drag.current?.pointerId === event.pointerId) cancelDrag(); }}
        onKeyDown={(event) => {
          if (event.altKey || event.ctrlKey || event.metaKey || event.nativeEvent.isComposing) return;
          if (event.key === 'Escape' && drag.current) {
            event.preventDefault(); event.stopPropagation(); cancelDrag();
            return;
          }
          if (drag.current || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
          event.preventDefault();
          event.stopPropagation();
          const next = event.key === 'Home' ? min : event.key === 'End' ? max
            : effectiveRatio + (event.key === 'ArrowLeft' ? -0.02 : 0.02);
          onRatioChange(clampSplit(next, availableWidth));
        }}>
        <span className="presenter-divider-grip" aria-hidden="true" />
      </div>
      {sidebar}
    </div>
  );
}
