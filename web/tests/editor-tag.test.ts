import type { JSONContent } from "@tiptap/core";
import { describe, expect, it } from "vitest";
import { parseMarkdown, roundTripMarkdown } from "@/components/MemoEditor/Editor/markdownCodec";

function firstParagraphChildren(markdown: string) {
  return parseMarkdown(markdown).content?.[0]?.content ?? [];
}

function collectTextNodes(node: JSONContent): JSONContent[] {
  const out: JSONContent[] = [];
  if (node.type === "text") {
    out.push(node);
  }
  for (const child of node.content ?? []) {
    out.push(...collectTextNodes(child));
  }
  return out;
}

function hasTagMark(node: JSONContent) {
  return (node.marks ?? []).some((m) => m.type === "tag");
}

describe("Tag mark", () => {
  it("parses #tag into tag-marked text", () => {
    const children = firstParagraphChildren("#hello world");
    expect(children[0]).toMatchObject({ type: "text", text: "#hello", marks: [{ type: "tag", attrs: { tag: "hello" } }] });
    expect(children[1]).toMatchObject({ type: "text", text: " world" });
  });

  it("serializes tag-marked text back to #tag verbatim", () => {
    expect(roundTripMarkdown("a #b-tag c").trim()).toBe("a #b-tag c");
  });

  it("supports unicode and nested-path tags", () => {
    expect(firstParagraphChildren("#日本語 and #work/project-1")[0]).toMatchObject({
      type: "text",
      text: "#日本語",
      marks: [{ type: "tag", attrs: { tag: "日本語" } }],
    });
    const children = firstParagraphChildren("see #work/project-1 now");
    const tagged = children.find((n) => hasTagMark(n));
    expect(tagged?.marks?.find((m) => m.type === "tag")?.attrs?.tag).toBe("work/project-1");
  });

  it("does not turn headings into tags", () => {
    expect(parseMarkdown("# heading").content?.[0]?.type).toBe("heading");
  });

  it("does not match a bare # followed by space", () => {
    const children = firstParagraphChildren("a # b");
    expect(children.every((n) => n.type === "text" && !hasTagMark(n))).toBe(true);
  });

  it("skips tags inside link labels and round-trips byte-identically", () => {
    const input = "[see #x](https://example.com)";
    expect(roundTripMarkdown(input).trim()).toBe(input);
  });

  it("keeps #notes inside the link label while tagging #real outside", () => {
    const input = "see [release #notes](https://e.com) and #real";
    expect(roundTripMarkdown(input).trim()).toBe(input);

    const children = firstParagraphChildren(input);
    const linked = children.filter((n) => (n.marks ?? []).some((m) => m.type === "link"));
    expect(linked.map((n) => n.text).join("")).toBe("release #notes");
    expect(linked.some((n) => hasTagMark(n))).toBe(false);

    const tagged = children.filter((n) => hasTagMark(n));
    expect(tagged).toHaveLength(1);
    expect(tagged[0]).toMatchObject({ text: "#real", marks: [{ type: "tag", attrs: { tag: "real" } }] });
  });

  it("composes with bold and round-trips byte-identically", () => {
    const input = "**bold #tag bold**";
    expect(roundTripMarkdown(input).trim()).toBe(input);
  });

  it("carries both bold and tag marks on **#urgent**", () => {
    const input = "**#urgent**";
    expect(roundTripMarkdown(input).trim()).toBe(input);

    const children = firstParagraphChildren(input);
    const node = children.find((n) => n.text === "#urgent");
    const markTypes = (node?.marks ?? []).map((m) => m.type);
    expect(markTypes).toContain("bold");
    expect(markTypes).toContain("tag");
  });

  it("does not escape underscores inside tags (code mark emits verbatim)", () => {
    expect(roundTripMarkdown("#a_b").trim()).toBe("#a_b");
  });

  it("respects punctuation boundaries", () => {
    const input = "#tag, then #two.";
    expect(roundTripMarkdown(input).trim()).toBe(input);
  });

  it("round-trips ##x and #a#b byte-identically (visual divergence documented in Tag.ts)", () => {
    expect(roundTripMarkdown("##x").trim()).toBe("##x");
    expect(roundTripMarkdown("#a#b").trim()).toBe("#a#b");
  });

  it("treats a run longer than 100 tag characters as plain text", () => {
    const input = `#${"x".repeat(101)}`;
    expect(roundTripMarkdown(input).trim()).toBe(input);
    const textNodes = collectTextNodes(parseMarkdown(input));
    expect(textNodes.length).toBeGreaterThan(0);
    expect(textNodes.some((n) => hasTagMark(n))).toBe(false);
  });

  it("documents known gap: backslash-escaped \\# degrades after one cycle (upstream escape dropping)", () => {
    const out = roundTripMarkdown("\\#escaped");
    expect(out.trim()).toBe("#escaped"); // upstream drops the escape (pre-existing); re-parse then sees a tag
    expect(roundTripMarkdown(out)).toBe(out); // at least stable from then on
  });
});
