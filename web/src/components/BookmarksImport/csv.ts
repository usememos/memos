// RFC-4180 CSV parser: quoted fields, "" escapes, embedded commas/newlines, CRLF.
// ponytail: hand-rolled (~40 lines) instead of papaparse — AGENTS.md says ask before
// adding dependencies, and this only needs the one format.
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(current);
      current = "";
    } else if (char === "\r") {
      continue;
    } else if (char === "\n") {
      row.push(current);
      rows.push(row);
      row = [];
      current = "";
    } else {
      current += char;
    }
  }
  if (current !== "" || row.length > 0) {
    row.push(current);
    rows.push(row);
  }
  return rows;
}

export interface RaindropRow {
  title: string;
  note: string;
  url: string;
  folder: string;
  tags: string[];
  highlights: string;
}

const RAINDROP_COLUMNS = ["id", "title", "note", "excerpt", "url", "folder", "tags", "created", "cover", "highlights", "favorite"] as const;

export function parseRaindropCsv(text: string): RaindropRow[] {
  const rows = parseCsv(text);
  if (rows.length === 0) {
    return [];
  }
  const header = rows[0].map((column) => column.trim().toLowerCase());
  const indexes = Object.fromEntries(RAINDROP_COLUMNS.map((name) => [name, header.indexOf(name)]));
  const at = (row: string[], name: (typeof RAINDROP_COLUMNS)[number]) => (indexes[name] >= 0 ? (row[indexes[name]] ?? "") : "");

  const parsed: RaindropRow[] = [];
  for (const row of rows.slice(1)) {
    const url = at(row, "url").trim();
    if (!/^https?:\/\//.test(url)) {
      continue;
    }
    const tags = at(row, "tags")
      .split(/[,;]/)
      .map((tag) => tag.trim())
      .filter(Boolean);
    parsed.push({
      title: at(row, "title").trim(),
      note: at(row, "note").trim(),
      url,
      folder: at(row, "folder").trim(),
      tags,
      highlights: at(row, "highlights").trim(),
    });
  }
  return parsed;
}
