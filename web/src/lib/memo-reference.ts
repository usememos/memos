import { memoNamePrefix } from "@/lib/resource-names";

/**
 * An inline memo reference is an ordinary Markdown link to the memo's own page:
 * `[Memos](/memos/<uid>)`. Nothing custom is stored, so a reference survives
 * exports, other Markdown clients, and hand editing — and the server derives the
 * REFERENCE relation from the very same link, which makes the content the single
 * source of truth for what a memo references.
 */

/** Mirrors `internal/identifier.UIDMatcher`, so both ends agree on what a UID is. */
const UID_PATTERN = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,34}[a-zA-Z0-9])?$/;

/** The path a memo is addressed by, which doubles as the reference syntax. */
const MEMO_REFERENCE_PATH_PREFIX = `/${memoNamePrefix}`;

/**
 * The label a freshly inserted reference carries. Deliberately not the target's
 * snippet: a snippet written for its own memo rarely reads correctly inside the
 * referencing sentence. The author renames it like any other link text.
 */
export const MEMO_REFERENCE_LABEL = "Memos";

export const buildMemoReferenceURL = (uid: string): string => `${MEMO_REFERENCE_PATH_PREFIX}${uid}`;

export const buildMemoReferenceMarkdown = (uid: string, label: string = MEMO_REFERENCE_LABEL): string =>
  `[${label}](${buildMemoReferenceURL(uid)})`;

/**
 * The referenced memo's UID, or `undefined` when the destination is an ordinary link.
 *
 * Only root-relative paths count: an absolute URL naming another host's `/memos/`
 * path is somebody else's link, and content is parsed without knowing this
 * instance's own origin. A fragment is kept — linking to a heading inside a memo
 * still references that memo.
 */
export const parseMemoReferenceURL = (raw?: string): string | undefined => {
  if (!raw?.startsWith(MEMO_REFERENCE_PATH_PREFIX)) return undefined;
  const [pathAndQuery] = raw.split("#", 1);
  if (pathAndQuery.includes("?")) return undefined;
  const uid = pathAndQuery.slice(MEMO_REFERENCE_PATH_PREFIX.length);
  // Percent-encoding cannot appear in a UID, so UID_PATTERN also rejects it.
  return UID_PATTERN.test(uid) ? uid : undefined;
};
