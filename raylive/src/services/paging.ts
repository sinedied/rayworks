interface PagedQuery<T> {
  first: (count: number) => PagedQuery<T>;
  after: (cursor: string) => PagedQuery<T>;
  executePaginated: () => Promise<{
    items: T[];
    hasNextPage: boolean;
    endCursor?: string;
  }>;
}

/** Callers supply a stable sort, and finish reading before deleting any rows. */
export async function readAll<T>(query: PagedQuery<T>): Promise<T[]> {
  const rows: T[] = [];
  const cursors = new Set<string>();
  let next = query.first(100);
  for (;;) {
    const page = await next.executePaginated();
    rows.push(...page.items);
    if (!page.hasNextPage) return rows;
    if (!page.endCursor || cursors.has(page.endCursor)) {
      throw new Error('The server returned an invalid pagination cursor. Please retry.');
    }
    cursors.add(page.endCursor);
    next = next.after(page.endCursor);
  }
}
