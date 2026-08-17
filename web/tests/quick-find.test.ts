import { describe, expect, it } from "vitest";
import { buildQuickFindFilters, isCELQuery, isQuickFindCollectionRoute } from "@/components/AppSidebar/QuickFindDialog";
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

  it("passes CEL expressions through as a single filter", () => {
    const cel = 'tag in ["work", "personal"] || content.matches("urgent")';

    expect(isCELQuery(cel)).toBe(true);
    expect(buildQuickFindFilters("pinned", [], false)).toEqual([{ factor: "celSearch", value: "pinned" }]);
    expect(buildQuickFindFilters(cel, scopedFilters, true)).toEqual([
      { factor: "tagSearch", value: "work" },
      { factor: "displayTime", value: "2026-08-03" },
      { factor: "celSearch", value: cel },
    ]);
  });

  it("keeps incomplete and unsupported CEL-looking searches as content searches", () => {
    expect(isCELQuery("tag in")).toBe(false);
    expect(isCELQuery("pinned ||")).toBe(false);
    expect(isCELQuery("content.foobar()")).toBe(false);
    expect(isCELQuery("creator in residence")).toBe(false);
    expect(buildQuickFindFilters("creator in residence", [], false)).toEqual([
      { factor: "contentSearch", value: "creator" },
      { factor: "contentSearch", value: "in" },
      { factor: "contentSearch", value: "residence" },
    ]);
  });

  it("retains supported CEL methods with complete operands", () => {
    expect(isCELQuery('content.contains("urgent")')).toBe(true);
    expect(isCELQuery('tags.exists(t, t.startsWith("work/"))')).toBe(true);
    expect(isCELQuery("created_ts.getFullYear() == 2026")).toBe(true);
    expect(isCELQuery('sets.intersects(tags, ["work"])')).toBe(true);
  });

  it("clears a previous CEL search when the query becomes plain text", () => {
    const currentFilters: MemoFilter[] = [{ factor: "celSearch", value: "pinned" }];

    expect(buildQuickFindFilters("project plan", currentFilters, true)).toEqual([
      { factor: "contentSearch", value: "project" },
      { factor: "contentSearch", value: "plan" },
    ]);
  });

  it("replaces only the selected date facet", () => {
    expect(replaceFiltersByFactor(scopedFilters, "displayTime", [{ factor: "displayTime", value: "2026-08-02" }])).toEqual([
      { factor: "tagSearch", value: "work" },
      { factor: "contentSearch", value: "old" },
      { factor: "displayTime", value: "2026-08-02" },
    ]);
  });
});
