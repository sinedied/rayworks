import type { Surface } from 'graphein';

const chartEvents = new WeakSet<Event>();

export function isScaledChartPointer(event: Event) {
  return chartEvents.has(event);
}

/** Adapt Graphein 0.18 pointer and tooltip measurements to a scaled slide. */
export function bindChartScale(surface: Pick<Surface, 'root' | 'width' | 'height'>) {
  const { root } = surface;
  let forwarding = false;
  let tooltipFrame = 0;
  const constrainTooltip = () => {
    tooltipFrame = 0;
    const tooltip = root.querySelector<HTMLElement>('.graphein-tooltip');
    const rect = root.getBoundingClientRect();
    if (!tooltip || tooltip.style.opacity === '0' || !rect.width || !rect.height) return;
    tooltip.style.translate = '0px 0px';
    const bounds = tooltip.getBoundingClientRect();
    const scaleX = surface.width / rect.width;
    const scaleY = surface.height / rect.height;
    const dx = Math.max(rect.left + 8 / scaleX - bounds.left, Math.min(0, rect.right - 8 / scaleX - bounds.right));
    const dy = Math.max(rect.top + 8 / scaleY - bounds.top, Math.min(0, rect.bottom - 8 / scaleY - bounds.bottom));
    tooltip.style.translate = `${dx * scaleX}px ${dy * scaleY}px`;
  };
  const mapPointer = (event: MouseEvent) => {
    if (forwarding) return;
    const rect = root.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const scaleX = surface.width / rect.width;
    const scaleY = surface.height / rect.height;
    if (Math.abs(scaleX - 1) < 0.001 && Math.abs(scaleY - 1) < 0.001) {
      const tooltip = root.querySelector<HTMLElement>('.graphein-tooltip');
      if (tooltip) tooltip.style.translate = '';
      return;
    }
    const coordinates: PointerEventInit = {
      bubbles: true,
      cancelable: true,
      clientX: rect.left + (event.clientX - rect.left) * scaleX,
      clientY: rect.top + (event.clientY - rect.top) * scaleY,
      button: event.button,
      buttons: event.buttons,
      altKey: event.altKey,
      ctrlKey: event.ctrlKey,
      metaKey: event.metaKey,
      shiftKey: event.shiftKey,
    };
    if (event instanceof PointerEvent) {
      coordinates.pointerId = event.pointerId;
      coordinates.pointerType = event.pointerType;
      coordinates.isPrimary = event.isPrimary;
    }
    const mapped = new PointerEvent(event.type, coordinates);
    chartEvents.add(mapped);
    event.stopImmediatePropagation();
    forwarding = true;
    try {
      root.dispatchEvent(mapped);
    } finally {
      forwarding = false;
    }
    if (mapped.defaultPrevented) event.preventDefault();
    cancelAnimationFrame(tooltipFrame);
    tooltipFrame = requestAnimationFrame(constrainTooltip);
  };
  const events = ['pointermove', 'pointerdown', 'click'] as const;
  events.forEach((type) => root.addEventListener(type, mapPointer, true));
  return () => {
    cancelAnimationFrame(tooltipFrame);
    events.forEach((type) => root.removeEventListener(type, mapPointer, true));
  };
}
