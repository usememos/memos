export interface ListItemInfo {
  type: "task" | "unordered" | "ordered" | null;
  symbol?: string; // For task/unordered lists: "- ", "* ", "+ "
  number?: number; // For ordered lists: 1, 2, 3, etc.
  indent: number; // Whitespace count
}

// Detect the list item type of the last line before cursor
export function detectLastListItem(lastLine: string): ListItemInfo {
  const indentMatch = lastLine.match(/^(\s*)/);
  const leadingSpaces = indentMatch ? indentMatch[1] : "";
  const indent = leadingSpaces.length;

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

// Generate the text to insert when pressing Enter on a list item
export function generateListContinuation(listInfo: ListItemInfo): string {
  const indent = " ".repeat(listInfo.indent);

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

export function renumberOrderedLists(content: string): string {
  const lines = content.split("\n");
  const orderedListRegex = /^(\s*)(\d+)([.)])\s+/;
  const counters: Map<number, number> = new Map();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.trim() === "") {
      counters.clear();
      continue;
    }

    const match = line.match(orderedListRegex);
    if (!match) {
      counters.clear();
      continue;
    }

    const leadingSpaces = match[1];
    const order = match[2];
    const delimiter = match[3];
    const indentLevel = Math.floor(leadingSpaces.length / 4);
    for (const key of [...counters.keys()]) {
      if (key > indentLevel) counters.delete(key);
    }
    const currentCounter = (counters.get(indentLevel) || 0) + 1;
    counters.set(indentLevel, currentCounter);

    const prefix = leadingSpaces + order + delimiter + " ";
    lines[i] = leadingSpaces + currentCounter + delimiter + " " + line.slice(prefix.length);
  }

  return lines.join("\n");
}
