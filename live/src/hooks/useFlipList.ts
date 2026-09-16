import { useCallback, useLayoutEffect, useRef } from 'react';

/**
 * Animates list rows that change order, using the FLIP technique: remember where each row was,
 * and after React reorders the DOM, move it back to its old position and let it transition to
 * the new one.
 *
 * CSS transitions cannot do this on their own — when a ranking or leaderboard reorders it is the
 * DOM order that changes, not a style. Rows are keyed by id, so the 3-second poll re-rendering
 * identical data produces no movement.
 */
export function useFlipList(keys: string[], durationMs = 400) {
  const nodes = useRef(new Map<string, HTMLElement>());
  const positions = useRef(new Map<string, number>());

  const register = useCallback(
    (key: string) => (element: HTMLElement | null) => {
      if (element) nodes.current.set(key, element);
      else nodes.current.delete(key);
    },
    []
  );

  useLayoutEffect(() => {
    const reducedMotion = window.matchMedia?.(
      '(prefers-reduced-motion: reduce)'
    ).matches;

    const next = new Map<string, number>();

    for (const [key, element] of nodes.current) {
      const top = element.getBoundingClientRect().top;
      next.set(key, top);

      const previous = positions.current.get(key);
      const delta = previous === undefined ? 0 : previous - top;

      if (!reducedMotion && delta && element.animate) {
        element.animate(
          [
            { transform: `translateY(${delta}px)` },
            { transform: 'translateY(0)' },
          ],
          { duration: durationMs, easing: 'cubic-bezier(0.2, 0, 0, 1)' }
        );
      }
    }

    positions.current = next;
  }, [keys, durationMs]);

  return register;
}
