import { describe, expect, it } from "vitest";
import { clampIndex, findCardLocation, findGroupLocation, moveCard, moveGroup } from "@/modules/navigation/reorder";
import type { NavConfig } from "@/modules/navigation/types";

const card = (id: string, updatedAt = 1) => ({ id, title: id, url: `https://${id}.example.com`, updatedAt });

const config: NavConfig = {
  version: 1,
  rev: 1,
  updatedAt: 1,
  groups: [
    { id: "g-dev", name: "开发", collapsed: false, items: [card("c-a"), card("c-b"), card("c-c")] },
    { id: "g-media", name: "娱乐", collapsed: false, items: [card("c-d"), card("c-e")] },
  ],
  tombstones: [],
};

const ids = (groups: NavConfig["groups"]) => groups.map((g) => g.items.map((c) => c.id));

describe("clampIndex", () => {
  it("clamps into [0, length]", () => {
    expect(clampIndex(-5, 3)).toBe(0);
    expect(clampIndex(2, 3)).toBe(2);
    expect(clampIndex(99, 3)).toBe(3);
  });
});

describe("findCardLocation", () => {
  it("finds the card with its group and index", () => {
    expect(findCardLocation(config, "c-d")).toEqual({ card: card("c-d"), groupId: "g-media", index: 0 });
  });

  it("returns null for an unknown card", () => {
    expect(findCardLocation(config, "c-zzz")).toBeNull();
  });
});

describe("findGroupLocation", () => {
  it("finds the group with its index", () => {
    expect(findGroupLocation(config, "g-media")?.index).toBe(1);
  });

  it("returns null for an unknown group", () => {
    expect(findGroupLocation(config, "g-zzz")).toBeNull();
  });
});

describe("moveCard", () => {
  it("reorders inside a group (insert before a later card)", () => {
    const next = moveCard(config, "c-a", "g-dev", 2);
    expect(ids(next.groups)).toEqual([
      ["c-b", "c-a", "c-c"],
      ["c-d", "c-e"],
    ]);
  });

  it("reorders inside a group (insert before an earlier card)", () => {
    const next = moveCard(config, "c-c", "g-dev", 0);
    expect(ids(next.groups)).toEqual([
      ["c-c", "c-a", "c-b"],
      ["c-d", "c-e"],
    ]);
  });

  it("moves to the end of a group", () => {
    const next = moveCard(config, "c-d", "g-media", 2);
    expect(ids(next.groups)).toEqual([
      ["c-a", "c-b", "c-c"],
      ["c-e", "c-d"],
    ]);
  });

  it("moves across groups and drops empty-source groups quietly", () => {
    const next = moveCard(config, "c-a", "g-media", 0);
    expect(ids(next.groups)).toEqual([
      ["c-b", "c-c"],
      ["c-a", "c-d", "c-e"],
    ]);
  });

  it("is a no-op when the card goes back to its own slot", () => {
    expect(moveCard(config, "c-a", "g-dev", 0)).toBe(config);
    expect(moveCard(config, "c-b", "g-dev", 1)).toBe(config);
    expect(moveCard(config, "c-b", "g-dev", 2)).toBe(config);
  });

  it("is a no-op for unknown cards or groups", () => {
    expect(moveCard(config, "c-zzz", "g-dev", 0)).toBe(config);
    expect(moveCard(config, "c-a", "g-zzz", 0)).toBe(config);
  });

  it("clamps an out-of-range drop index and does not mutate the input", () => {
    const next = moveCard(config, "c-a", "g-media", 99);
    expect(ids(next.groups)).toEqual([
      ["c-b", "c-c"],
      ["c-d", "c-e", "c-a"],
    ]);
    expect(ids(config.groups)).toEqual([
      ["c-a", "c-b", "c-c"],
      ["c-d", "c-e"],
    ]);
  });
});

describe("moveGroup", () => {
  it("moves a group forward and up", () => {
    expect(moveGroup(config, "g-media", 0).groups.map((g) => g.id)).toEqual(["g-media", "g-dev"]);
  });

  it("moves a group backward", () => {
    expect(moveGroup(config, "g-dev", 2).groups.map((g) => g.id)).toEqual(["g-media", "g-dev"]);
  });

  it("is a no-op for the same slot or an unknown group", () => {
    expect(moveGroup(config, "g-dev", 0)).toBe(config);
    expect(moveGroup(config, "g-dev", 1)).toBe(config);
    expect(moveGroup(config, "g-media", 1)).toBe(config);
    expect(moveGroup(config, "g-zzz", 0)).toBe(config);
  });
});
