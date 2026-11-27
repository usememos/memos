import { lineTable, visit } from "@usememos/editor";
import { parseMemoAst } from "@/lib/memo-ast";

interface SourceRange {
  start: number;
  end: number;
}

interface MarkdownEdit extends SourceRange {
  replacement: string;
}

interface ParsedTaskItem {
  checked: boolean;
  checkboxMarker: SourceRange;
}

// A task item's first line: the quote markers and list markers before it (a list item may
// start with another list's marker), its own marker, then the box.
const TASK_LINE_REGEXP = /^((?:[ \t]*>)*(?:[ \t]*(?:[-*+]|\d{1,9}[.)])[ \t]+)+)\[([ xX])\]/;

function parseTaskItems(markdown: string): ParsedTaskItem[] {
  const lines = lineTable(markdown);
  const tasks: ParsedTaskItem[] = [];

  visit(parseMemoAst(markdown), (node) => {
    if (node.type !== "listItem" || !node.task || !node.lines) {
      return;
    }

    const lineStart = lines.starts[node.lines.start - 1];
    const match = markdown.slice(lineStart, lines.ends[node.lines.start - 1]).match(TASK_LINE_REGEXP);
    if (!match) {
      return;
    }

    const markerStart = lineStart + match[1].length + 1;
    tasks.push({
      checked: node.checked,
      checkboxMarker: {
        start: markerStart,
        end: markerStart + 1,
      },
    });
  });

  return tasks;
}

function applyMarkdownEdits(markdown: string, edits: MarkdownEdit[]): string {
  if (edits.length === 0) {
    return markdown;
  }

  const sortedEdits = [...edits].sort((a, b) => a.start - b.start);
  let previousEnd = 0;
  for (const edit of sortedEdits) {
    if (edit.start < 0 || edit.end < edit.start || edit.end > markdown.length || edit.start < previousEnd) {
      return markdown;
    }
    previousEnd = edit.end;
  }

  let nextMarkdown = markdown;
  for (let index = sortedEdits.length - 1; index >= 0; index--) {
    const edit = sortedEdits[index];
    nextMarkdown = `${nextMarkdown.slice(0, edit.start)}${edit.replacement}${nextMarkdown.slice(edit.end)}`;
  }
  return nextMarkdown;
}

function setAllTaskMarkers(markdown: string, checked: boolean): string {
  const marker = checked ? "x" : " ";
  const edits = parseTaskItems(markdown)
    .filter((task) => task.checked !== checked)
    .map<MarkdownEdit>((task) => ({
      start: task.checkboxMarker.start,
      end: task.checkboxMarker.end,
      replacement: marker,
    }));

  return applyMarkdownEdits(markdown, edits);
}

export function uncheckAllTasks(markdown: string): string {
  return setAllTaskMarkers(markdown, false);
}

export function checkAllTasks(markdown: string): string {
  return setAllTaskMarkers(markdown, true);
}
