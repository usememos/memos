import { syntaxTree } from "@codemirror/language";
import type { EditorState } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import {
  type ActiveFormatState,
  type EditorCommandContext,
  type EditorCommandId,
  EMPTY_ACTIVE_FORMATS,
  toToolbarHeadingLevel,
} from "../formatting/commands";
import type { FormattingController } from "../types/editorController";
import { leadingWhitespace, selectedLineNumbers } from "./listIndent";

type MarkCommand = "bold" | "italic" | "strikethrough" | "code";
type ListCommand = "bulletList" | "orderedList" | "taskList";

// One row per inline mark: the markdown token plus the syntax-tree wrapper and
// delimiter node names (verified empirically against the Lezer markdown parser:
// StrongEmphasis/Emphasis use `EmphasisMark`, InlineCode uses `CodeMark`, and
// GFM strikethrough uses `Strikethrough`/`StrikethroughMark`).
// Dispatch, toggling, the delimiter guard, and active-state detection all
// derive from this table, so adding a mark is one row here + a catalog entry.
const MARKS: Record<MarkCommand, { token: string; wrapper: string; delimiter: string }> = {
  bold: { token: "**", wrapper: "StrongEmphasis", delimiter: "EmphasisMark" },
  italic: { token: "*", wrapper: "Emphasis", delimiter: "EmphasisMark" },
  strikethrough: { token: "~~", wrapper: "Strikethrough", delimiter: "StrikethroughMark" },
  code: { token: "`", wrapper: "InlineCode", delimiter: "CodeMark" },
};
const MARK_COMMANDS = Object.keys(MARKS) as MarkCommand[];
const isMarkCommand = (command: EditorCommandId): command is MarkCommand => command in MARKS;
const WRAPPER_TO_MARK: Record<string, MarkCommand> = Object.fromEntries(MARK_COMMANDS.map((c) => [MARKS[c].wrapper, c]));
// A cursor inside one of these means the adjacent token characters belong to
// real parsed markup (e.g. between the two `*` of a bold delimiter), not to a
// dangling empty pair.
const DELIMITER_NODES = new Set(MARK_COMMANDS.map((c) => MARKS[c].delimiter));
// Doubled mark tokens (`****`, `~~~~`, …): what a freshly inserted empty pair
// looks like. Markdown parses some of them as entirely different constructs
// (`~~~~` is a bare tilde code fence), so consumers that would otherwise
// believe that construct check here first.
const EMPTY_MARK_PAIRS = new Set(MARK_COMMANDS.map((c) => MARKS[c].token + MARKS[c].token));
const MAX_EMPTY_PAIR_LENGTH = Math.max(...MARK_COMMANDS.map((c) => 2 * MARKS[c].token.length));

/** Whether [from, to) is exactly some mark's empty delimiter pair. */
function isEmptyMarkPair(state: EditorState, from: number, to: number): boolean {
  return to - from <= MAX_EMPTY_PAIR_LENGTH && EMPTY_MARK_PAIRS.has(state.sliceDoc(from, to));
}

const LIST_MARKERS: Record<ListCommand, string> = { bulletList: "- ", orderedList: "1. ", taskList: "- [ ] " };

// Line-mode detection shared by the list toggles and getActiveFormats so the
// highlighted state and the toggle-off condition can never disagree. Order
// matters: a task line also matches the bullet pattern. Markers follow
// listIndent.ts: bullets `-*+`, ordered `1.` / `1)`, content starts after the
// marker's trailing whitespace.
const TASK_LINE = /^(\s*)[-*+]\s+\[[ xX]\]\s+/;
const BULLET_LINE = /^(\s*)[-*+]\s+/;
const ORDERED_LINE = /^(\s*)\d+[.)]\s+/;
// ATX heading; CommonMark allows up to three leading spaces and requires
// whitespace after the hashes — a bare `#` or a `#tag` is intentionally NOT a
// heading. Shared with headingDecorations.ts so toolbar state and rendered
// heading styling can't drift.
export const HEADING_LINE = /^ {0,3}(#{1,6})\s+/;
// Region setHeading replaces: an existing heading prefix including its leading
// spaces, or just the leading spaces on a non-heading line (the optional group
// makes the regex always match).
const HEADING_PREFIX = /^ {0,3}(?:#{1,6}\s+)?/;

type Tree = ReturnType<typeof syntaxTree>;
type TreeNode = ReturnType<Tree["resolve"]>;

/** The node at (pos, side) and its ancestors, innermost first. */
function* ancestors(tree: Tree, pos: number, side: -1 | 1): Generator<TreeNode> {
  for (let n: TreeNode | null = tree.resolve(pos, side); n; n = n.parent) {
    yield n;
  }
}

/** Ranges of the direct `name` children of `node`. */
function childRanges(node: TreeNode, name: string): { from: number; to: number }[] {
  const ranges: { from: number; to: number }[] = [];
  for (let child = node.firstChild; child; child = child.nextSibling) {
    if (child.name === name) ranges.push({ from: child.from, to: child.to });
  }
  return ranges;
}

interface LineListInfo {
  mode: ListCommand | null;
  /** Length of leading whitespace. */
  indent: number;
  /** Offset within the line where the item content starts (=== indent when mode is null). */
  markerEnd: number;
}

function lineListInfo(text: string): LineListInfo {
  const task = TASK_LINE.exec(text);
  if (task) return { mode: "taskList", indent: task[1].length, markerEnd: task[0].length };
  const bullet = BULLET_LINE.exec(text);
  if (bullet) return { mode: "bulletList", indent: bullet[1].length, markerEnd: bullet[0].length };
  const ordered = ORDERED_LINE.exec(text);
  if (ordered) return { mode: "orderedList", indent: ordered[1].length, markerEnd: ordered[0].length };
  const indent = leadingWhitespace(text);
  return { mode: null, indent, markerEnd: indent };
}

function wrapSelection(view: EditorView, token: string) {
  const { from, to } = view.state.selection.main;
  const sel = view.state.sliceDoc(from, to);
  view.dispatch({
    changes: { from, to, insert: `${token}${sel}${token}` },
    selection: { anchor: from + token.length, head: from + token.length + sel.length },
  });
}

/**
 * Delimiter child ranges of the nearest `wrapper` ancestor at the selection,
 * or null when the selection doesn't sit in one (or it has fewer than
 * `minMarks` delimiters). Shared by every toggle-off path so they all agree.
 *
 * The head probe mirrors getActiveFormats (resolve side -1) so stripping
 * fires exactly when the toolbar shows the command active. With a non-empty
 * selection, additionally probe both edges from inside the selection, so a
 * selection that includes the delimiters (the whole `**text**`) still
 * resolves into the wrapper regardless of selection direction.
 */
function findWrappedDelimiters(
  view: EditorView,
  wrapper: string,
  delimiter: string,
  minMarks: number,
): { from: number; to: number }[] | null {
  const { from, to, head } = view.state.selection.main;
  const tree = syntaxTree(view.state);
  const probes: [number, -1 | 1][] =
    from === to
      ? [[head, -1]]
      : [
          [head, -1],
          [from, 1],
          [to, -1],
        ];
  for (const [pos, side] of probes) {
    for (const n of ancestors(tree, pos, side)) {
      if (n.name !== wrapper) continue;
      const marks = childRanges(n, delimiter);
      if (marks.length >= minMarks) return marks;
    }
  }
  return null;
}

/**
 * Toggle an inline mark (bold/italic/strikethrough/code). When the selection
 * already sits in the corresponding mark, strip the surrounding delimiter
 * nodes instead of nesting a new pair. Deleting the actual delimiter child
 * ranges handles the differing delimiter lengths (`**` vs `` ` ``) automatically.
 */
function toggleMark(view: EditorView, command: MarkCommand) {
  const { token, wrapper, delimiter } = MARKS[command];
  const marks = findWrappedDelimiters(view, wrapper, delimiter, 2);
  if (marks) {
    const opening = marks[0];
    const closing = marks[marks.length - 1];
    view.dispatch({
      changes: [
        { from: closing.from, to: closing.to, insert: "" },
        { from: opening.from, to: opening.to, insert: "" },
      ],
    });
    return;
  }
  // Empty pair: a cursor sitting between freshly inserted delimiters (`**|**`).
  // Markdown never parses an empty mark as that mark (bare `****` is a
  // horizontal rule, `~~~~` a tilde code fence, `` `` `` plain text), so the
  // tree probe above can't see it — check the text instead. Without this,
  // re-clicking the button keeps nesting new pairs.
  const { from, to } = view.state.selection.main;
  if (
    from === to &&
    from >= token.length &&
    to + token.length <= view.state.doc.length &&
    view.state.sliceDoc(from - token.length, to + token.length) === token + token
  ) {
    const delFrom = from - token.length;
    const delTo = to + token.length;
    // Deleting is only unsafe when the adjacent tokens belong to parsed markup
    // reaching beyond the pair itself — e.g. an italic click between the `*`s
    // of a bold delimiter would destroy that bold. A construct contained
    // entirely in the deletion range (the `~~~~` the parser reads as an empty
    // tilde fence) is just this empty pair wearing another node name.
    const tree = syntaxTree(view.state);
    const blocking = (n: TreeNode) => {
      if (!DELIMITER_NODES.has(n.name)) return false;
      const construct = n.parent ?? n;
      return construct.from < delFrom || construct.to > delTo;
    };
    if (!blocking(tree.resolve(from, -1)) && !blocking(tree.resolve(to, 1))) {
      view.dispatch({
        changes: [
          { from: delFrom, to: from, insert: "" },
          { from: to, to: delTo, insert: "" },
        ],
      });
      return;
    }
  }
  wrapSelection(view, token);
}

/**
 * Toggle a fenced code block. When the selection sits inside one, remove its
 * fence lines (keeping the content); otherwise wrap the selected lines in a
 * new ``` fence. Unclosed blocks (opening fence only) lose just that fence.
 */
function toggleCodeBlock(view: EditorView) {
  const { state } = view;
  const { from, to } = state.selection.main;
  const marks = findWrappedDelimiters(view, "FencedCode", "CodeMark", 1);
  if (marks) {
    const openLine = state.doc.lineAt(marks[0].from);
    // Delete each fence line together with its trailing newline. When the
    // closing fence is the document's last line there is no trailing newline
    // to take, so eat the preceding one instead — unless that would overlap
    // the opening deletion (empty block at end of document).
    const openEnd = Math.min(openLine.to + 1, state.doc.length);
    const specs = [{ from: openLine.from, to: openEnd, insert: "" }];
    if (marks.length >= 2) {
      const closeLine = state.doc.lineAt(marks[marks.length - 1].from);
      const closeIsLastLine = closeLine.to === state.doc.length;
      const closeTo = closeIsLastLine ? closeLine.to : closeLine.to + 1;
      const closeFrom = closeIsLastLine && closeLine.from - 1 >= openEnd ? closeLine.from - 1 : closeLine.from;
      specs.push({ from: closeFrom, to: closeTo, insert: "" });
    }
    const changes = state.changes(specs);
    view.dispatch({ changes, selection: state.selection.map(changes) });
    return;
  }
  const lineNumbers = selectedLineNumbers(view);
  const first = state.doc.line(lineNumbers[0]);
  const last = state.doc.line(lineNumbers[lineNumbers.length - 1]);
  const fence = "```";
  // Both selection ends sit within [first.from, last.to], so they shift by
  // exactly the opening `\`\`\`\n` — keeping the selection on the content (and
  // dropping a lone cursor inside the new empty block).
  view.dispatch({
    changes: [
      { from: first.from, insert: `${fence}\n` },
      { from: last.to, insert: `\n${fence}` },
    ],
    selection: { anchor: from + fence.length + 1, head: to + fence.length + 1 },
  });
}

/**
 * Toggle/convert the list mode of the selected lines. The three list modes are
 * mutually exclusive line states: when every selected line is already in the
 * requested mode the markers are removed; otherwise lines are converted to it
 * (replacing any other list marker, preserving indentation). With a multi-line
 * selection blank lines are left alone; a single selected blank line still gets
 * a marker so the "start a list on an empty line" flow works.
 */
function toggleListLine(view: EditorView, command: ListCommand) {
  const { state } = view;
  const lines = selectedLineNumbers(view).map((n) => state.doc.line(n));
  const nonBlank = lines.filter((line) => line.text.trim() !== "");
  const targets = lines.length === 1 || nonBlank.length === 0 ? lines : nonBlank;
  const infos = targets.map((line) => lineListInfo(line.text));
  const allOn = infos.every((info) => info.mode === command);

  const specs: { from: number; to: number; insert: string }[] = [];
  for (const [i, line] of targets.entries()) {
    const { mode, indent, markerEnd } = infos[i];
    if (allOn) {
      specs.push({ from: line.from + indent, to: line.from + markerEnd, insert: "" });
    } else if (mode !== command) {
      // Lines already in the requested mode keep their marker untouched (a
      // checked `- [x]` stays checked when the selection is extended).
      const marker = command === "orderedList" ? `${i + 1}. ` : LIST_MARKERS[command];
      specs.push({ from: line.from + indent, to: line.from + markerEnd, insert: marker });
    }
  }
  if (specs.length === 0) return;
  const changes = state.changes(specs);
  // Map with assoc 1 so a cursor exactly at the insertion point (empty line)
  // lands after the inserted marker instead of staying at the line start.
  view.dispatch({ changes, selection: state.selection.map(changes, 1) });
}

function setHeading(view: EditorView, level: number) {
  const line = view.state.doc.lineAt(view.state.selection.main.head);
  // Edit only the prefix region (not the whole line) so the cursor keeps its
  // place in the text instead of being flung to the line start by the mapping.
  const existing = HEADING_PREFIX.exec(line.text)?.[0].length ?? 0;
  const insert = level === 0 ? "" : `${"#".repeat(level)} `;
  const changes = view.state.changes({ from: line.from, to: line.from + existing, insert });
  view.dispatch({ changes, selection: view.state.selection.map(changes, 1) });
}

/** Unwrap the link the head sits in to its label text. True when one was found. */
function unwrapLink(view: EditorView): boolean {
  const head = view.state.selection.main.head;
  const tree = syntaxTree(view.state);
  for (const n of ancestors(tree, head, -1)) {
    if (n.name !== "Link") continue;
    const marks = childRanges(n, "LinkMark");
    // marks[0] is `[`, marks[1] is `]` — the label sits between them.
    if (marks.length < 2) continue;
    const label = view.state.sliceDoc(marks[0].to, marks[1].from);
    const anchor = n.from + Math.max(0, Math.min(label.length, head - marks[0].to));
    view.dispatch({
      changes: { from: n.from, to: n.to, insert: label },
      selection: { anchor },
    });
    return true;
  }
  return false;
}

export function createFormattingController(view: EditorView, listeners: Set<() => void>): FormattingController {
  return {
    run(command: EditorCommandId, ctx?: EditorCommandContext) {
      if (isMarkCommand(command)) return toggleMark(view, command);
      if (command === "codeBlock") return toggleCodeBlock(view);
      if (command === "bulletList" || command === "orderedList" || command === "taskList") {
        return toggleListLine(view, command);
      }
      if (command === "heading1") return setHeading(view, 1);
      if (command === "heading2") return setHeading(view, 2);
      if (command === "heading3") return setHeading(view, 3);
      if (command === "paragraph") return setHeading(view, 0);
      if (command === "link") {
        // Toggle: inside an existing link, unwrap it to its label.
        if (unwrapLink(view)) return;
        const { from, to } = view.state.selection.main;
        const url = ctx?.url ?? "";
        // Empty selection: the URL doubles as the label.
        const label = view.state.sliceDoc(from, to) || url;
        const insert = `[${label}](${url})`;
        view.dispatch({ changes: { from, to, insert }, selection: { anchor: from + insert.length } });
      }
    },
    getActiveFormats(): ActiveFormatState {
      const pos = view.state.selection.main.head;
      const tree = syntaxTree(view.state);
      const active: ActiveFormatState = { ...EMPTY_ACTIVE_FORMATS };
      // Inline marks come from the syntax tree around the cursor.
      for (const n of ancestors(tree, pos, -1)) {
        const mark = WRAPPER_TO_MARK[n.name];
        if (mark) active[mark] = true;
        else if (n.name === "Link") active.link = true;
        // The isEmptyMarkPair guard: a fresh empty strikethrough pair
        // (`~~|~~`) parses as a bare tilde code fence — don't light the
        // code-block button while the cursor sits in one.
        else if (n.name === "FencedCode" && !isEmptyMarkPair(view.state, n.from, n.to)) active.codeBlock = true;
      }
      // Line modes (lists, headings) come from the same line inspection the
      // toggles use, keeping highlight and toggle behavior in lockstep.
      const line = view.state.doc.lineAt(pos).text;
      const heading = HEADING_LINE.exec(line);
      if (heading) active.headingLevel = toToolbarHeadingLevel(heading[1].length);
      const { mode } = lineListInfo(line);
      if (mode) active[mode] = true;
      return active;
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
