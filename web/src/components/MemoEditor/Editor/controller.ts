import { type Block, containerContent, type Editor, getBlock, inlineText, type Position, type Widget } from "@usememos/editor";
import { collectTags } from "@/lib/memo-markdown";
import { isCompleteTagValue } from "@/utils/tag-grammar";
import type { EditorController } from "../types/editorController";
import { renderUploadAnchor } from "./uploadAnchors";

/** The live editor, or null before it mounts and after it is destroyed. */
type EditorGetter = () => Editor | null;

const live = (getEditor: EditorGetter): Editor | null => {
  const editor = getEditor();
  return editor && !editor.isDestroyed ? editor : null;
};

/** The text of the block (or table cell) holding `position`. */
const textAt = (editor: Editor, position: Position): string => {
  const content = containerContent(getBlock(editor.state.doc, position.blockId), position.cell);
  return content ? inlineText(content) : "";
};

/** An empty paragraph, which an inserted block should replace rather than follow. */
const isEmptyParagraph = (block: Block): boolean => block.type === "paragraph" && inlineText(block.content) === "";

/**
 * Inserts Markdown as its own blocks at `position`. In an empty paragraph it
 * takes the paragraph's place, as a paste would, so no empty line is left
 * above the inserted content.
 */
const insertBlocks = (editor: Editor, markdown: string, position: Position): void => {
  if (isEmptyParagraph(getBlock(editor.state.doc, position.blockId))) {
    editor.setSelection({ anchor: position, focus: position });
    editor.commands.insertMarkdown(markdown, { block: true });
  } else {
    editor.commands.insertMarkdown(markdown, { at: position, block: true });
  }
};

/**
 * EditorController over a @usememos/editor instance. Every method reads the
 * live editor when called, so the controller can be handed out before the
 * editor mounts, and calls after it is destroyed do nothing. The editor does
 * not emit a change for a replaced document, so `onReplace` reports it.
 */
export function createController(getEditor: EditorGetter, onReplace: (markdown: string) => void): EditorController {
  const anchors = new Map<string, Widget>();
  const currentTags = (editor: Editor) => collectTags(editor.state.doc.blocks);

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
      // would delete text the user merely had highlighted.
      insertBlocks(editor, markdown, editor.getSelection().focus);
      editor.commands.focus();
      editor.commands.scrollIntoView();
    },
    getTags: () => {
      const editor = live(getEditor);
      return editor ? currentTags(editor) : [];
    },
    hasChecklist: () => live(getEditor)?.state.doc.blocks.some((block) => block.type === "listItem" && block.listType === "task") ?? false,
    insertTag: (tag) => {
      const editor = live(getEditor);
      if (!editor || !isCompleteTagValue(tag) || editor.isComposing || currentTags(editor).includes(tag)) return false;
      // Like insertMarkdown, keep highlighted text and insert at the active end.
      // Honor the chosen Markdown context, including code, instead of relocating it.
      const head = editor.getSelection().focus;
      const text = textAt(editor, head);
      const prefix = head.offset > 0 && !/\s/.test(text[head.offset - 1] ?? "") ? " " : "";
      const hasFollowingSpace = /^[ \t]$/.test(text[head.offset] ?? "");
      editor.setSelection({ anchor: head, focus: head });
      editor.commands.insertText(`${prefix}#${tag}${hasFollowingSpace ? "" : " "}`);
      if (hasFollowingSpace) {
        // Exactly one space follows the tag, inserted or reused; the caret lands after it.
        const after = editor.getSelection().focus;
        const next = { ...after, offset: after.offset + 1 };
        editor.setSelection({ anchor: next, focus: next });
      }
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
        const block = editor.state.doc.blocks.find((candidate) => candidate.id === widget.blockId);
        if (block && isEmptyParagraph(block)) {
          insertBlocks(editor, markdown, { blockId: block.id, offset: 0 });
        } else {
          editor.commands.insertMarkdown(markdown, { at: widget, block: true });
        }
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
