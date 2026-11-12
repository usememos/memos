import { type Block, type Editor, inlineText, type Widget } from "@usememos/editor";
import { collectTags, parseMemoMarkdown } from "@/lib/memo-markdown";
import { isCompleteTagValue } from "@/utils/tag-grammar";
import type { EditorController } from "./types/editorController";
import { renderUploadAnchor } from "./uploadAnchors";

/** The live editor, or null before it mounts and after it is destroyed. */
type EditorGetter = () => Editor | null;

const live = (getEditor: EditorGetter): Editor | null => {
  const editor = getEditor();
  return editor && !editor.isDestroyed ? editor : null;
};

/**
 * The memo's blocks. Source mode holds the whole memo as one block of Markdown
 * text, so the blocks are read from that text instead.
 */
const memoBlocks = (editor: Editor): readonly Block[] =>
  editor.mode === "source" ? parseMemoMarkdown(editor.getMarkdown()).blocks : editor.state.doc.blocks;

/** An empty paragraph, which inserted blocks take the place of rather than follow. */
const isEmptyParagraph = (block: Block): boolean => block.type === "paragraph" && inlineText(block.content) === "";

/**
 * EditorController over a @usememos/editor instance. Every method reads the
 * live editor when called, so the controller can be handed out before the
 * editor mounts, and calls after it is destroyed do nothing. The editor does
 * not emit a change for a replaced document, so `onReplace` reports it.
 */
export function createController(getEditor: EditorGetter, onReplace: (markdown: string) => void): EditorController {
  const anchors = new Map<string, Widget>();
  const currentTags = (editor: Editor) => collectTags(memoBlocks(editor));

  const takeAnchor = (id: string): Widget | undefined => {
    const widget = anchors.get(id);
    anchors.delete(id);
    return widget && !widget.isRemoved ? widget : undefined;
  };

  return {
    focus: () => live(getEditor)?.focus(),
    hasFocus: () => live(getEditor)?.hasFocus() ?? false,
    isEmpty: () => (live(getEditor)?.getMarkdown() ?? "").trim() === "",
    getMarkdown: () => getEditor()?.getMarkdown() ?? "",
    setMarkdown: (markdown) => {
      const editor = live(getEditor);
      if (!editor) return;
      editor.setMarkdown(markdown);
      onReplace(markdown);
    },
    insertMarkdown: (markdown) => {
      const editor = live(getEditor);
      if (!editor || !markdown) return;
      // Insert at the caret without consuming the selection: callers live outside
      // the editor (attachment list, audio recorder), and replacing the range
      // would delete text the user merely had highlighted. An empty paragraph at
      // the caret is replaced, as a paste would.
      editor.commands.insertMarkdown(markdown, { at: editor.getSelection().focus, block: true });
      editor.commands.focus();
      editor.commands.scrollIntoView();
    },
    getTags: () => {
      const editor = live(getEditor);
      return editor ? currentTags(editor) : [];
    },
    hasChecklist: () => {
      const editor = live(getEditor);
      return editor ? memoBlocks(editor).some((block) => block.type === "listItem" && block.listType === "task") : false;
    },
    insertTag: (tag) => {
      const editor = live(getEditor);
      if (!editor || !isCompleteTagValue(tag) || currentTags(editor).includes(tag)) return false;
      // As a word of its own at the caret, keeping highlighted text and the Markdown
      // context, including code; refused while an input method is composing.
      if (!editor.commands.insertToken(`#${tag}`)) return false;
      editor.commands.focus();
      editor.commands.scrollIntoView();
      return true;
    },
    createUploadAnchor: (descriptor, position) => {
      const editor = live(getEditor);
      if (!editor) return;
      takeAnchor(descriptor.id)?.remove();
      const at = position ?? editor.getSelection().focus;
      anchors.set(descriptor.id, editor.addWidget({ at, render: renderUploadAnchor(descriptor) }));
    },
    updateUploadAnchor: (descriptor) => {
      const widget = anchors.get(descriptor.id);
      if (widget && !widget.isRemoved) widget.update(renderUploadAnchor(descriptor));
    },
    resolveUploadAnchor: (id, markdown) => {
      const editor = live(getEditor);
      const widget = takeAnchor(id);
      if (!editor || !widget) return;
      if (markdown) {
        // The anchor sits after its block; an empty block gives its place to the content.
        const block = editor.state.doc.blocks.find((candidate) => candidate.id === widget.blockId);
        const at = block && isEmptyParagraph(block) ? { blockId: block.id, offset: 0 } : widget;
        editor.commands.insertMarkdown(markdown, { at, block: true });
        editor.commands.focus();
        editor.commands.scrollIntoView();
      }
      widget.remove();
    },
    cancelUploadAnchor: (id) => takeAnchor(id)?.remove(),
    getSelection: () => live(getEditor)?.selectionToJSON(),
    setSelection: (selection) => {
      const editor = live(getEditor);
      if (!editor) return;
      editor.setSelection(selection);
      editor.commands.scrollIntoView();
    },
    selectAll: () => live(getEditor)?.commands.selectAll(),
    toggleTaskList: () => live(getEditor)?.commands.toggleTaskList() ?? false,
  };
}
