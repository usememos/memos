import { EditorSelection, type EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import type { EditorController, FormattingController } from "../types/editorController";

const isEmptyDoc = (state: EditorState) => state.doc.toString().trim() === "";

/** Block padding for insertMarkdown: ensure the inserted text is its own block. */
function blockPad(before: string, after: string): { prefix: string; suffix: string } {
  const prefix = before.length === 0 || before.endsWith("\n\n") ? "" : before.endsWith("\n") ? "\n" : "\n\n";
  const suffix = after.length === 0 || after.startsWith("\n\n") ? "" : after.startsWith("\n") ? "\n" : "\n\n";
  return { prefix, suffix };
}

export function createController(view: EditorView, formatting: FormattingController): EditorController {
  return {
    focus: () => view.focus(),
    hasFocus: () => view.hasFocus,
    isEmpty: () => isEmptyDoc(view.state),
    getMarkdown: () => view.state.doc.toString(),
    setMarkdown: (markdown) => {
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: markdown } });
    },
    insertMarkdown: (markdown) => {
      if (!markdown) return;
      const { from, to } = view.state.selection.main;
      const doc = view.state.doc.toString();
      const { prefix, suffix } = blockPad(doc.slice(0, from), doc.slice(to));
      const insert = prefix + markdown + suffix;
      const caret = from + insert.length;
      view.dispatch({ changes: { from, to, insert }, selection: { anchor: caret }, scrollIntoView: true });
      view.focus();
    },
    scrollToCursor: () => view.dispatch({ effects: EditorView.scrollIntoView(view.state.selection.main.head) }),
    selectAll: () => view.dispatch({ selection: EditorSelection.range(0, view.state.doc.length) }),
    formatting,
  };
}
