import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MemoFilter } from "@/contexts/MemoFilterContext";
import { useMemoSuggestions } from "@/hooks/useMemoSuggestions";
import { BUILTIN_TASKS_VIEW_ID } from "@/lib/memo-views";

const mocks = vi.hoisted(() => ({
  filters: [] as MemoFilter[],
  memoView: undefined as string | undefined,
  views: [] as { name: string; filter: string }[],
}));
vi.mock("@/contexts/MemoFilterContext", () => ({ useMemoFilterContext: () => mocks }));
vi.mock("@/hooks/useCurrentUser", () => ({ default: () => ({ name: "users/me" }) }));
vi.mock("@/hooks/useUserQueries", () => ({ useMemoViews: () => ({ data: mocks.views }) }));

describe("useMemoSuggestions", () => {
  beforeEach(() => {
    mocks.filters = [];
    mocks.memoView = undefined;
    mocks.views = [];
  });

  it("suggests a checklist in the built-in Tasks View", () => {
    mocks.memoView = BUILTIN_TASKS_VIEW_ID;
    const { result } = renderHook(() => useMemoSuggestions());
    expect(result.current).toEqual([{ id: "checklist", kind: "checklist", source: "view" }]);
  });

  it("resolves the selected View and reacts to filters, selection, and query loading", () => {
    mocks.memoView = "work";
    const { result, rerender } = renderHook(() => useMemoSuggestions());
    expect(result.current).toEqual([]);
    mocks.views = [{ name: "users/me/views/work", filter: '"work" in tags' }];
    rerender();
    expect(result.current.map((suggestion) => suggestion.id)).toEqual(["tag:work"]);
    mocks.filters = [
      { factor: "tagSearch", value: "release" },
      { factor: "celSearch", value: '"planning" in tags' },
    ];
    rerender();
    expect(result.current.map((suggestion) => suggestion.id)).toEqual(["tag:release", "tag:planning", "tag:work"]);
    mocks.memoView = undefined;
    rerender();
    expect(result.current.map((suggestion) => suggestion.id)).toEqual(["tag:release", "tag:planning"]);
  });
});
