import { type Extension, fileHandler, matchToken, type SuggestionAllowContext, scanTags, suggestion } from "@usememos/editor";
import { emoji } from "@usememos/editor/emoji";
import { memoExtensions, memoMentionOptions, memoTagOptions } from "@/lib/memo-markdown";
import type { UserSetting_TagsSetting } from "@/types/proto/api/user_service_pb";
import type { EditorPosition } from "../types/editorController";

/** The gesture that handed files to the editor: a drop lands at a document position, a paste has none. */
export type EditorFileOrigin = { source: "paste" } | { source: "drop"; position: EditorPosition | null };

export interface EditorExtensionsOptions {
  /** Known tags, read when the popup asks for items. */
  getTags: () => string[];
  onFiles: (files: File[], origin: EditorFileOrigin) => void;
  /** The user's tag settings, read when tags are drawn, for their custom colors. */
  getTagsSetting: () => UserSetting_TagsSetting | undefined;
  /** Whether a mentioned username belongs to a user, read when mentions are drawn. */
  isMentionResolved: (username: string) => boolean;
  /** Accessible name of the emoji popup. */
  emojiLabel: string;
}

/**
 * Ranks a candidate tag against the typed text (both already lower-cased).
 * Lower sorts first; `undefined` means the candidate does not match.
 *
 * Nested tags are paths, so a match inside the path counts: typing `mem` has to
 * reach `software/hosted/Memos`, which a full-path prefix test cannot do. The
 * tiers keep that from turning into noise — a segment start outranks an
 * incidental hit in the middle of a word.
 */
export const matchRank = (tag: string, typed: string): number | undefined => {
  const index = tag.indexOf(typed);
  if (index < 0) return undefined;
  if (index === 0) return 0; // Full-path prefix.
  if (tag[index - 1] === "/") return 1; // Path-segment start.
  return 2; // Anywhere else.
};

/** Known tags matching `query`, best first; incoming order is kept within a tier. */
export const rankTags = (tags: readonly string[], query: string): string[] => {
  const typed = query.toLowerCase();
  return tags
    .map((tag) => ({ tag, rank: matchRank(tag.toLowerCase(), typed) }))
    .filter((candidate): candidate is { tag: string; rank: number } => candidate.rank !== undefined)
    .sort((a, b) => a.rank - b.rank)
    .map(({ tag }) => tag);
};

/**
 * Where the tag popup may open. Not inside code or links, where `#` is literal,
 * and not for a bare `#` at the start of a line, which is more likely the start
 * of a heading. Ctrl+Space still opens it there.
 */
export const allowTagSuggestion = ({ excluded, explicit, query, textBefore }: SuggestionAllowContext): boolean => {
  if (excluded) return false;
  if (explicit) return true;
  return !(query === "" && /(^|\n)[ \t]*$/.test(textBefore));
};

export function buildEditorExtensions({
  getTags,
  onFiles,
  getTagsSetting,
  isMentionResolved,
  emojiLabel,
}: EditorExtensionsOptions): Extension[] {
  return [
    // Tags and mentions look the same as in the memo view.
    ...memoExtensions({ tags: memoTagOptions(getTagsSetting), mentions: memoMentionOptions(isMentionResolved) }),
    // The popup opens exactly where tags are highlighted: the matcher is built
    // from the same scanner as tags(). A pick writes "#work/planning ".
    suggestion({
      name: "tags",
      trigger: ["#", "＃"],
      match: matchToken(scanTags),
      allow: allowTagSuggestion,
      items: ({ query }) => rankTags(getTags(), query).map((tag) => ({ id: tag, label: `#${tag}`, value: tag })),
    }),
    // ":tada" lists emoji by name; a pick writes the emoji itself. The list loads on first use.
    emoji({ label: emojiLabel }),
    // Pasted files join the attachment list (a paste carries no placement
    // gesture); dropped files land where they were dropped.
    fileHandler({
      onPaste: ({ files }) => onFiles(files, { source: "paste" }),
      onDrop: ({ files, position }) => onFiles(files, { source: "drop", position }),
    }),
  ];
}
