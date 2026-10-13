import type { Position, SelectionJSON } from "@usememos/editor";
import type { UploadAnchorDescriptor } from "../Editor/uploadAnchors";

/** A place in the document, such as where files were dropped. Valid until the document changes. */
export type EditorPosition = Position;

/** A selection that survives reloading the same Markdown, for restoring the caret across mounts. */
export type EditorSelection = SelectionJSON;

/**
 * The contract the memo editor (Editor) implements. Everything outside the
 * editor implementation talks markdown through this interface and never reaches
 * for the editor's internal APIs.
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
  /** Insert markdown at the caret as its own block, keeping any selected text. */
  insertMarkdown(markdown: string): void;
  /** Actual Markdown tags, excluding code, URLs, and other literal contexts. */
  getTags(): string[];
  /** Whether the document contains a Markdown checklist item, checked or unchecked. */
  hasChecklist(): boolean;
  /** Insert a tag at the caret without replacing selected text, then advance the caret. Returns whether it was inserted. */
  insertTag(tag: string): boolean;
  /** Shows an upload placeholder after the block at `position` (default: the caret's block). */
  createUploadAnchor(descriptor: UploadAnchorDescriptor, position?: EditorPosition | null): void;
  updateUploadAnchor(descriptor: UploadAnchorDescriptor): void;
  /** Replaces the placeholder with `markdown`, as blocks after its block. Empty markdown cancels it. */
  resolveUploadAnchor(id: string, markdown: string): void;
  cancelUploadAnchor(id: string): void;
  getSelection(): EditorSelection | undefined;
  setSelection(selection: EditorSelection): void;
  /** Select the entire document (used by tests and select-all flows). */
  selectAll(): void;
  /** Turns the blocks the selection touches into task items, keeping their text. Returns whether anything changed. */
  toggleTaskList(): boolean;
}
