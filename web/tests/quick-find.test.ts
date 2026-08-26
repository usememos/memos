import { describe, expect, it } from "vitest";
import { buildQuickFindFilters, resolveQuickFindSubmission } from "@/components/AppSidebar/QuickFindDialog";
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
  });

  it.each(["/", "/explore"])("keeps scoped filters and stays on %s", (pathname) => {
    expect(resolveQuickFindSubmission(pathname, "project", scopedFilters)).toEqual({
      filters: [
        { factor: "tagSearch", value: "work" },
        { factor: "displayTime", value: "2026-08-03" },
        { factor: "contentSearch", value: "project" },
      ],
      destination: undefined,
      switchToAll: false,
    });
  });

  it("searches Archived as a user collection without clearing the remembered Space", () => {
    expect(resolveQuickFindSubmission("/archived", "project", scopedFilters)).toEqual({
      filters: [
        { factor: "tagSearch", value: "work" },
        { factor: "displayTime", value: "2026-08-03" },
        { factor: "contentSearch", value: "project" },
      ],
      destination: undefined,
      switchToAll: false,
    });
  });

  it("keeps the remembered collection filters when searching from Attachments", () => {
    expect(resolveQuickFindSubmission("/attachments", "project", scopedFilters)).toEqual({
      filters: [
        { factor: "tagSearch", value: "work" },
        { factor: "displayTime", value: "2026-08-03" },
        { factor: "contentSearch", value: "project" },
      ],
      destination: "/?filter=tagSearch:work,displayTime:2026-08-03,contentSearch:project",
      switchToAll: false,
    });
  });

  it("keeps the remembered collection on a normalized Attachments route", () => {
    expect(resolveQuickFindSubmission("/Attachments/", "project", scopedFilters)).toEqual({
      filters: [
        { factor: "tagSearch", value: "work" },
        { factor: "displayTime", value: "2026-08-03" },
        { factor: "contentSearch", value: "project" },
      ],
      destination: "/?filter=tagSearch:work,displayTime:2026-08-03,contentSearch:project",
      switchToAll: false,
    });
  });

  it("keeps Profile search on the Profile and returns its map tab to the memo list", () => {
    expect(resolveQuickFindSubmission("/u/steven", "project", scopedFilters)).toEqual({
      filters: [
        { factor: "tagSearch", value: "work" },
        { factor: "displayTime", value: "2026-08-03" },
        { factor: "contentSearch", value: "project" },
      ],
      destination: "/u/steven?filter=tagSearch:work,displayTime:2026-08-03,contentSearch:project",
      switchToAll: false,
    });
  });

  it.each([
    "/inbox",
    "/setting",
    "/views",
    "/about",
    "/memos/abc",
    "/memos/shares/token",
    "/404",
  ])("starts a clean All search from %s", (pathname) => {
    expect(resolveQuickFindSubmission(pathname, "project", scopedFilters)).toEqual({
      filters: [{ factor: "contentSearch", value: "project" }],
      destination: "/?filter=contentSearch:project",
      switchToAll: true,
    });
  });

  it("replaces only the selected date facet", () => {
    expect(replaceFiltersByFactor(scopedFilters, "displayTime", [{ factor: "displayTime", value: "2026-08-02" }])).toEqual([
      { factor: "tagSearch", value: "work" },
      { factor: "contentSearch", value: "old" },
      { factor: "displayTime", value: "2026-08-02" },
    ]);
  });
});
