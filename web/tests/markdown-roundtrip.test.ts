import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseMarkdown, roundTripMarkdown } from "@/components/MemoEditor/Editor/markdownCodec";

const CORPUS_DIR = join(__dirname, "fixtures", "markdown-corpus");

function fixtures(group: string): Array<[name: string, source: string]> {
  const dir = join(CORPUS_DIR, group);
  return readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .sort()
    .map((f) => [f, readFileSync(join(dir, f), "utf8")]);
}

// Fidelity contract part 1: supported constructs round-trip semantically.
// "Semantic" = the parsed document tree is identical before and after a
// serialize cycle; marker style (e.g. `*` vs `-` bullets) may normalize.
describe("markdown round-trip corpus: supported syntax (semantic equality)", () => {
  for (const [name, source] of fixtures("supported")) {
    it(`${name}: parse → serialize → parse is identity`, () => {
      const serialized = roundTripMarkdown(source);
      expect(parseMarkdown(serialized)).toEqual(parseMarkdown(source));
    });

    it(`${name}: serialization is idempotent`, () => {
      const once = roundTripMarkdown(source);
      expect(roundTripMarkdown(once)).toBe(once);
    });
  }
});

// Fidelity contract part 2: unmodeled constructs round-trip byte-for-byte.
// Fixtures in preserved/ contain only preserved constructs + inert prose,
// so the entire file must survive a round trip unchanged (modulo outer trim).
// One known whitespace normalization: a block construct separated from the
// next block by a single \n gains a blank line (\n\n) on the first round trip
// — the Document serializer joins sibling blocks with \n\n. It is a one-time
// normalization; the idempotence tests below pin the output as stable.
describe("markdown round-trip corpus: preserved syntax (byte equality)", () => {
  for (const [name, source] of fixtures("preserved")) {
    it(`${name}: round-trips byte-for-byte`, () => {
      expect(roundTripMarkdown(source).trim()).toBe(source.trim());
    });

    it(`${name}: serialization is idempotent`, () => {
      const once = roundTripMarkdown(source);
      expect(roundTripMarkdown(once)).toBe(once);
    });
  }
});
