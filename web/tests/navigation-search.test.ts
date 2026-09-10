import { describe, expect, it } from "vitest";
import { cycleIndex, flattenCards, searchNavConfig } from "@/modules/navigation/search";
import type { NavConfig } from "@/modules/navigation/types";

const card = (id: string, title: string, url: string, note?: string) => ({ id, title, url, ...(note ? { note } : {}), updatedAt: 1 });

const config: NavConfig = {
  version: 1,
  rev: 1,
  updatedAt: 1,
  groups: [
    {
      id: "g-dev",
      name: "开发",
      collapsed: true,
      items: [card("c-memos", "Memos", "https://usememos.com", "note taking app"), card("c-github", "GitHub", "https://github.com")],
    },
    {
      id: "g-media",
      name: "娱乐",
      collapsed: false,
      items: [card("c-mdn", "MDN", "https://developer.mozilla.org", "web docs")],
    },
    { id: "g-empty", name: "空组", collapsed: false, items: [] },
  ],
  tombstones: [],
};

describe("searchNavConfig", () => {
  it("returns the config unchanged for an empty or whitespace query", () => {
    expect(searchNavConfig(config, "")).toBe(config);
    expect(searchNavConfig(config, "   ")).toBe(config);
  });

  it("matches a title case-insensitively", () => {
    const result = searchNavConfig(config, "github");
    expect(flattenCards(result).map((c) => c.id)).toEqual(["c-github"]);
  });

  it("matches a URL", () => {
    const result = searchNavConfig(config, "developer.mozilla");
    expect(flattenCards(result).map((c) => c.id)).toEqual(["c-mdn"]);
  });

  it("matches a note", () => {
    const result = searchNavConfig(config, "note taking");
    expect(flattenCards(result).map((c) => c.id)).toEqual(["c-memos"]);
  });

  it("drops groups with no matching cards and force-expands survivors", () => {
    const result = searchNavConfig(config, "github");
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0].id).toBe("g-dev");
    expect(result.groups[0].collapsed).toBe(false);
  });

  it("returns no groups when nothing matches", () => {
    const result = searchNavConfig(config, "definitely-not-here");
    expect(result.groups).toHaveLength(0);
  });

  it("does not mutate the input config", () => {
    const result = searchNavConfig(config, "github");
    expect(result.groups).not.toBe(config.groups);
    expect(config.groups[0].collapsed).toBe(true);
  });
});

describe("flattenCards", () => {
  it("flattens visible cards in group order", () => {
    expect(flattenCards(config).map((c) => c.id)).toEqual(["c-memos", "c-github", "c-mdn"]);
  });

  it("returns an empty array for a config with no cards", () => {
    expect(flattenCards({ ...config, groups: [] })).toEqual([]);
  });
});

describe("cycleIndex", () => {
  it("wraps forward past the end", () => {
    expect(cycleIndex(2, 1, 3)).toBe(0);
  });

  it("wraps backward before the start", () => {
    expect(cycleIndex(0, -1, 3)).toBe(2);
  });

  it("steps normally inside the range", () => {
    expect(cycleIndex(0, 1, 3)).toBe(1);
    expect(cycleIndex(2, -1, 3)).toBe(1);
  });

  it("is safe for an empty list", () => {
    expect(cycleIndex(0, 1, 0)).toBe(0);
    expect(cycleIndex(3, -1, 0)).toBe(0);
  });
});
