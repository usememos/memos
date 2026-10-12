import { describe, expect, it } from "vitest";
import { findAnchorTarget, findMemoAnchorTarget, slugify, toggleTaskAtIndex } from "@/utils/markdown-manipulation";

describe("toggleTaskAtIndex", () => {
  it.each(["1.", "1)", "42.", "42)", "-", "*", "+"])("checks and unchecks %s tasks", (marker) => {
    expect(toggleTaskAtIndex(`${marker} [ ] Buy milk`, 0, true)).toBe(`${marker} [x] Buy milk`);
    expect(toggleTaskAtIndex(`${marker} [x] Buy milk`, 0, false)).toBe(`${marker} [ ] Buy milk`);
    expect(toggleTaskAtIndex(`${marker} [X] Buy milk`, 0, false)).toBe(`${marker} [ ] Buy milk`);
  });

  it.each(["\n", "\r\n"])("preserves formatting and targets only the selected nested task with %j line endings", (eol) => {
    const lines = ["Intro", "", "- [ ] First", "  1)  [ ] Second  ", "  2) [x] Third", "", "1. [ ] Last", ""];
    const markdown = lines.join(eol);
    lines[3] = "  1)  [x] Second  ";
    expect(toggleTaskAtIndex(markdown, 1, true)).toBe(lines.join(eol));
    expect(toggleTaskAtIndex(lines.join(eol), 1, false)).toBe(markdown);
  });

  it("ignores checkbox-looking text in fenced, indented, and inline code", () => {
    const lines = ["```md", "1. [ ] Fenced", "```", "", "    1) [ ] Indented", "", "`1. [ ] Inline`", "", "1) [ ] Real"];
    const markdown = lines.join("\n");
    lines[8] = "1) [x] Real";
    expect(toggleTaskAtIndex(markdown, 0, true)).toBe(lines.join("\n"));
    expect(toggleTaskAtIndex(markdown, 1, true)).toBe(markdown);
    expect(toggleTaskAtIndex(markdown, -1, true)).toBe(markdown);
  });
});

describe("slugify", () => {
  it("keeps non-Latin headings addressable", () => {
    expect(slugify("連濁")).toBe("連濁");
  });

  it("keeps combining marks so Indic vowels survive", () => {
    expect(slugify("हिन्दी")).toBe("हिन्दी");
  });

  it("normalizes so decomposed and composed spellings share an anchor", () => {
    expect(slugify("café")).toBe(slugify("café"));
  });

  it("drops punctuation and collapses whitespace", () => {
    expect(slugify(`Why Hito-Bito isn't  Hito-Hito`)).toBe("why-hito-bito-isnt-hito-hito");
  });
});

describe("findAnchorTarget", () => {
  it("resolves duplicate anchors minted by the legacy ASCII slugger", () => {
    const root = document.createElement("div");
    root.innerHTML = '<h2 id="café">Café</h2><h2 id="café-1">Café</h2>';

    expect(findAnchorTarget(root, "caf-1")).toBe(root.children[1]);
  });

  it("prefers a matching heading inside the requested memo over a page-level id", () => {
    const root = document.createElement("div");
    root.innerHTML = '<div id="root"></div><div data-memo-content data-memo-name="memos/1"><h2 id="root">Title</h2></div>';

    expect(findMemoAnchorTarget(root, "memos/1", "root")).toBe(root.querySelector("h2"));
  });

  it("falls back to page-level targets outside the memo", () => {
    const root = document.createElement("div");
    root.innerHTML = '<div data-memo-content data-memo-name="memos/1"></div><div id="comment-1"></div>';

    expect(findMemoAnchorTarget(root, "memos/1", "comment-1")).toBe(root.lastElementChild);
  });
});
