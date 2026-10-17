/** Lowercase word tokens used for prefix search. */
export function tokenize(...values: (string | null | undefined)[]): string[] {
  const tokens = new Set<string>();
  for (const value of values) {
    if (!value) continue;
    const lower = value.toLowerCase();
    for (const word of lower.split(/[^\p{L}\p{N}]+/u)) {
      if (word) tokens.add(word);
    }
  }
  return [...tokens];
}

export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Builds a filter requiring every query word to prefix-match one of the
 * document's search keys, e.g. "bisi sumec" matches "Mama Bisi's big Sumec".
 */
export function searchKeysFilter(query: string | undefined) {
  const trimmed = (query ?? "").trim();
  // A phone number typed with spaces ("0803 123 4567") is one search term.
  const words = /^[\d\s+\-()]+$/.test(trimmed)
    ? [trimmed.replace(/\D/g, "")].filter(Boolean)
    : tokenize(trimmed).slice(0, 5);
  if (words.length === 0) return {};
  return { searchKeys: { $all: words.map((w) => new RegExp(`^${escapeRegex(w)}`)) } };
}
