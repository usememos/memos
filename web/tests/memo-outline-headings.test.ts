import { describe, expect, it } from "vitest";
import { extractHeadings } from "@/components/MemoContent/headings";

// The memo view sets the same anchors as element ids (see memo-content.test.tsx), so an
// outline link always has somewhere to land.
describe("outline headings", () => {
  it("handles duplicates and repeated suffixes", () => {
    const headings = extractHeadings("# Intro\n\n## Dup\n\n##### Dup\n\n## Dup\n\n### 連\n\n### 連\n\n### 連-1\n\nbody");

    expect(headings[0]).toEqual({ text: "Intro", level: 1, slug: "intro" });
    // The h5 consumes "dup-1" even though it never reaches the outline.
    expect(headings.filter((heading) => heading.text === "Dup").map((heading) => heading.slug)).toEqual(["dup", "dup-2"]);
    // A literal "連-1" heading must not collide with the suffix generated for the second "連".
    expect(headings.filter((heading) => heading.level === 3).map((heading) => heading.slug)).toEqual(["連", "連-1", "連-1-1"]);
  });

  it("ignores setext headings, which memos disables", () => {
    expect(extractHeadings("Title\n-----\n\n# Title")).toEqual([{ text: "Title", level: 1, slug: "title" }]);
  });

  it("reserves current and legacy comment-section anchors from memo headings", () => {
    expect(extractHeadings("# Comments\n\n## Memo comments").map((heading) => heading.slug)).toEqual(["comments-1", "memo-comments-1"]);
  });

  it("returns nothing for content that cannot contain a heading", () => {
    // The cheap pre-check must not mistake a tag or a shebang for a heading, and must still
    // catch an indented ATX heading.
    expect(extractHeadings("just a note about #work and #life")).toEqual([]);
    expect(extractHeadings("```sh\n#!/bin/bash\necho hi\n```")).toEqual([]);
    expect(extractHeadings("  ## Indented")).toEqual([{ text: "Indented", level: 2, slug: "indented" }]);
    expect(extractHeadings("#\tTabbed")).toEqual([{ text: "Tabbed", level: 1, slug: "tabbed" }]);
  });

  it("gives headings with no slugifiable characters a usable anchor", () => {
    expect(extractHeadings("# Intro\n\n# 🎉🎉\n\n# ✨").map((heading) => heading.slug)).toEqual(["intro", "heading", "heading-1"]);
  });
});
