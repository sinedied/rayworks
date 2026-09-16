/**
 * DAB rejects the *read-back* of a row an anonymous caller just wrote, even though the
 * write itself committed. The error text states the mutation "was successful", which is
 * what distinguishes it from a genuine failure.
 */
export function isWriteSucceededButUnreadable(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.message.includes('was successful') &&
    error.message.includes('read permissions')
  );
}

/**
 * Runs a create that anonymous callers may not be allowed to read back, returning the
 * locally built row in that case. Ids are generated client-side so callers never depend
 * on the server echoing the created row.
 */
export async function createTolerantly<T>(
  create: () => Promise<T>,
  fallback: T
): Promise<T> {
  try {
    return await create();
  } catch (error) {
    if (isWriteSucceededButUnreadable(error)) return fallback;
    throw error;
  }
}
