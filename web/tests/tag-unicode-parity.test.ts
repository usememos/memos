import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const DIGEST_PATTERN = /Unicode data SHA-256: ([0-9a-f]{64})/;

describe("tag Unicode data", () => {
  it("keeps the Go and TypeScript generated tables in sync", async () => {
    const [goSource, typeScriptSource] = await Promise.all([
      readFile(resolve(process.cwd(), "../internal/markdown/parser/tag_unicode_tables.go"), "utf8"),
      readFile(resolve(process.cwd(), "src/utils/tag-unicode-data.ts"), "utf8"),
    ]);

    expect(goSource.match(DIGEST_PATTERN)?.[1]).toBeDefined();
    expect(goSource.match(DIGEST_PATTERN)?.[1]).toBe(typeScriptSource.match(DIGEST_PATTERN)?.[1]);
  });
});
