import { describe, expect, it } from "vitest";
import { buildMemoFilter } from "@/hooks/useMemoFilters";
import { combineCELFilters } from "@/lib/cel-filter";
import {
  BUILTIN_TASKS_VIEW_FILTER,
  BUILTIN_TASKS_VIEW_ID,
  getMemoScopePath,
  getMemoViewId,
  getProfileUsername,
  isMemoCollectionRoute,
  isMemoScopeRoute,
  resolveMemoScope,
} from "@/lib/memo-views";
import { Visibility } from "@/types/proto/api/v1/memo_service_pb";

describe("memo scopes", () => {
  it("resolves collection, profile, and detail routes", () => {
    expect(resolveMemoScope("/archived")).toBe("archived");
    expect(resolveMemoScope("/explore")).toBe("explore");
    expect(resolveMemoScope("/u/steven", { currentUsername: "steven" })).toBe("home");
    expect(resolveMemoScope("/u/maya", { currentUsername: "steven" })).toBe("explore");
    expect(resolveMemoScope("/memos/123", { detailFrom: "/archived?filter=tagSearch%3Awork" })).toBe("archived");
    expect(resolveMemoScope("/memos/123", { memoArchived: true })).toBe("archived");
    expect(resolveMemoScope("/settings", { fallback: "explore" })).toBe("explore");
  });

  it("maps collection routes while limiting primary scope paths to Home and Explore", () => {
    expect(isMemoScopeRoute("/")).toBe(true);
    expect(isMemoScopeRoute("/explore")).toBe(true);
    expect(isMemoScopeRoute("/archived")).toBe(true);
    expect(isMemoScopeRoute("/attachments")).toBe(false);
    expect(getMemoScopePath("home")).toBe("/");
    expect(getMemoScopePath("explore")).toBe("/explore");
  });

  it("treats user profiles as collection routes where views and filters apply in place", () => {
    expect(isMemoCollectionRoute("/")).toBe(true);
    expect(isMemoCollectionRoute("/archived")).toBe(true);
    expect(isMemoCollectionRoute("/u/steven")).toBe(true);
    expect(isMemoCollectionRoute("/u/steven/?view=map")).toBe(true);
    expect(isMemoCollectionRoute("/calendar")).toBe(true);
    expect(isMemoCollectionRoute("/Calendar/2026/08/02/")).toBe(true);
    expect(isMemoCollectionRoute("/calendars")).toBe(false);
    expect(getProfileUsername("/u/j%C3%BAlia/")).toBe("júlia");
    expect(getProfileUsername("/u/steven/memos")).toBeUndefined();
    expect(isMemoScopeRoute("/u/steven")).toBe(false);
    expect(isMemoCollectionRoute("/memos/123")).toBe(false);
    expect(isMemoCollectionRoute("/attachments")).toBe(false);
  });
});

describe("memo views", () => {
  it("keeps OR expressions inside the author, Space, view, and facet constraints", () => {
    const query = 'content.contains("plan") || pinned';
    const filter = buildMemoFilter({
      creatorName: "users/steven",
      selectedMemoViewFilter: "has_link || has_code",
      filters: [
        { factor: "celSearch", value: query },
        { factor: "tagSearch", value: "work" },
      ],
      includePinned: true,
    });
    expect(combineCELFilters('space == "spaces/product"', filter)).toBe(
      '(space == "spaces/product") && ((creator == "users/steven") && (has_link || has_code) && (content.contains("plan") || pinned) && (tag in ["work"]))',
    );
  });
  it("uses a collision-safe built-in Tasks view", () => {
    expect(BUILTIN_TASKS_VIEW_ID).not.toBe("tasks");
    expect(BUILTIN_TASKS_VIEW_FILTER).toBe("has_task_list && has_incomplete_tasks");
    expect(getMemoViewId("users/steven/views/work")).toBe("work");
  });

  it("composes Tasks with search, tags, creator, and visibility", () => {
    expect(
      buildMemoFilter({
        creatorName: "users/steven",
        currentMemoView: BUILTIN_TASKS_VIEW_ID,
        filters: [
          { factor: "contentSearch", value: "plan" },
          { factor: "tagSearch", value: "work" },
        ],
        includePinned: false,
        visibilities: [Visibility.PUBLIC],
      }),
    ).toBe(
      '(creator == "users/steven") && (has_task_list && has_incomplete_tasks) && (content.contains("plan")) && (tag in ["work"]) && (visibility in ["PUBLIC"])',
    );
  });

  it("maps the Space audience without falling back to Private", () => {
    expect(
      buildMemoFilter({
        filters: [],
        includePinned: false,
        visibilities: [Visibility.PUBLIC, Visibility.PROTECTED, Visibility.SPACE],
      }),
    ).toBe('(visibility in ["PUBLIC", "PROTECTED", "SPACE"])');
  });

  it("maps property filter factors to their CEL flags", () => {
    expect(
      buildMemoFilter({
        filters: [
          { factor: "property.hasLink", value: "" },
          { factor: "property.hasTaskList", value: "" },
          { factor: "property.hasCode", value: "" },
          { factor: "property.hasLocation", value: "" },
        ],
        includePinned: false,
      }),
    ).toBe("(has_link) && (has_task_list) && (has_code) && (has_location)");
  });

  it("uses a custom memo view filter when Tasks is not selected", () => {
    expect(
      buildMemoFilter({
        currentMemoView: "work",
        filters: [],
        includePinned: false,
        selectedMemoViewFilter: 'tag in ["work"]',
      }),
    ).toBe('(tag in ["work"])');
  });

  it("builds display-time filters from valid local calendar-day boundaries", () => {
    const start = new Date(2026, 7, 2);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    expect(
      buildMemoFilter({
        filters: [{ factor: "displayTime", value: "2026-08-02" }],
        includePinned: false,
      }),
    ).toBe(
      `(created_ts >= timestamp(${Math.floor(start.getTime() / 1000)}) && created_ts < timestamp(${Math.floor(end.getTime() / 1000)}))`,
    );
  });

  it("selects on update time when that is the basis", () => {
    const start = new Date(2026, 7, 2);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    expect(
      buildMemoFilter({
        filters: [{ factor: "displayTime", value: "2026-08-02" }],
        includePinned: false,
        timeBasis: "update_time",
      }),
    ).toBe(
      `(updated_ts >= timestamp(${Math.floor(start.getTime() / 1000)}) && updated_ts < timestamp(${Math.floor(end.getTime() / 1000)}))`,
    );
  });

  it("ignores invalid display-time filter values", () => {
    expect(
      buildMemoFilter({
        filters: [{ factor: "displayTime", value: "2026-02-30" }],
        includePinned: false,
      }),
    ).toBeUndefined();
  });
});
