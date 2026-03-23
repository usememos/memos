/**
 * Utilities for parsing, serializing, and manipulating markdown tables.
 */
import { fromMarkdown } from "mdast-util-from-markdown";
import { gfmFromMarkdown } from "mdast-util-gfm";
import { gfm } from "micromark-extension-gfm";
import { visit } from "unist-util-visit";

export interface TableData {
  headers: string[];
  rows: string[][];
  /** Column alignments: "left" | "center" | "right" | "none". */
  alignments: ColumnAlignment[];
}

export type ColumnAlignment = "left" | "center" | "right" | "none";

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

/**
 * Parse a markdown table string into structured TableData.
 *
 * Expects a standard GFM table:
 *   | Header1 | Header2 |
 *   | ------- | ------- |
 *   | cell    | cell    |
 */
export function parseMarkdownTable(md: string): TableData | null {
  const lines = md
    .trim()
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length < 2) return null;

  const parseRow = (line: string): string[] => {
    // Strip leading/trailing pipes and split by unescaped pipe.
    let trimmed = line;
    if (trimmed.startsWith("|")) trimmed = trimmed.slice(1);
    if (trimmed.endsWith("|")) trimmed = trimmed.slice(0, -1);
    return trimmed.split(/(?<!\\)\|/).map((cell) => cell.trim());
  };

  const headers = parseRow(lines[0]);

  // Parse the separator line for alignments.
  const sepCells = parseRow(lines[1]);
  const isSeparator = sepCells.every((cell) => /^:?-+:?$/.test(cell.trim()));
  if (!isSeparator) return null;

  const alignments: ColumnAlignment[] = sepCells.map((cell) => {
    const c = cell.trim();
    const left = c.startsWith(":");
    const right = c.endsWith(":");
    if (left && right) return "center";
    if (right) return "right";
    if (left) return "left";
    return "none";
  });

  const rows: string[][] = [];
  for (let i = 2; i < lines.length; i++) {
    const cells = parseRow(lines[i]);
    // Pad or trim to match header count.
    while (cells.length < headers.length) cells.push("");
    if (cells.length > headers.length) cells.length = headers.length;
    rows.push(cells);
  }

  return { headers, rows, alignments };
}

// ---------------------------------------------------------------------------
// Serialization
// ---------------------------------------------------------------------------

/**
 * Serialize TableData into a properly-aligned markdown table string.
 */
export function serializeMarkdownTable(data: TableData): string {
  const { headers, rows, alignments } = data;
  const colCount = headers.length;

  // Calculate maximum width per column (minimum 3 for the separator).
  const widths: number[] = [];
  for (let c = 0; c < colCount; c++) {
    let max = Math.max(3, headers[c].length);
    for (const row of rows) {
      max = Math.max(max, (row[c] || "").length);
    }
    widths.push(max);
  }

  const padCell = (text: string, width: number, align: ColumnAlignment): string => {
    const t = text || "";
    const padding = width - t.length;
    if (padding <= 0) return t;
    if (align === "right") return " ".repeat(padding) + t;
    if (align === "center") {
      const left = Math.floor(padding / 2);
      const right = padding - left;
      return " ".repeat(left) + t + " ".repeat(right);
    }
    return t + " ".repeat(padding);
  };

  const formatRow = (cells: string[]): string => {
    const formatted = cells.map((cell, i) => {
      const align = alignments[i] || "none";
      return padCell(cell, widths[i], align);
    });
    return "| " + formatted.join(" | ") + " |";
  };

  const separator = widths.map((w, i) => {
    const align = alignments[i] || "none";
    const dashes = "-".repeat(w);
    if (align === "center") return ":" + dashes.slice(1, -1) + ":";
    if (align === "right") return dashes.slice(0, -1) + ":";
    if (align === "left") return ":" + dashes.slice(1);
    return dashes;
  });
  const separatorLine = "| " + separator.join(" | ") + " |";

  const headerLine = formatRow(headers);
  const rowLines = rows.map((row) => formatRow(row));

  return [headerLine, separatorLine, ...rowLines].join("\n");
}

// ---------------------------------------------------------------------------
// Find & Replace
// ---------------------------------------------------------------------------

export interface TableMatch {
  /** The raw markdown of the table. */
  text: string;
  /** Start index in the source string. */
  start: number;
  /** End index (exclusive) in the source string. */
  end: number;
}

/**
 * Find all markdown table blocks in a content string.
 *
 * Uses a GFM-aware markdown AST parser so that tables without leading/trailing
 * pipes (e.g. `A | B\n--- | ---\n1 | 2`) are recognised in addition to
 * fully-fenced `| … |` tables.
 */
export function findAllTables(content: string): TableMatch[] {
  const tree = fromMarkdown(content, {
    extensions: [gfm()],
    mdastExtensions: [gfmFromMarkdown()],
  });

  const tables: TableMatch[] = [];
  visit(tree, "table", (node) => {
    if (!node.position) return;
    const start = node.position.start.offset ?? 0;
    const end = node.position.end.offset ?? content.length;
    tables.push({ text: content.slice(start, end), start, end });
  });
  return tables;
}

/**
 * Replace the nth table in the content with new markdown.
 */
export function replaceNthTable(content: string, tableIndex: number, newTableMarkdown: string): string {
  const tables = findAllTables(content);
  if (tableIndex < 0 || tableIndex >= tables.length) return content;

  const table = tables[tableIndex];
  return content.slice(0, table.start) + newTableMarkdown + content.slice(table.end);
}

// ---------------------------------------------------------------------------
// Default empty table
// ---------------------------------------------------------------------------

/**
 * Create a default empty table with the given dimensions.
 */
export function createEmptyTable(cols = 2, rows = 2): TableData {
  return {
    headers: Array.from({ length: cols }, (_, i) => `Header ${i + 1}`),
    rows: Array.from({ length: rows }, () => Array.from({ length: cols }, () => "")),
    alignments: Array.from({ length: cols }, () => "none" as ColumnAlignment),
  };
}
