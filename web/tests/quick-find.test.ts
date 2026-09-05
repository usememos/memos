import { describe, expect, it } from "vitest";
import { buildQuickFindFilters, resolveQuickFindSubmission } from "@/components/AppSidebar/QuickFindDialog";
import { type MemoFilter, parseFilterQuery, replaceFiltersByFactor } from "@/contexts/MemoFilterContext";

describe("Quick Find", () => {
  const scopedFilters: MemoFilter[] = [
    { factor: "tagSearch", value: "work" },
    { factor: "displayTime", value: "2026-08-03" },
    { factor: "contentSearch", value: "old" },
  ];

  it.each([
    "content.contains('urgent')",
    'tags.exists(t, t.startsWith("work/"))',
    'content.matches("(?i)urgent")',
    "space == null",
    'content.contains("50%, café & C++")\n || pinned',
  ])("retains CEL verbatim through a navigation URL: %s", (expression) => {
    const submission = resolveQuickFindSubmission("/attachments", expression, scopedFilters, "cel");
    const decoded = parseFilterQuery(new URL(submission.destination!, "https://memos.test").searchParams.get("filter"));
    expect(decoded).toEqual([
      ...scopedFilters.filter((filter) => filter.factor !== "contentSearch"),
      { factor: "celSearch", value: expression },
    ]);
    expect(submission.switchToAll).toBe(false);
  });

  it("replaces both kinds of search without dropping facets", () => {
    const filters: MemoFilter[] = [...scopedFilters, { factor: "celSearch", value: "pinned" }];
    expect(buildQuickFindFilters("has_link", filters, true, "cel")).toEqual([
      ...scopedFilters.slice(0, 2),
      { factor: "celSearch", value: "has_link" },
    ]);
    expect(buildQuickFindFilters("new new", filters, true, "text")).toEqual([
      ...scopedFilters.slice(0, 2),
      { factor: "contentSearch", value: "new" },
    ]);
    expect(buildQuickFindFilters(" \n ", filters, true, "cel")).toEqual(scopedFilters.slice(0, 2));
    expect(buildQuickFindFilters(" ", filters, true, "text")).toEqual(scopedFilters.slice(0, 2));
  });

  it("does not recognize expressions in Text mode", () => {
    expect(buildQuickFindFilters('content.contains("urgent")', [], false, "text")).toEqual([
      { factor: "contentSearch", value: 'content.contains("urgent")' },
    ]);
  });

  it("replaces search terms while preserving date and tag facets in a collection", () => {
    expect(buildQuickFindFilters("project plan project", scopedFilters, true, "text")).toEqual([
      { factor: "tagSearch", value: "work" },
      { factor: "displayTime", value: "2026-08-03" },
      { factor: "contentSearch", value: "project" },
      { factor: "contentSearch", value: "plan" },
    ]);
  });

  it("starts a clean All search outside collection routes", () => {
    expect(buildQuickFindFilters("project", scopedFilters, false, "text")).toEqual([{ factor: "contentSearch", value: "project" }]);
  });

  it.each(["/", "/explore"])("keeps scoped filters and stays on %s", (pathname) => {
    expect(resolveQuickFindSubmission(pathname, "project", scopedFilters, "text")).toEqual({
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
    expect(resolveQuickFindSubmission("/archived", "project", scopedFilters, "text")).toEqual({
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
    expect(resolveQuickFindSubmission("/attachments", "project", scopedFilters, "text")).toEqual({
      filters: [
        { factor: "tagSearch", value: "work" },
        { factor: "displayTime", value: "2026-08-03" },
        { factor: "contentSearch", value: "project" },
      ],
      destination: "/?filter=tagSearch%3Awork%2CdisplayTime%3A2026-08-03%2CcontentSearch%3Aproject",
      switchToAll: false,
    });
  });

  it("keeps the remembered collection on a normalized Attachments route", () => {
    expect(resolveQuickFindSubmission("/Attachments/", "project", scopedFilters, "text")).toEqual({
      filters: [
        { factor: "tagSearch", value: "work" },
        { factor: "displayTime", value: "2026-08-03" },
        { factor: "contentSearch", value: "project" },
      ],
      destination: "/?filter=tagSearch%3Awork%2CdisplayTime%3A2026-08-03%2CcontentSearch%3Aproject",
      switchToAll: false,
    });
  });

  it("keeps Profile search on the Profile and returns its map tab to the memo list", () => {
    expect(resolveQuickFindSubmission("/u/steven", "project", scopedFilters, "text")).toEqual({
      filters: [
        { factor: "tagSearch", value: "work" },
        { factor: "displayTime", value: "2026-08-03" },
        { factor: "contentSearch", value: "project" },
      ],
      destination: "/u/steven?filter=tagSearch%3Awork%2CdisplayTime%3A2026-08-03%2CcontentSearch%3Aproject",
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
    expect(resolveQuickFindSubmission(pathname, "project", scopedFilters, "text")).toEqual({
      filters: [{ factor: "contentSearch", value: "project" }],
      destination: "/?filter=contentSearch%3Aproject",
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
