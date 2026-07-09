import { describe, expect, it } from "vitest";
import { assignColumnsByEstimatedHeight } from "@/components/ColumnGrid";

describe("assignColumnsByEstimatedHeight", () => {
  it("assigns each card to the shortest estimated column with deterministic ties", () => {
    const columns = assignColumnsByEstimatedHeight({
      keys: ["a", "b", "c", "d"],
      columnCount: 2,
      getEstimatedHeight: (key) => ({ a: 100, b: 80, c: 70, d: 60 })[key] ?? 0,
    });

    expect(Object.fromEntries(columns)).toEqual({
      a: 0,
      b: 1,
      c: 1,
      d: 0,
    });
  });

  it("keeps pinned cards in the first column while balancing later cards", () => {
    const columns = assignColumnsByEstimatedHeight({
      keys: ["leading", "a", "priority", "b", "c"],
      columnCount: 3,
      getEstimatedHeight: (key) => ({ leading: 160, a: 90, priority: 80, b: 120, c: 70 })[key] ?? 0,
      pinnedKeys: new Set(["leading", "priority"]),
    });

    expect(Object.fromEntries(columns)).toEqual({
      leading: 0,
      a: 1,
      priority: 0,
      b: 2,
      c: 1,
    });
  });
});
