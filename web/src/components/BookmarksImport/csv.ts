import { isValidBookmarkUrl } from "@/lib/bookmark";

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
  if (inQuotes) throw new SyntaxError("Unterminated CSV field");
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

type CsvWorkerResponse = { rows: RaindropRow[]; error?: never } | { rows?: never; error: string };

export const parseRaindropCsvAsync = (text: string, signal: AbortSignal): Promise<RaindropRow[]> => {
  if (signal.aborted) return Promise.reject(signal.reason);
  if (typeof Worker === "undefined") return Promise.resolve(parseRaindropCsv(text));
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./csv.worker.ts", import.meta.url), { type: "module" });
    const finish = () => {
      signal.removeEventListener("abort", abort);
      worker.terminate();
    };
    const abort = () => {
      finish();
      reject(signal.reason);
    };
    signal.addEventListener("abort", abort, { once: true });
    worker.onerror = () => {
      finish();
      reject(new SyntaxError("CSV parsing failed"));
    };
    worker.onmessage = (event: MessageEvent<CsvWorkerResponse>) => {
      finish();
      if ("error" in event.data) reject(new SyntaxError(event.data.error));
      else resolve(event.data.rows);
    };
    worker.postMessage(text);
  });
};

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
    if (!isValidBookmarkUrl(url)) {
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
