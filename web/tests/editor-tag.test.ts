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

  it("includes combining marks in a tag run", () => {
    // Malayalam കവിത carries a spacing combining vowel sign (U+0D3F, \p{M});
    // the tag must cover the whole word, not stop at the first mark.
    expect(firstParagraphChildren("#കവിത")[0]).toMatchObject({
      type: "text",
      text: "#കവിത",
      marks: [{ type: "tag", attrs: { tag: "കവിത" } }],
    });
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

  it("round-trips ##x unchanged and normalizes #a#b to \\#a#b (conservative # escaping)", () => {
    // "##x" → text "#" + tag "x"; the lone "#" is not tag-shaped, so untouched.
    expect(roundTripMarkdown("##x").trim()).toBe("##x");
    // "#a#b" → text "#a" + tag "b"; the plain "#a" is tag-shaped, so the
    // serializer escapes it to keep it literal. Doc-equivalent, stable after.
    expect(roundTripMarkdown("#a#b").trim()).toBe("\\#a#b");
    expect(roundTripMarkdown("\\#a#b").trim()).toBe("\\#a#b");
  });

  it("treats a run longer than 100 tag characters as plain text", () => {
    const input = `#${"x".repeat(101)}`;
    expect(roundTripMarkdown(input).trim()).toBe(input);
    const textNodes = collectTextNodes(parseMarkdown(input));
    expect(textNodes.length).toBeGreaterThan(0);
    expect(textNodes.some((n) => hasTagMark(n))).toBe(false);
  });

  it("keeps a backslash-escaped \\#tag literal and durable across round-trips", () => {
    const input = "\\#NAS is my server";

    // Escapes are lexical: `\#NAS` parses to ordinary text — no tag mark, no
    // bespoke "escaped tag" node — the `\` is simply consumed.
    const children = firstParagraphChildren(input);
    expect(children.some(hasTagMark)).toBe(false);
    expect(children.map((n) => n.text ?? "").join("")).toBe("#NAS is my server");

    // The serializer re-escapes the tag-shaped `#`, so it never degrades into a
    // tag...
    const once = roundTripMarkdown(input).trim();
    expect(once).toBe("\\#NAS is my server");
    // ...and stays stable on every subsequent cycle.
    expect(roundTripMarkdown(once).trim()).toBe(once);
  });

  it("escapes only the literal tag while still tagging a real one beside it", () => {
    const input = "\\#NAS and #real";
    expect(roundTripMarkdown(input).trim()).toBe("\\#NAS and #real");

    const tagged = firstParagraphChildren(input).filter(hasTagMark);
    expect(tagged).toHaveLength(1);
    expect(tagged[0]).toMatchObject({ text: "#real", marks: [{ type: "tag", attrs: { tag: "real" } }] });
  });
});
