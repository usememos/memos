/**
 * Builds the CEL filter that selects the notes an AI Hub turn may read.
 *
 * The server treats this as an opaque filter and resolves it through the same
 * access-scoped query the memo list uses, so nothing here can widen what the
 * caller is allowed to read. An empty selection yields an empty filter, which
 * the server interprets as "no notes" rather than "all notes".
 */
export const buildContextFilter = (tags: string[]): string => {
  const unique = [...new Set(tags.map((tag) => tag.trim()).filter((tag) => tag !== ""))];
  if (unique.length === 0) return "";
  return `tag in [${unique.map(quoteCELString).join(", ")}]`;
};

/** Escapes a tag for a CEL string literal. */
const quoteCELString = (value: string): string => `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;

/** Formats a token count for display, e.g. 32000 -> "32,000". */
export const formatTokenCount = (tokens: number): string => tokens.toLocaleString();

/**
 * Describes a context selection in one line. The receipt is deliberately
 * explicit about how much of the selection the model will read, because the
 * server refuses an over-budget selection instead of trimming it.
 */
export const describeContextSelection = (memoCount: number, estimatedTokens: number, budgetTokens: number): string => {
  if (memoCount === 0) return "No notes selected";
  return `${memoCount} note${memoCount === 1 ? "" : "s"} · ~${formatTokenCount(estimatedTokens)} / ${formatTokenCount(budgetTokens)} tokens`;
};
