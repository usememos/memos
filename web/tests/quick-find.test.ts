import { describe, expect, it } from "vitest";
import { buildQuickFindFilters, isQuickFindCollectionRoute } from "@/components/AppSidebar/QuickFindDialog";
import { type MemoFilter, replaceFiltersByFactor } from "@/contexts/MemoFilterContext";

describe("Quick Find", () => {
  const scopedFilters: MemoFilter[] = [
    { factor: "tagSearch", value: "work" },
    { factor: "displayTime", value: "2026-08-03" },
    { factor: "contentSearch", value: "old" },
  ];

  it("replaces search terms while preserving date and tag facets in a collection", () => {
    expect(buildQuickFindFilters("project plan project", scopedFilters, true)).toEqual([
      { factor: "tagSearch", value: "work" },
      { factor: "displayTime", value: "2026-08-03" },
      { factor: "contentSearch", value: "project" },
      { factor: "contentSearch", value: "plan" },
    ]);
  });

  it("starts a clean All search outside collection routes", () => {
    expect(buildQuickFindFilters("project", scopedFilters, false)).toEqual([{ factor: "contentSearch", value: "project" }]);
    expect(isQuickFindCollectionRoute("/attachments")).toBe(false);
    expect(isQuickFindCollectionRoute("/archived")).toBe(true);
    expect(isQuickFindCollectionRoute("/u/steven")).toBe(true);
  });

  it("replaces only the selected date facet", () => {
    expect(replaceFiltersByFactor(scopedFilters, "displayTime", [{ factor: "displayTime", value: "2026-08-02" }])).toEqual([
      { factor: "tagSearch", value: "work" },
      { factor: "contentSearch", value: "old" },
      { factor: "displayTime", value: "2026-08-02" },
    ]);
  });
});
