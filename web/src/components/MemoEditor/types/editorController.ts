import type { ActiveFormatState, EditorCommandContext, EditorCommandId } from "../Editor/editorCommands";

/**
 * The contract both memo editors (raw textarea and WYSIWYG) implement.
 * Everything outside an editor implementation talks markdown through this
 * interface and never reaches for an editor's internal DOM/ProseMirror APIs.
 */
export interface EditorController {
  focus(): void;
  hasFocus(): boolean;
  /** Whitespace-only content counts as empty. */
  isEmpty(): boolean;
  /** Current document as a markdown string (the only storage format). */
  getMarkdown(): string;
  /** Replace the whole document from a markdown string. */
  setMarkdown(markdown: string): void;
  /** Insert markdown at the cursor as its own block. */
  insertMarkdown(markdown: string): void;
  scrollToCursor(): void;
  /** Select the entire document (used by tests and select-all flows). */
  selectAll(): void;
  /**
   * Rich-formatting capability. Present only on editors that support it — the
   * WYSIWYG editor sets it; the raw textarea leaves it undefined. The
   * focus-mode FormattingToolbar (its only consumer) is shown solely in WYSIWYG
   * mode, so it can rely on this being present.
   */
  formatting?: FormattingController;
}

/**
 * Rich-formatting surface, backed by the editor command catalog
 * (Editor/editorCommands.ts). `getActiveFormats` is the sanctioned, typed place
 * editor state crosses the boundary — ProseMirror node/mark names never leak
 * out as stringly-typed `isActive(name)` calls.
 */
export interface FormattingController {
  /** Run a catalog command (e.g. "bold", "heading2", "link"). */
  run(command: EditorCommandId, ctx?: EditorCommandContext): void;
  /** Snapshot of which marks/blocks are active at the current selection. */
  getActiveFormats(): ActiveFormatState;
  /** Plain text of the current selection ("" when the selection is empty). */
  getSelectedText(): string;
  /** Register a listener fired on every transaction/selection change. Returns an unsubscribe. */
  subscribe(listener: () => void): () => void;
}
