import { describe, expect, it } from "vitest";
import { parseMarkdown, roundTripMarkdown } from "@/components/MemoEditor/Editor/markdownCodec";

function blockTypes(markdown: string): string[] {
  return (parseMarkdown(markdown).content ?? []).map((node) => node.type ?? "");
}

describe("PreservedBlock", () => {
  it("captures a table as a single preservedBlock node", () => {
    const md = "| a | b |\n| --- | --- |\n| 1 | 2 |";
    expect(blockTypes(md)).toEqual(["preservedBlock"]);
  });

  it("captures block math as preservedBlock", () => {
    const md = "$$\nx^2\n$$";
    expect(blockTypes(md)).toEqual(["preservedBlock"]);
  });

  it("captures block HTML as preservedBlock", () => {
    const md = "<div>\nhello\n</div>";
    expect(blockTypes(md)).toEqual(["preservedBlock"]);
  });
});

describe("PreservedInline", () => {
  it("keeps inline math verbatim — underscores must not get escaped", () => {
    expect(roundTripMarkdown("index $x_1$ here").trim()).toBe("index $x_1$ here");
  });

  it("keeps inline HTML tags literal instead of converting them to marks", () => {
    expect(roundTripMarkdown("an <em>emphasis</em> tag").trim()).toBe("an <em>emphasis</em> tag");
  });

  it("does not swallow autolinks", () => {
    const doc = parseMarkdown("see <https://example.com> now");
    const para = doc.content?.[0];
    const hasLinkMark = (para?.content ?? []).some((n) => (n.marks ?? []).some((m) => m.type === "link"));
    expect(hasLinkMark).toBe(true);
  });
});

describe("preserved-syntax edge cases", () => {
  it.each([
    "I paid $$ for this",
    "tip: 20%, cost: $$, worth it",
    "that costs $$$ these days",
    "$$$$",
    "$a$$b$",
  ])("mid-line $$ does not split paragraphs: %s", (s) => {
    expect(roundTripMarkdown(s).trim()).toBe(s);
  });

  it("block math followed directly by text normalizes once to blank-line separation, then is stable", () => {
    // Byte-identity is impossible here regardless of how the tokenizer treats
    // the trailing newline: the math block and the following paragraph are
    // sibling block nodes, and the Document serializer joins siblings with
    // \n\n. The single \n separator is normalized to a blank line exactly
    // once; after that the output is a fixed point.
    const out = roundTripMarkdown("$$\nx\n$$\nnext line");
    expect(out.trim()).toBe("$$\nx\n$$\n\nnext line"); // known one-time normalization
    expect(roundTripMarkdown(out)).toBe(out); // stable afterward
  });

  it("preserves inline HTML comments", () => {
    expect(roundTripMarkdown("text <!-- hi --> more").trim()).toBe("text <!-- hi --> more");
  });

  it("preserves block HTML comments", () => {
    expect(roundTripMarkdown("<!-- standalone -->").trim()).toBe("<!-- standalone -->");
  });

  it("handles > inside quoted attributes", () => {
    expect(roundTripMarkdown('a <span data-x="1 > 0">hm</span> b').trim()).toBe('a <span data-x="1 > 0">hm</span> b');
  });

  it("does not catastrophically backtrack on unterminated tags full of quotes", () => {
    const hostile = `a <span ${'"x'.repeat(60)} b`;
    const startedAt = performance.now();
    const out = roundTripMarkdown(hostile);
    expect(performance.now() - startedAt).toBeLessThan(1000);
    // Stray unmatched quotes may be entity-encoded by upstream; keep the timing
    // assertion strict and only verify the stable trailing content is present.
    expect(out).toContain("b");
  });
});
