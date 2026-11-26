import {
  containerContent,
  type Extension,
  fileHandler,
  inlineText,
  matchToken,
  type SuggestionAllowContext,
  type SuggestionItem,
  scanTags,
  suggestion,
} from "@usememos/editor";
import { emoji } from "@usememos/editor/emoji";
import type { EditorPosition } from "./types/editorController";

/** The gesture that handed files to the editor: a drop lands at a document position, a paste has none. */
export type EditorFileOrigin = { source: "paste" } | { source: "drop"; position: EditorPosition | null };

export type TagAction = { label: string; request: (content: string) => void };

export interface EditorExtensionsOptions {
  /** Known tags, read when the popup asks for items. */
  getTags: () => string[];
  getTagAction?: () => TagAction | undefined;
  onFiles: (files: File[], origin: EditorFileOrigin) => void;
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

/** What only the composer adds to the memo syntax MemoMarkdown already reads: autocomplete and file handling. */
export function buildEditorExtensions({ getTags, getTagAction, onFiles, emojiLabel }: EditorExtensionsOptions): Extension[] {
  const localTagLimit = 6;
  const actionId = "action:suggest-tags";
  return [
    // The popup opens exactly where tags are highlighted: the matcher is built
    // from the same scanner as tags(). A pick writes "#work/planning ".
    suggestion<SuggestionItem>({
      name: "tags",
      trigger: ["#", "＃"],
      match: matchToken(scanTags),
      allow: allowTagSuggestion,
      className: "memo-tag-picker",
      items: ({ query, editor, explicit }) => {
        const action = getTagAction?.();
        // Only a picker that offers the AI command is kept short, so the command stays in view.
        const tags = rankTags(getTags(), query)
          .slice(0, action ? localTagLimit : undefined)
          .map((tag) => ({ id: tag, label: `#${tag}`, value: tag }));
        // The command never opens the picker by itself. A lone row is highlighted, and Enter after a
        // "#" would run it instead of ending the line. Ctrl+Space asks for the picker, so it shows there.
        if (!action || (!tags.length && !explicit)) return tags;
        const draft = editor.getMarkdown().trim();
        if (/^[#＃][^\s#＃]*$/u.test(draft) || new TextEncoder().encode(draft).length > 64 * 1024) return tags;
        // The row has no id or class of its own, so an empty element in its icon slot marks it for editor.css.
        const mark = editor.root.ownerDocument.createElement("span");
        mark.className = "memo-suggest-tags-mark";
        return [...tags, { id: actionId, label: action.label, icon: mark }];
      },
      command: ({ editor, range, item }) => {
        if (item.id === actionId) {
          const action = getTagAction?.();
          if (action && editor.commands.insertText("", { range })) action.request(editor.getMarkdown());
          return;
        }
        // Match the editor's default tag completion in prose, table cells and Markdown source.
        const block = editor.state.doc.blocks.find((candidate) => candidate.id === range.to.blockId);
        const content = block && containerContent(block, range.to.cell);
        if (!content) return;
        const next = inlineText(content)[range.to.offset];
        const space =
          next && !(next === "\n" && editor.mode === "source") && /[\s.,;:!?)\]}>'"’”»）」』】、。，．：；！？]/u.test(next) ? "" : " ";
        editor.commands.insertText(`#${item.value}${space}`, { range });
      },
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
