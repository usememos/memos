import type { ListItem } from "mdast";
import { fromMarkdown } from "mdast-util-from-markdown";
import { gfmFromMarkdown } from "mdast-util-gfm";
import { gfm } from "micromark-extension-gfm";
import { visit } from "unist-util-visit";

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

interface LineInfo {
  text: string;
  startOffset: number;
  endOffset: number;
}

const TASK_LINE_REGEXP = /^(\s*)((?:[-*+])|(?:\d+[.)]))(\s+)\[([ xX])\]/;

function getLineStarts(markdown: string): number[] {
  const starts = [0];
  for (let index = 0; index < markdown.length; index++) {
    if (markdown[index] === "\n") {
      starts.push(index + 1);
    }
  }
  return starts;
}

function getLineInfo(markdown: string, lineStarts: number[], lineNumber: number): LineInfo | undefined {
  const startOffset = lineStarts[lineNumber];
  if (startOffset === undefined) {
    return undefined;
  }

  const nextLineStart = lineStarts[lineNumber + 1];
  const endOffset = nextLineStart === undefined ? markdown.length : nextLineStart - 1;
  return {
    text: markdown.slice(startOffset, endOffset),
    startOffset,
    endOffset,
  };
}

function parseMarkdown(markdown: string) {
  return fromMarkdown(markdown, {
    extensions: [gfm()],
    mdastExtensions: [gfmFromMarkdown()],
  });
}

function parseTaskItems(markdown: string): ParsedTaskItem[] {
  let tree: ReturnType<typeof parseMarkdown>;
  try {
    tree = parseMarkdown(markdown);
  } catch {
    return [];
  }

  const lineStarts = getLineStarts(markdown);
  const tasks: ParsedTaskItem[] = [];

  visit(tree, "listItem", (node: ListItem) => {
    if (typeof node.checked !== "boolean") {
      return;
    }

    const startLine = node.position ? node.position.start.line - 1 : undefined;
    if (startLine === undefined) {
      return;
    }

    const lineInfo = getLineInfo(markdown, lineStarts, startLine);
    if (!lineInfo) {
      return;
    }

    const match = lineInfo.text.match(TASK_LINE_REGEXP);
    if (!match || match.index !== 0) {
      return;
    }

    const markerStart = lineInfo.startOffset + match[1].length + match[2].length + match[3].length + 1;

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
