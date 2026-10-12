import { isolateHistory } from "@codemirror/commands";
import { ensureSyntaxTree, syntaxTree } from "@codemirror/language";
import { EditorSelection, type EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { isCompleteTagValue } from "@/utils/tag-grammar";
import type { EditorController, FormattingController } from "../types/editorController";
import { findMarkdownTagMatches } from "./markdownTagRanges";
import {
  cancelUploadAnchor,
  createUploadAnchor,
  getUploadAnchorPosition,
  removeUploadAnchorEffect,
  setUploadAnchor,
} from "./uploadAnchors";

const isEmptyDoc = (state: EditorState) => state.doc.toString().trim() === "";

/** Block padding for insertMarkdown: ensure the inserted text is its own block. */
function blockPad(before: string, after: string): { prefix: string; suffix: string } {
  const prefix = before.length === 0 || before.endsWith("\n\n") ? "" : before.endsWith("\n") ? "\n" : "\n\n";
  const suffix = after.length === 0 || after.startsWith("\n\n") ? "" : after.startsWith("\n") ? "\n" : "\n\n";
  return { prefix, suffix };
}

export function createController(view: EditorView, formatting: FormattingController): EditorController {
  const currentTags = () => findMarkdownTagMatches(view.state, 0, view.state.doc.length).map((match) => match.value);
  return {
    focus: () => view.focus(),
    hasFocus: () => view.hasFocus,
    isEmpty: () => isEmptyDoc(view.state),
    getMarkdown: () => view.state.doc.toString(),
    getTags: currentTags,
    hasChecklist: () => {
      let found = false;
      const tree = ensureSyntaxTree(view.state, view.state.doc.length) ?? syntaxTree(view.state);
      tree.iterate({
        enter: (node) => {
          if (node.name === "Task") found = true;
          if (found) return false;
        },
      });
      return found;
    },
    insertTag: (tag) => {
      if (!isCompleteTagValue(tag) || view.compositionStarted || currentTags().includes(tag)) return false;
      const { doc, selection } = view.state;
      const { head } = selection.main;
      // Like insertMarkdown, keep highlighted text and insert at the active end.
      // Honor the chosen Markdown context, including code, instead of relocating it.
      const prefix = head > 0 && !/\s/.test(doc.sliceString(head - 1, head)) ? " " : "";
      const hasFollowingSpace = /^[ \t]$/.test(doc.sliceString(head, head + 1));
      const insert = `${prefix}#${tag}${hasFollowingSpace ? "" : " "}`;
      view.dispatch({
        changes: { from: head, insert },
        // Exactly one space follows the tag, inserted or reused; the caret lands after it.
        selection: { anchor: head + prefix.length + tag.length + 2 },
        annotations: isolateHistory.of("full"),
        userEvent: "input",
        scrollIntoView: true,
      });
      view.focus();
      return true;
    },
    setMarkdown: (markdown) => {
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: markdown } });
    },
    insertMarkdown: (markdown) => {
      if (!markdown) return;
      // Insert at the caret without consuming the selection: callers live outside
      // the editor (attachment list, audio recorder), and CodeMirror keeps its
      // selection across blur, so replacing the range would delete text the user
      // merely had highlighted.
      const { head } = view.state.selection.main;
      const doc = view.state.doc.toString();
      const { prefix, suffix } = blockPad(doc.slice(0, head), doc.slice(head));
      const insert = prefix + markdown + suffix;
      view.dispatch({ changes: { from: head, insert }, selection: { anchor: head + insert.length }, scrollIntoView: true });
      view.focus();
    },
    createUploadAnchor: (descriptor, position) => createUploadAnchor(view, descriptor, position),
    updateUploadAnchor: (descriptor) => setUploadAnchor(view, descriptor),
    resolveUploadAnchor: (id, markdown) => {
      const position = getUploadAnchorPosition(view.state, id);
      if (position === undefined) return;
      if (!markdown) {
        cancelUploadAnchor(view, id);
        return;
      }
      const doc = view.state.doc.toString();
      const { prefix, suffix } = blockPad(doc.slice(0, position), doc.slice(position));
      const insert = prefix + markdown + suffix;
      view.dispatch({
        changes: { from: position, insert },
        effects: removeUploadAnchorEffect(id),
        selection: { anchor: position + insert.length },
        scrollIntoView: true,
      });
      view.focus();
    },
    cancelUploadAnchor: (id) => cancelUploadAnchor(view, id),
    getCursor: () => view.state.selection.main.head,
    setCursor: (position: number) => {
      const cursor = Math.min(Math.max(position, 0), view.state.doc.length);
      view.dispatch({
        selection: EditorSelection.cursor(cursor),
        scrollIntoView: true,
      });
    },
    scrollToCursor: () => view.dispatch({ effects: EditorView.scrollIntoView(view.state.selection.main.head) }),
    selectAll: () => view.dispatch({ selection: EditorSelection.range(0, view.state.doc.length) }),
    formatting,
  };
}
