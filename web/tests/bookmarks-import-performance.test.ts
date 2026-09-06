import { performance } from "node:perf_hooks";
import { describe, expect, it } from "vitest";
import { parseRaindropCsv } from "@/components/BookmarksImport/csv";
import { normalizeBookmarkUrl } from "@/lib/bookmark";

const HEADER = "id,title,note,excerpt,url,folder,tags,created,cover,highlights,favorite\n";

const fixtureNear = (bytes: number, longFields: boolean): string => {
  const rows: string[] = [HEADER];
  const note = longFields ? `"${"quoted, field ".repeat(80)}"` : "note";
  let length = HEADER.length;
  for (let index = 0; length < bytes; index++) {
    const row = `${index},Title ${index},${note},,https://example.test/${index},Folder,tag,,,,false\n`;
    rows.push(row);
    length += row.length;
  }
  return rows.join("");
};

describe("bookmark import performance fixture", () => {
  it.each([
    ["many short rows", false],
    ["long quoted fields", true],
  ])("measures a fixed near-10-MiB %s CSV", (_label, longFields) => {
    const csv = fixtureNear(10 * 1024 * 1024 - 1024, longFields);
    const heapBefore = process.memoryUsage().heapUsed;
    const parseStarted = performance.now();
    const rows = parseRaindropCsv(csv);
    const parseMs = performance.now() - parseStarted;
    const dedupeStarted = performance.now();
    const urls = new Set(rows.map((row) => normalizeBookmarkUrl(row.url)));
    const dedupeMs = performance.now() - dedupeStarted;
    const heapDeltaMiB = (process.memoryUsage().heapUsed - heapBefore) / 1024 / 1024;

    console.info(JSON.stringify({ fixtureBytes: csv.length, rows: rows.length, parseMs, dedupeMs, heapDeltaMiB, longFields }));
    expect(urls.size).toBe(rows.length);
  });
});
