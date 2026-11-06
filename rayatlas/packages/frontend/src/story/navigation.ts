/** Pure step navigation shared by the presentation and its keyboard shortcuts. */

export interface NavigationState {
  index: number;
  count: number;
}

export type NavigationAction =
  | { type: 'next' }
  | { type: 'previous' }
  | { type: 'first' }
  | { type: 'last' }
  | { type: 'go'; index: number }
  | { type: 'resize'; count: number };

function clampIndex(index: number, count: number): number {
  if (count <= 0) return 0;
  return Math.min(Math.max(Math.trunc(index), 0), count - 1);
}

export function navigationReducer(state: NavigationState, action: NavigationAction): NavigationState {
  let index = state.index;
  let count = state.count;
  switch (action.type) {
    case 'next': index += 1; break;
    case 'previous': index -= 1; break;
    case 'first': index = 0; break;
    case 'last': index = count - 1; break;
    case 'go': index = Number.isFinite(action.index) ? action.index : index; break;
    case 'resize': count = Math.max(0, action.count); break;
  }
  const next = clampIndex(index, count);
  return next === state.index && count === state.count ? state : { index: next, count };
}

/**
 * Presentation shortcut for a key press, or `null` when the key is not a navigation key.
 * Space advances and Shift+Space goes back, matching slide software.
 */
export function navigationActionForKey(key: string, shiftKey = false): NavigationAction | null {
  switch (key) {
    case 'ArrowRight':
    case 'ArrowDown':
    case 'PageDown':
      return { type: 'next' };
    case ' ':
    case 'Spacebar':
      return shiftKey ? { type: 'previous' } : { type: 'next' };
    case 'ArrowLeft':
    case 'ArrowUp':
    case 'PageUp':
      return { type: 'previous' };
    case 'Home':
      return { type: 'first' };
    case 'End':
      return { type: 'last' };
    default:
      return null;
  }
}

/** True when a key event comes from a control that needs the key itself. */
export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}
