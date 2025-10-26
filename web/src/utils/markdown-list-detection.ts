/**
 * Utilities for detecting list patterns in markdown text
 *
 * Used by the editor for auto-continuation of lists when user presses Enter
 */

export interface ListItemInfo {
  type: "task" | "unordered" | "ordered" | null;
  symbol?: string; // For task/unordered lists: "- ", "* ", "+ "
  number?: number; // For ordered lists: 1, 2, 3, etc.
  indent?: string; // Leading whitespace
}

/**
 * Detect the list item type of the last line before cursor
 *
 * @param contentBeforeCursor - Markdown content from start to cursor position
 * @returns List item information, or null if not a list item
 */
export function detectLastListItem(contentBeforeCursor: string): ListItemInfo {
  const lines = contentBeforeCursor.split("\n");
  const lastLine = lines[lines.length - 1];

  // Extract indentation
  const indentMatch = lastLine.match(/^(\s*)/);
  const indent = indentMatch ? indentMatch[1] : "";

  // Task list: - [ ] or - [x] or - [X]
  const taskMatch = lastLine.match(/^(\s*)([-*+])\s+\[([ xX])\]\s+/);
  if (taskMatch) {
    return {
      type: "task",
      symbol: taskMatch[2], // -, *, or +
      indent,
    };
  }

  // Unordered list: - foo or * foo or + foo
  const unorderedMatch = lastLine.match(/^(\s*)([-*+])\s+/);
  if (unorderedMatch) {
    return {
      type: "unordered",
      symbol: unorderedMatch[2],
      indent,
    };
  }

  // Ordered list: 1. foo or 2) foo
  const orderedMatch = lastLine.match(/^(\s*)(\d+)[.)]\s+/);
  if (orderedMatch) {
    return {
      type: "ordered",
      number: parseInt(orderedMatch[2]),
      indent,
    };
  }

  return {
    type: null,
    indent,
  };
}

/**
 * Generate the text to insert when pressing Enter on a list item
 *
 * @param listInfo - Information about the current list item
 * @returns Text to insert at cursor
 */
export function generateListContinuation(listInfo: ListItemInfo): string {
  const indent = listInfo.indent || "";

  switch (listInfo.type) {
    case "task":
      return `${indent}${listInfo.symbol} [ ] `;
    case "unordered":
      return `${indent}${listInfo.symbol} `;
    case "ordered":
      return `${indent}${(listInfo.number || 0) + 1}. `;
    default:
      return indent;
  }
}
