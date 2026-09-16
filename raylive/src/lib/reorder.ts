/**
 * Pure list reordering, kept separate from the drag interaction so the logic can be tested
 * without simulating pointer events.
 */

/** Moves the item at `from` to `to`, returning a new array. Out-of-range moves are no-ops. */
export function moveItem<T>(items: T[], from: number, to: number): T[] {
  if (
    from === to ||
    from < 0 ||
    to < 0 ||
    from >= items.length ||
    to >= items.length
  ) {
    return items;
  }

  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

/** Moves the item with the given id onto the position of another id. */
export function moveItemById(
  ids: string[],
  activeId: string,
  overId: string
): string[] {
  return moveItem(ids, ids.indexOf(activeId), ids.indexOf(overId));
}
