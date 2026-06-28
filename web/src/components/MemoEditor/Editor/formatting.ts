import { syntaxTree } from "@codemirror/language";
import type { EditorView } from "@codemirror/view";
import {
  type ActiveFormatState,
  type EditorCommandContext,
  type EditorCommandId,
  EMPTY_ACTIVE_FORMATS,
  type ToolbarHeadingLevel,
} from "../formatting/commands";
import type { FormattingController } from "../types/editorController";

const MARK: Partial<Record<EditorCommandId, string>> = { bold: "**", italic: "*", code: "`" };
const LINE_PREFIX: Partial<Record<EditorCommandId, string>> = { bulletList: "- ", orderedList: "1. ", taskList: "- [ ] " };

// Enclosing syntax-tree node and the delimiter child node for each inline mark.
// Delimiter names verified empirically against the Lezer markdown parser:
// StrongEmphasis/Emphasis use `EmphasisMark`, InlineCode uses `CodeMark`.
const MARK_NODES: Partial<Record<EditorCommandId, { wrapper: string; delimiter: string }>> = {
  bold: { wrapper: "StrongEmphasis", delimiter: "EmphasisMark" },
  italic: { wrapper: "Emphasis", delimiter: "EmphasisMark" },
  code: { wrapper: "InlineCode", delimiter: "CodeMark" },
};

function wrapSelection(view: EditorView, token: string) {
  const { from, to } = view.state.selection.main;
  const sel = view.state.sliceDoc(from, to);
  view.dispatch({
    changes: { from, to, insert: `${token}${sel}${token}` },
    selection: { anchor: from + token.length, head: from + token.length + sel.length },
  });
}

/**
 * Toggle an inline mark (bold/italic/code). When the selection head already sits
 * inside the corresponding mark, strip the surrounding delimiter nodes instead of
 * nesting a new pair. Deleting the actual delimiter child ranges handles the
 * differing delimiter lengths (`**` vs `*` vs `` ` ``) automatically.
 */
function toggleMark(view: EditorView, command: EditorCommandId, token: string) {
  const nodes = MARK_NODES[command];
  if (nodes) {
    const head = view.state.selection.main.head;
    const tree = syntaxTree(view.state);
    for (let n: ReturnType<typeof tree.resolve> | null = tree.resolve(head, -1); n; n = n.parent) {
      if (n.name !== nodes.wrapper) continue;
      // Collect the opening and closing delimiter child node ranges.
      const marks: { from: number; to: number }[] = [];
      for (let child = n.firstChild; child; child = child.nextSibling) {
        if (child.name === nodes.delimiter) marks.push({ from: child.from, to: child.to });
      }
      if (marks.length >= 2) {
        const opening = marks[0];
        const closing = marks[marks.length - 1];
        // Delete the later range first so the earlier offsets stay valid.
        view.dispatch({
          changes: [
            { from: closing.from, to: closing.to, insert: "" },
            { from: opening.from, to: opening.to, insert: "" },
          ],
        });
        return;
      }
    }
  }
  wrapSelection(view, token);
}

function toggleLinePrefix(view: EditorView, prefix: string) {
  const line = view.state.doc.lineAt(view.state.selection.main.head);
  const has = line.text.startsWith(prefix);
  view.dispatch({
    changes: has ? { from: line.from, to: line.from + prefix.length, insert: "" } : { from: line.from, insert: prefix },
  });
}

function setHeading(view: EditorView, level: number) {
  const line = view.state.doc.lineAt(view.state.selection.main.head);
  const stripped = line.text.replace(/^#{1,6}\s+/, "");
  const insert = level === 0 ? stripped : `${"#".repeat(level)} ${stripped}`;
  view.dispatch({ changes: { from: line.from, to: line.to, insert } });
}

export function createFormattingController(view: EditorView, listeners: Set<() => void>): FormattingController {
  return {
    run(command: EditorCommandId, ctx?: EditorCommandContext) {
      const mark = MARK[command];
      if (mark) return toggleMark(view, command, mark);
      const prefix = LINE_PREFIX[command];
      if (prefix) return toggleLinePrefix(view, prefix);
      if (command === "heading1") return setHeading(view, 1);
      if (command === "heading2") return setHeading(view, 2);
      if (command === "heading3") return setHeading(view, 3);
      if (command === "paragraph") return setHeading(view, 0);
      if (command === "link") {
        const { from, to } = view.state.selection.main;
        const sel = view.state.sliceDoc(from, to);
        view.dispatch({ changes: { from, to, insert: `[${sel}](${ctx?.url ?? ""})` } });
      }
    },
    getActiveFormats(): ActiveFormatState {
      const pos = view.state.selection.main.head;
      const tree = syntaxTree(view.state);
      const active: ActiveFormatState = { ...EMPTY_ACTIVE_FORMATS };
      for (let n: ReturnType<typeof tree.resolve> | null = tree.resolve(pos, -1); n; n = n.parent) {
        const name = n.name;
        if (name === "StrongEmphasis") active.bold = true;
        else if (name === "Emphasis") active.italic = true;
        else if (name === "InlineCode") active.code = true;
        else if (name === "Link") active.link = true;
        else if (name === "BulletList") active.bulletList = true;
        else if (name === "OrderedList") active.orderedList = true;
        else {
          const h = /^ATXHeading([1-6])$/.exec(name);
          if (h) {
            const lvl = Number(h[1]);
            if (lvl <= 3) active.headingLevel = lvl as ToolbarHeadingLevel;
          }
        }
      }
      const line = view.state.doc.lineAt(pos).text;
      if (/^\s*- \[[ xX]\] /.test(line)) {
        active.taskList = true;
        active.bulletList = false;
      }
      return active;
    },
    getSelectedText() {
      const { from, to } = view.state.selection.main;
      return view.state.sliceDoc(from, to);
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
