import { useEffect } from 'react';

export type ShortcutMap = Record<string, () => void>;

/** True when the user is typing, so shortcuts must not hijack the key. */
function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;

  return (
    target.isContentEditable ||
    ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
  );
}

/**
 * Binds single-key presenter shortcuts.
 *
 * Keys are matched case-insensitively; `ArrowRight`, `ArrowLeft`, and ` ` (space) are usable as
 * names. Anything typed into a field, and any combo with a modifier, is left alone.
 */
export function useShortcuts(shortcuts: ShortcutMap, enabled = true): void {
  useEffect(() => {
    if (!enabled) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTyping(event.target)) return;

      const handler =
        shortcuts[event.key] ?? shortcuts[event.key.toLowerCase()];
      if (!handler) return;

      event.preventDefault();
      handler();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [shortcuts, enabled]);
}
