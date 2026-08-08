import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { MemoMarkdownRenderer } from "@/components/MemoContent/MemoMarkdownRenderer";
import { extractHeadings } from "@/components/MemoContent/pipeline";

vi.mock("@/components/MemoContent/math", () => ({
  hasMathSyntax: vi.fn(() => false),
}));

/**
 * The outline and the rendered heading ids come from one pipeline run, so these cases are about
 * keeping that so: each one previously produced an outline slug that no rendered heading carried.
 */
const renderMemo = (content: string) => {
  const { container } = render(
    <MemoryRouter>
      <MemoMarkdownRenderer content={content} memoName="memos/1" resolvedMentionUsernames={new Set<string>()} />
    </MemoryRouter>,
  );
  return container;
};

const expectOutlineLandsOnRenderedHeadings = (content: string) => {
  const container = renderMemo(content);
  const headings = extractHeadings(content);
  const renderedIds = Array.from(container.querySelectorAll("h1, h2, h3, h4, h5, h6"), (heading) => heading.id).filter(Boolean);

  expect(new Set(renderedIds).size, "rendered heading ids must be unique").toBe(renderedIds.length);
  for (const heading of headings) {
    expect(container.querySelector(`[id="${CSS.escape(heading.slug)}"]`), `no element carries id "${heading.slug}"`).not.toBeNull();
  }
  return headings;
};

describe("outline slugs against rendered heading ids", () => {
  it("handles inline HTML, duplicates and repeated suffixes", () => {
    const headings = expectOutlineLandsOnRenderedHeadings(
      `# <ruby>連濁<rt>れんだく</rt></ruby>: intro\n\n## Dup\n\n##### Dup\n\n## Dup\n\n### 連\n\n### 連\n\n### 連-1\n\nbody`,
    );

    expect(headings[0]).toEqual({ text: "連濁れんだく: intro", level: 1, slug: "連濁れんだく-intro" });
    // The h5 consumes "dup-1" even though it never reaches the outline.
    expect(headings.filter((heading) => heading.text === "Dup").map((heading) => heading.slug)).toEqual(["dup", "dup-2"]);
    // A literal "連-1" heading must not collide with the suffix generated for the second "連".
    expect(headings.filter((heading) => heading.level === 3).map((heading) => heading.slug)).toEqual(["連", "連-1", "連-1-1"]);
  });

  it("ignores setext headings, which the renderer disables", () => {
    const headings = expectOutlineLandsOnRenderedHeadings("Title\n-----\n\n# Title");

    expect(headings).toEqual([{ text: "Title", level: 1, slug: "title" }]);
  });

  it("lists headings written as raw HTML alongside markdown ones", () => {
    const headings = expectOutlineLandsOnRenderedHeadings("<h2>Dup</h2>\n\n## Dup");

    expect(headings.map((heading) => heading.slug)).toEqual(["dup", "dup-1"]);
  });

  it("keeps an author-supplied id and numbers around it", () => {
    const headings = expectOutlineLandsOnRenderedHeadings('<h2 id="custom">Dup</h2>\n\n## custom');

    expect(headings.map((heading) => heading.slug)).toEqual(["custom", "custom-1"]);
  });

  it("uses the sanitized text when an element is stripped with its content", () => {
    const headings = expectOutlineLandsOnRenderedHeadings("# Alert <script>alert(1)</script>");

    expect(headings).toHaveLength(1);
    expect(headings[0].text).not.toContain("alert(1)");
    expect(headings[0].slug).toBe("alert");
  });

  it("includes the footnote marker the rendered heading shows, and omits the footnote label", () => {
    const headings = expectOutlineLandsOnRenderedHeadings("# Intro[^1]\n\n## Intro\n\n[^1]: note");

    expect(headings.map((heading) => heading.slug)).toEqual(["intro1", "intro"]);
    expect(headings.some((heading) => heading.text === "Footnotes")).toBe(false);
  });

  it("reserves the referenced footnote label id before assigning heading slugs", () => {
    const container = renderMemo("# Footnote label\n\nText[^1]\n\n[^1]: note");
    const reference = container.querySelector("[data-footnote-ref]");
    const label = container.querySelector(".footnotes > h2");

    expect(reference).toHaveAttribute("aria-describedby", "footnote-label");
    expect(label).toHaveAttribute("id", "footnote-label");
    expect(container.querySelector("h1")).toHaveAttribute("id", "footnote-label-1");
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
    const headings = expectOutlineLandsOnRenderedHeadings("# Intro\n\n# 🎉🎉\n\n# ✨");

    expect(headings.map((heading) => heading.slug)).toEqual(["intro", "heading", "heading-1"]);
  });
});
