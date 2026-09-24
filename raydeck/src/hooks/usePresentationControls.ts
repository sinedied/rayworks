import { useCallback, useEffect, useRef, useState, type FocusEvent } from 'react';

import { isScaledChartPointer } from '@/components/chartPointer';

export function usePresentationControls() {
  const [visible, setVisible] = useState(true);
  const visibleRef = useRef(true);
  const controls = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const atBottom = useRef(false);
  const hovered = useRef(false);
  const focused = useRef(false);
  const keyboardInput = useRef(true);
  const stopTimer = useCallback(() => { if (timer.current !== null) clearTimeout(timer.current); }, []);
  const scheduleHide = useCallback(() => {
    stopTimer();
    if (visibleRef.current && !atBottom.current && !hovered.current && !focused.current) {
      timer.current = setTimeout(() => {
        visibleRef.current = false;
        setVisible(false);
      }, 3000);
    }
  }, [stopTimer]);
  const reveal = useCallback(() => {
    visibleRef.current = true;
    setVisible(true);
    scheduleHide();
  }, [scheduleHide]);

  useEffect(() => {
    scheduleHide();
    const pointer = (event: PointerEvent) => {
      if (isScaledChartPointer(event)) return;
      if (event.type === 'pointerdown') {
        const wasFocused = focused.current;
        keyboardInput.current = false;
        focused.current = false;
        if (wasFocused) scheduleHide();
      }
      const bottom = event.clientY >= window.innerHeight - 80;
      if (event.pointerType === 'touch') {
        if (bottom) { atBottom.current = false; reveal(); }
        return;
      }
      const wasBottom = atBottom.current;
      atBottom.current = bottom;
      if (bottom) reveal();
      else if (wasBottom) scheduleHide();
    };
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === 'Tab') keyboardInput.current = true;
    };
    const leave = () => { atBottom.current = false; hovered.current = false; scheduleHide(); };
    window.addEventListener('pointermove', pointer, true);
    window.addEventListener('pointerdown', pointer, true);
    window.addEventListener('keydown', keyboard, true);
    document.documentElement.addEventListener('pointerleave', leave);
    return () => {
      stopTimer();
      window.removeEventListener('pointermove', pointer, true);
      window.removeEventListener('pointerdown', pointer, true);
      window.removeEventListener('keydown', keyboard, true);
      document.documentElement.removeEventListener('pointerleave', leave);
    };
  }, [reveal, scheduleHide, stopTimer]);

  return {
    visible, controls,
    onPointerEnter: () => { hovered.current = true; reveal(); },
    onPointerLeave: () => { hovered.current = false; scheduleHide(); },
    onFocus: () => {
      focused.current = keyboardInput.current;
      if (focused.current) reveal();
    },
    onBlur: (event: FocusEvent<HTMLDivElement>) => {
      if (!event.currentTarget.contains(event.relatedTarget)) { focused.current = false; scheduleHide(); }
    },
  };
}
