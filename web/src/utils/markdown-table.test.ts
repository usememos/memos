import { describe, expect, it } from "vitest";
import {
  createEmptyTable,
  findAllTables,
  parseMarkdownTable,
  replaceNthTable,
  serializeMarkdownTable,
  type TableData,
} from "./markdown-table";

// ---------------------------------------------------------------------------
// parseMarkdownTable
// ---------------------------------------------------------------------------

describe("parseMarkdownTable", () => {
  it("parses a basic table", () => {
    const md = `| A | B |
| --- | --- |
| 1 | 2 |
| 3 | 4 |`;
    const result = parseMarkdownTable(md);
    expect(result).not.toBeNull();
    expect(result!.headers).toEqual(["A", "B"]);
    expect(result!.rows).toEqual([
      ["1", "2"],
      ["3", "4"],
    ]);
    expect(result!.alignments).toEqual(["none", "none"]);
  });

  it("parses alignment markers", () => {
    const md = `| Left | Center | Right | None |
| :--- | :---: | ---: | --- |
| a | b | c | d |`;
    const result = parseMarkdownTable(md);
    expect(result).not.toBeNull();
    expect(result!.alignments).toEqual(["left", "center", "right", "none"]);
  });

  it("returns null for non-table text", () => {
    expect(parseMarkdownTable("hello world")).toBeNull();
  });

  it("returns null for a single line", () => {
    expect(parseMarkdownTable("| A | B |")).toBeNull();
  });

  it("returns null when separator is invalid", () => {
    const md = `| A | B |
| not | valid |`;
    expect(parseMarkdownTable(md)).toBeNull();
  });

  it("pads short rows to match header count", () => {
    const md = `| A | B | C |
| --- | --- | --- |
| 1 |`;
    const result = parseMarkdownTable(md);
    expect(result).not.toBeNull();
    expect(result!.rows[0]).toEqual(["1", "", ""]);
  });

  it("trims long rows to match header count", () => {
    const md = `| A | B |
| --- | --- |
| 1 | 2 | 3 | 4 |`;
    const result = parseMarkdownTable(md);
    expect(result).not.toBeNull();
    expect(result!.rows[0]).toEqual(["1", "2"]);
  });

  it("handles empty cells", () => {
    const md = `| A | B |
| --- | --- |
|  |  |`;
    const result = parseMarkdownTable(md);
    expect(result).not.toBeNull();
    expect(result!.rows[0]).toEqual(["", ""]);
  });

  it("handles table with no data rows", () => {
    const md = `| A | B |
| --- | --- |`;
    const result = parseMarkdownTable(md);
    expect(result).not.toBeNull();
    expect(result!.headers).toEqual(["A", "B"]);
    expect(result!.rows).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// serializeMarkdownTable
// ---------------------------------------------------------------------------

describe("serializeMarkdownTable", () => {
  it("serializes a basic table", () => {
    const data: TableData = {
      headers: ["A", "B"],
      rows: [
        ["1", "2"],
        ["3", "4"],
      ],
      alignments: ["none", "none"],
    };
    const result = serializeMarkdownTable(data);
    expect(result).toContain("| A");
    expect(result).toContain("| 1");
    // Should have 4 lines: header, separator, 2 data rows
    expect(result.split("\n")).toHaveLength(4);
  });

  it("preserves alignment in separator", () => {
    const data: TableData = {
      headers: ["Left", "Center", "Right"],
      rows: [["a", "b", "c"]],
      alignments: ["left", "center", "right"],
    };
    const result = serializeMarkdownTable(data);
    const lines = result.split("\n");
    const sep = lines[1];
    // Left alignment: starts with ":"
    expect(sep).toMatch(/\| :-+\s/);
    // Center alignment: starts and ends with ":"
    expect(sep).toMatch(/:-+:/);
    // Right alignment: ends with ":"
    expect(sep).toMatch(/-+: \|$/);
  });

  it("pads cells to uniform width", () => {
    const data: TableData = {
      headers: ["Short", "A very long header"],
      rows: [["x", "y"]],
      alignments: ["none", "none"],
    };
    const result = serializeMarkdownTable(data);
    const lines = result.split("\n");
    // All lines should have same length due to padding
    expect(new Set(lines.map((l) => l.length)).size).toBe(1);
  });

  it("round-trips through parse and serialize", () => {
    const original = `| Name  | Age |
| ----- | --- |
| Alice | 30  |
| Bob   | 25  |`;
    const parsed = parseMarkdownTable(original);
    expect(parsed).not.toBeNull();
    const serialized = serializeMarkdownTable(parsed!);
    const reparsed = parseMarkdownTable(serialized);
    expect(reparsed).not.toBeNull();
    expect(reparsed!.headers).toEqual(parsed!.headers);
    expect(reparsed!.rows).toEqual(parsed!.rows);
    expect(reparsed!.alignments).toEqual(parsed!.alignments);
  });
});

// ---------------------------------------------------------------------------
// findAllTables
// ---------------------------------------------------------------------------

describe("findAllTables", () => {
  it("finds a single table", () => {
    const content = `Some text

| A | B |
| --- | --- |
| 1 | 2 |

More text`;
    const tables = findAllTables(content);
    expect(tables).toHaveLength(1);
    expect(tables[0].text).toContain("| A | B |");
    // Verify start/end are correct by slicing
    expect(content.slice(tables[0].start, tables[0].end)).toBe(tables[0].text);
  });

  it("finds multiple tables", () => {
    const content = `| A | B |
| --- | --- |
| 1 | 2 |

Some text between

| X | Y |
| --- | --- |
| 3 | 4 |`;
    const tables = findAllTables(content);
    expect(tables).toHaveLength(2);
    expect(content.slice(tables[0].start, tables[0].end)).toBe(tables[0].text);
    expect(content.slice(tables[1].start, tables[1].end)).toBe(tables[1].text);
  });

  it("returns empty for no tables", () => {
    expect(findAllTables("just some text\nno tables here")).toHaveLength(0);
  });

  it("requires at least 2 lines for a table", () => {
    const content = "| single line |";
    expect(findAllTables(content)).toHaveLength(0);
  });

  it("handles table at end of content without trailing newline", () => {
    const content = `text
| A | B |
| --- | --- |
| 1 | 2 |`;
    const tables = findAllTables(content);
    expect(tables).toHaveLength(1);
    expect(content.slice(tables[0].start, tables[0].end)).toBe(tables[0].text);
  });

  it("handles table at start of content", () => {
    const content = `| A | B |
| --- | --- |
| 1 | 2 |
more text`;
    const tables = findAllTables(content);
    expect(tables).toHaveLength(1);
    expect(tables[0].start).toBe(0);
    expect(content.slice(tables[0].start, tables[0].end)).toBe(tables[0].text);
  });

  it("finds a pipe-less GFM table", () => {
    const content = "A | B\n--- | ---\n1 | 2";
    const tables = findAllTables(content);
    expect(tables).toHaveLength(1);
    expect(content.slice(tables[0].start, tables[0].end)).toBe(tables[0].text);
  });
});

// ---------------------------------------------------------------------------
// replaceNthTable
// ---------------------------------------------------------------------------

describe("replaceNthTable", () => {
  const content = `Before

| A | B |
| --- | --- |
| 1 | 2 |

Middle

| X | Y |
| --- | --- |
| 3 | 4 |

After`;

  it("replaces the first table", () => {
    const result = replaceNthTable(content, 0, "NEW TABLE");
    expect(result).toContain("NEW TABLE");
    expect(result).toContain("| X | Y |");
    expect(result).not.toContain("| A | B |");
  });

  it("replaces the second table", () => {
    const result = replaceNthTable(content, 1, "NEW TABLE");
    expect(result).toContain("| A | B |");
    expect(result).toContain("NEW TABLE");
    expect(result).not.toContain("| X | Y |");
  });

  it("deletes a table when replacing with empty string", () => {
    const result = replaceNthTable(content, 0, "");
    expect(result).not.toContain("| A | B |");
    expect(result).toContain("Before");
    expect(result).toContain("Middle");
  });

  it("returns content unchanged for invalid index", () => {
    expect(replaceNthTable(content, -1, "X")).toBe(content);
    expect(replaceNthTable(content, 99, "X")).toBe(content);
  });
});

// ---------------------------------------------------------------------------
// createEmptyTable
// ---------------------------------------------------------------------------

describe("createEmptyTable", () => {
  it("creates table with specified dimensions", () => {
    const table = createEmptyTable(3, 2);
    expect(table.headers).toHaveLength(3);
    expect(table.rows).toHaveLength(2);
    expect(table.alignments).toHaveLength(3);
    expect(table.rows[0]).toHaveLength(3);
  });

  it("creates default 2x2 table", () => {
    const table = createEmptyTable();
    expect(table.headers).toHaveLength(2);
    expect(table.rows).toHaveLength(2);
  });

  it("initializes with header placeholders", () => {
    const table = createEmptyTable(2, 1);
    expect(table.headers[0]).toBe("Header 1");
    expect(table.headers[1]).toBe("Header 2");
  });

  it("initializes cells as empty strings", () => {
    const table = createEmptyTable(2, 2);
    for (const row of table.rows) {
      for (const cell of row) {
        expect(cell).toBe("");
      }
    }
  });

  it("initializes all alignments to none", () => {
    const table = createEmptyTable(3, 1);
    expect(table.alignments).toEqual(["none", "none", "none"]);
  });
});
