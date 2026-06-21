/**
 * The contract both memo editors (raw textarea and WYSIWYG) implement.
 * Everything outside an editor implementation must talk markdown through this
 * interface and never reach for an editor's internal DOM/ProseMirror APIs.
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
  // Formatting intents — each editor realizes them natively.
  toggleBold(): void;
  toggleItalic(): void;
  toggleTaskList(): void;
}

/** Heading levels surfaced in the formatting toolbar's heading dropdown. */
export type ToolbarHeadingLevel = 1 | 2 | 3;

/**
 * Rich-formatting surface used by the focus-mode FormattingToolbar. Additive to
 * EditorController and implemented only by the WYSIWYG editor — the toolbar is
 * never shown for the raw editor, so EditorContent routes these to the WYSIWYG
 * handle and returns inert defaults in raw mode.
 *
 * isActive / subscribe are the sanctioned (and only) place ProseMirror state
 * leaks across the editor boundary, so toolbar buttons can reflect live state.
 */
export interface FormattingController {
  // toggleBold / toggleItalic / toggleTaskList come from EditorController — the
  // toolbar always consumes `EditorController & FormattingController`.
  toggleCode(): void;
  toggleBulletList(): void;
  toggleOrderedList(): void;
  /** Set the current block to a heading of the given level. */
  setHeading(level: ToolbarHeadingLevel): void;
  /** Set the current block back to a paragraph. */
  setParagraph(): void;
  /**
   * Toggle a link. When a link is active it is removed; otherwise the given URL
   * is applied to the current selection/word. No-ops when adding without a URL.
   */
  toggleLink(url?: string): void;
  /** Plain text of the current selection ("" when the selection is empty). */
  getSelectedText(): string;
  /** Whether a mark/node (optionally with attrs) is active at the selection. */
  isActive(name: string, attrs?: Record<string, unknown>): boolean;
  /** Register a listener fired on every editor transaction/selection change. Returns an unsubscribe. */
  subscribe(listener: () => void): () => void;
}
