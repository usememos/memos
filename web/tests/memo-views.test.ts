import { describe, expect, it } from "vitest";
import { buildMemoFilter } from "@/hooks/useMemoFilters";
import {
  BUILTIN_TASKS_VIEW_FILTER,
  BUILTIN_TASKS_VIEW_ID,
  getMemoScopePath,
  getShortcutId,
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

  it("maps only the three collection routes to memo scopes", () => {
    expect(isMemoScopeRoute("/")).toBe(true);
    expect(isMemoScopeRoute("/explore")).toBe(true);
    expect(isMemoScopeRoute("/archived")).toBe(true);
    expect(isMemoScopeRoute("/attachments")).toBe(false);
    expect(getMemoScopePath("home")).toBe("/");
    expect(getMemoScopePath("explore")).toBe("/explore");
    expect(getMemoScopePath("archived")).toBe("/archived");
  });
});

describe("memo views", () => {
  it("uses a collision-safe built-in Tasks view", () => {
    expect(BUILTIN_TASKS_VIEW_ID).not.toBe("tasks");
    expect(BUILTIN_TASKS_VIEW_FILTER).toBe("has_task_list && has_incomplete_tasks");
    expect(getShortcutId("users/steven/shortcuts/work")).toBe("work");
  });

  it("composes Tasks with search, tags, creator, and visibility", () => {
    expect(
      buildMemoFilter({
        creatorName: "users/steven",
        currentShortcut: BUILTIN_TASKS_VIEW_ID,
        filters: [
          { factor: "contentSearch", value: "plan" },
          { factor: "tagSearch", value: "work" },
        ],
        includePinned: false,
        visibilities: [Visibility.PUBLIC],
      }),
    ).toBe(
      'creator == "users/steven" && has_task_list && has_incomplete_tasks && content.contains("plan") && tag in ["work"] && visibility in ["PUBLIC"]',
    );
  });

  it("uses a custom shortcut filter when Tasks is not selected", () => {
    expect(
      buildMemoFilter({
        currentShortcut: "work",
        filters: [],
        includePinned: false,
        selectedShortcutFilter: 'tag in ["work"]',
      }),
    ).toBe('tag in ["work"]');
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
      `created_ts >= timestamp(${Math.floor(start.getTime() / 1000)}) && created_ts < timestamp(${Math.floor(end.getTime() / 1000)})`,
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
