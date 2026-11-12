import { describe, expect, it } from "vitest";
import { findAnchorTarget, findMemoAnchorTarget, slugify } from "@/utils/markdown-manipulation";

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
