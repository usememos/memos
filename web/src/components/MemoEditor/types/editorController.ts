/**
 * The contract both memo editors (raw textarea and Tiptap WYSIWYG) implement.
 * Everything outside an editor implementation must talk markdown through this
 * interface and never reach for editor-specific APIs like EditorRefActions.
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
