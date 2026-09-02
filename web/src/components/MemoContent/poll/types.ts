/** Fenced code-block language tag used to embed a poll in memo Markdown. */
export const POLL_LANGUAGE_TAG = "poll";

// Poll UIDs are always uuidv4 (see CreatePollDialog.tsx). The id is embedded
// in free-form memo content - not sanitized like a normal identifier - and
// flows unmodified into a REST URL path segment, so constraining its shape
// here (mirroring the same check in server/router/api/v1/poll_definition.go)
// rejects malformed or oversized values before they ever reach the network.
const POLL_UID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * A poll's definition (question/options/type) lives inline in the memo's
 * Markdown content as a ```poll fenced block - it is not a backend resource.
 * Only the votes cast against a poll's `id` are persisted server-side.
 */
export interface PollDefinition {
  id: string;
  question: string;
  type: "single" | "multiple";
  options: string[];
}

export const parsePollDefinition = (content: string): PollDefinition | null => {
  let data: unknown;
  try {
    data = JSON.parse(content);
  } catch {
    return null;
  }
  if (typeof data !== "object" || data === null) return null;
  const candidate = data as Record<string, unknown>;

  if (typeof candidate.id !== "string" || !POLL_UID_PATTERN.test(candidate.id)) return null;
  if (typeof candidate.question !== "string" || candidate.question.trim().length === 0) return null;
  if (!Array.isArray(candidate.options)) return null;

  const options = candidate.options.filter((option): option is string => typeof option === "string" && option.trim().length > 0);
  if (options.length < 2) return null;

  return {
    id: candidate.id,
    question: candidate.question,
    type: candidate.type === "multiple" ? "multiple" : "single",
    options,
  };
};
