/**
 * Choice lists and multi-choice answers are stored as JSON-encoded string arrays.
 * Parsing is defensive: malformed or hand-edited data must not crash the renderer.
 */
export function parseStringArray(raw: string | null | undefined): string[] {
  if (!raw) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string')
      : [];
  } catch {
    return [];
  }
}
