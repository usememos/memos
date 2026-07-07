import type { Text } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";

// A list item line: leading whitespace + bullet (-, *, +) or ordered marker
// (1. / 1)) + at least one space.
const LIST_ITEM = /^(\s*)(?:[-*+]|\d+[.)])\s/;
const ORDERED_ITEM = /^(\s*)(\d+)([.)])(\s+)(.*)$/;
// The full marker prefix (indent + marker + trailing spaces); its length is the
// column where the item's content — and therefore a nested child — begins.
const LIST_PREFIX = /^\s*(?:[-*+]|\d+[.)])\s+/;

export const leadingWhitespace = (text: string): number => text.length - text.trimStart().length;

/** Unique line numbers covered by the selection, ascending (also used by formatting.ts). */
export function selectedLineNumbers(view: EditorView): number[] {
  const { doc, selection } = view.state;
  const nums = new Set<number>();
  for (const range of selection.ranges) {
    const last = doc.lineAt(range.to).number;
    for (let n = doc.lineAt(range.from).number; n <= last; n++) {
      nums.add(n);
    }
  }
  return [...nums].sort((a, b) => a - b);
}

/** Preceding lines, nearest first, stopping at the first blank line (list end). */
function* previousListLines(doc: Text, from: number): Generator<{ text: string; indent: number }> {
  for (let p = from - 1; p >= 1; p--) {
    const { text } = doc.line(p);
    if (text.trim() === "") return;
    yield { text, indent: leadingWhitespace(text) };
  }
}

/**
 * The number an ordered item should take at `indent`: one more than the nearest
 * preceding sibling ordered item at the same indent, else 1 (first child of a
 * new sublist). CommonMark only nests an ordered sublist whose first item is
 * `1.`, so renumbering — not just re-indenting — is what makes a nested ordered
 * list actually render as nested.
 */
function nextOrderedNumber(doc: Text, lineNumber: number, indent: number): number {
  for (const prev of previousListLines(doc, lineNumber)) {
    if (prev.indent < indent) break; // reached the parent
    if (prev.indent === indent) {
      const ordered = ORDERED_ITEM.exec(prev.text);
      return ordered ? Number.parseInt(ordered[2], 10) + 1 : 1;
    }
    // deeper line — part of a sibling's subtree; keep scanning up
  }
  return 1;
}

/** Rewrite a list line to a new indent, renumbering it if it is an ordered item. */
function reindented(doc: Text, lineNumber: number, text: string, indent: number): string {
  const ordered = ORDERED_ITEM.exec(text);
  if (ordered) {
    const [, , , delimiter, spaces, content] = ordered;
    return `${" ".repeat(indent)}${nextOrderedNumber(doc, lineNumber, indent)}${delimiter}${spaces}${content}`;
  }
  return " ".repeat(indent) + text.slice(leadingWhitespace(text));
}

/**
 * Tab on a list item: nest it under the preceding item by aligning its indent to
 * that item's content column (past the marker) and renumbering ordered items so
 * the nested list is CommonMark-valid. Returns false when not on a list item so
 * the caller's default Tab (plain indent) applies.
 */
export function sinkListItem(view: EditorView): boolean {
  const { doc } = view.state;
  const changes: { from: number; to: number; insert: string }[] = [];
  for (const n of selectedLineNumbers(view)) {
    const line = doc.line(n);
    const match = LIST_ITEM.exec(line.text);
    if (!match) return false;
    const indent = match[1].length;
    let target = indent + 2; // fallback when there is no item to nest under
    for (const prev of previousListLines(doc, n)) {
      if (prev.indent > indent) continue; // deeper subtree — skip past it
      const prevPrefix = LIST_PREFIX.exec(prev.text);
      if (prevPrefix) target = prevPrefix[0].length;
      break;
    }
    if (target > indent) {
      changes.push({ from: line.from, to: line.to, insert: reindented(doc, n, line.text, target) });
    }
  }
  if (changes.length === 0) return false;
  view.dispatch({ changes, userEvent: "input.indent" });
  return true;
}

/**
 * Shift-Tab on a list item: outdent it to its parent's indent (or the margin),
 * renumbering ordered items for the new level. Returns false when not on an
 * indented list item so the default outdent applies.
 */
export function liftListItem(view: EditorView): boolean {
  const { doc } = view.state;
  const changes: { from: number; to: number; insert: string }[] = [];
  for (const n of selectedLineNumbers(view)) {
    const line = doc.line(n);
    const match = LIST_ITEM.exec(line.text);
    if (!match) return false;
    const indent = match[1].length;
    if (indent === 0) return false;
    let target = 0;
    for (const prev of previousListLines(doc, n)) {
      if (prev.indent < indent) {
        target = LIST_ITEM.test(prev.text) ? prev.indent : 0;
        break;
      }
    }
    changes.push({ from: line.from, to: line.to, insert: reindented(doc, n, line.text, target) });
  }
  if (changes.length === 0) return false;
  view.dispatch({ changes, userEvent: "delete.dedent" });
  return true;
}
