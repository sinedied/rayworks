// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';

import { bindChartScale } from './chartPointer';

describe('scaled chart coordinates', () => {
  it('maps pointer/selection events once, preserving modifiers and removing listeners on cleanup', () => {
    const root = document.createElement('div');
    root.getBoundingClientRect = () => new DOMRect(100, 200, 400, 200);
    const unbind = bindChartScale({ root, width: 800, height: 400 });
    const received: MouseEvent[] = [];
    root.addEventListener('click', (event) => received.push(event));
    root.dispatchEvent(new PointerEvent('click', { clientX: 200, clientY: 250, shiftKey: true, pointerType: 'touch' }));
    expect(received).toHaveLength(1);
    expect(received[0].clientX).toBe(300);
    expect(received[0].clientY).toBe(300);
    expect(received[0].shiftKey).toBe(true);
    expect(received[0]).toHaveProperty('pointerType', 'touch');
    unbind();
    root.dispatchEvent(new PointerEvent('click', { clientX: 200, clientY: 250 }));
    expect(received[1].clientX).toBe(200);
  });

  it('leaves native events untouched at full size', () => {
    const root = document.createElement('div');
    root.getBoundingClientRect = () => new DOMRect(0, 0, 800, 400);
    const unbind = bindChartScale({ root, width: 800, height: 400 });
    const original = new PointerEvent('pointermove', { clientX: 20 });
    let received: Event | undefined;
    root.addEventListener('pointermove', (event) => { received = event; });
    root.dispatchEvent(original);
    expect(received).toBe(original);
    unbind();
  });
});
