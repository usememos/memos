import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { State } from "@/types/proto/api/v1/common_pb";
import type { ListMemosResponse, Memo } from "@/types/proto/api/v1/memo_service_pb";
import {
  memoKeys,
  extractListFiltersFromQueryKey,
  removeMemoFromListQueryData,
  patchMemoListQueryData,
  parseOrderBy,
  sortMemosByOrderBy,
  parseSimpleFilter,
  doesMemoMatchFilter,
  shouldMemoStayInQuery,
  evaluateMemoFilterChange,
} from "@/hooks/useMemoQueries";

function createTestMemo(overrides: Partial<Memo>): Memo {
  return {
    name: "memos/test",
    state: State.NORMAL,
    creator: "users/test",
    content: "",
    visibility: 2,
    tags: [],
    pinned: false,
    attachments: [],
    relations: [],
    reactions: [],
    snippet: "",
    createTime: { seconds: "1700000000", nanos: 0 },
    updateTime: { seconds: "1700000000", nanos: 0 },
    ...overrides,
  } as Memo;
}

function createTestListResponse(memos: Memo[]): ListMemosResponse {
  return {
    memos,
    nextPageToken: "",
  };
}

describe("useMemoQueries cache utilities", () => {
  describe("extractListFiltersFromQueryKey", () => {
    it("extracts filters from valid list query key", () => {
      const queryKey = memoKeys.list({ state: State.ARCHIVED, filter: "tag in [work]" });
      const filters = extractListFiltersFromQueryKey(queryKey);

      expect(filters).toEqual({
        state: State.ARCHIVED,
        filter: "tag in [work]",
      });
    });

    it("returns undefined for non-list query keys", () => {
      expect(extractListFiltersFromQueryKey(memoKeys.detail("memos/1"))).toBeUndefined();
      expect(extractListFiltersFromQueryKey(memoKeys.all)).toBeUndefined();
    });
  });

  describe("removeMemoFromListQueryData", () => {
    it("removes memo from ListMemosResponse", () => {
      const memo1 = createTestMemo({ name: "memos/1" });
      const memo2 = createTestMemo({ name: "memos/2" });
      const response = createTestListResponse([memo1, memo2]);

      const result = removeMemoFromListQueryData(response, "memos/1");

      expect(result?.memos).toHaveLength(1);
      expect(result?.memos[0].name).toBe("memos/2");
    });

    it("returns same reference if memo not found", () => {
      const memo = createTestMemo({ name: "memos/1" });
      const response = createTestListResponse([memo]);

      const result = removeMemoFromListQueryData(response, "memos/other");

      expect(result).toBe(response);
    });

    it("handles InfiniteData pagination", () => {
      const memo1 = createTestMemo({ name: "memos/1" });
      const memo2 = createTestMemo({ name: "memos/2" });
      const memo3 = createTestMemo({ name: "memos/3" });

      const infiniteData = {
        pages: [createTestListResponse([memo1, memo2]), createTestListResponse([memo3])],
        pageParams: ["", "token1"],
      };

      const result = removeMemoFromListQueryData(infiniteData, "memos/2");

      expect(result?.pages[0].memos).toHaveLength(1);
      expect(result?.pages[0].memos[0].name).toBe("memos/1");
      expect(result?.pages[1].memos).toHaveLength(1);
    });
  });

  describe("patchMemoListQueryData", () => {
    it("updates memo in ListMemosResponse", () => {
      const memo = createTestMemo({ name: "memos/1", content: "old content" });
      const response = createTestListResponse([memo]);

      const result = patchMemoListQueryData(response, { name: "memos/1", content: "new content" });

      expect(result?.memos[0].content).toBe("new content");
    });

    it("returns same reference if memo not found", () => {
      const memo = createTestMemo({ name: "memos/1" });
      const response = createTestListResponse([memo]);

      const result = patchMemoListQueryData(response, { name: "memos/other", content: "new" });

      expect(result).toBe(response);
    });
  });

  describe("parseOrderBy", () => {
    it("parses single order by clause", () => {
      const rules = parseOrderBy("create_time desc");

      expect(rules).toEqual([{ field: "create_time", direction: "desc" }]);
    });

    it("parses multiple order by clauses", () => {
      const rules = parseOrderBy("pinned desc, create_time desc");

      expect(rules).toEqual([
        { field: "pinned", direction: "desc" },
        { field: "create_time", direction: "desc" },
      ]);
    });

    it("defaults direction to desc", () => {
      const rules = parseOrderBy("create_time");

      expect(rules[0].direction).toBe("desc");
    });
  });

  describe("sortMemosByOrderBy", () => {
    it("sorts by pinned descending", () => {
      const memo1 = createTestMemo({ name: "memos/1", pinned: false });
      const memo2 = createTestMemo({ name: "memos/2", pinned: true });
      const memo3 = createTestMemo({ name: "memos/3", pinned: true });

      const sorted = sortMemosByOrderBy([memo1, memo2, memo3], "pinned desc");

      expect(sorted[0].pinned).toBe(true);
      expect(sorted[1].pinned).toBe(true);
      expect(sorted[2].pinned).toBe(false);
    });

    it("sorts by create_time descending", () => {
      const memo1 = createTestMemo({
        name: "memos/1",
        createTime: { seconds: "1700000001", nanos: 0 },
      });
      const memo2 = createTestMemo({
        name: "memos/2",
        createTime: { seconds: "1700000003", nanos: 0 },
      });
      const memo3 = createTestMemo({
        name: "memos/3",
        createTime: { seconds: "1700000002", nanos: 0 },
      });

      const sorted = sortMemosByOrderBy([memo1, memo2, memo3], "create_time desc");

      expect(sorted[0].name).toBe("memos/2");
      expect(sorted[1].name).toBe("memos/3");
      expect(sorted[2].name).toBe("memos/1");
    });

    it("sorts by pinned first, then create_time", () => {
      const memo1 = createTestMemo({
        name: "memos/1",
        pinned: true,
        createTime: { seconds: "1700000001", nanos: 0 },
      });
      const memo2 = createTestMemo({
        name: "memos/2",
        pinned: false,
        createTime: { seconds: "1700000003", nanos: 0 },
      });
      const memo3 = createTestMemo({
        name: "memos/3",
        pinned: true,
        createTime: { seconds: "1700000002", nanos: 0 },
      });

      const sorted = sortMemosByOrderBy([memo1, memo2, memo3], "pinned desc, create_time desc");

      expect(sorted[0].name).toBe("memos/3");
      expect(sorted[1].name).toBe("memos/1");
      expect(sorted[2].name).toBe("memos/2");
    });
  });

  describe("parseSimpleFilter", () => {
    it("parses tag in [tagName]", () => {
      const filters = parseSimpleFilter("tag in [work]");

      expect(filters).toEqual([{ type: "tag", value: "work", raw: "tag in [work]" }]);
    });

    it("parses tag in [\"tagName\"] with quotes", () => {
      const filters = parseSimpleFilter('tag in ["work"]');

      expect(filters[0].type).toBe("tag");
      expect(filters[0].value).toBe("work");
    });

    it("parses pinned filter", () => {
      const filters = parseSimpleFilter("pinned");

      expect(filters).toEqual([{ type: "pinned", raw: "pinned" }]);
    });

    it("parses has_link filter", () => {
      const filters = parseSimpleFilter("has_link");

      expect(filters[0].type).toBe("has_link");
    });

    it("parses has_task_list filter", () => {
      const filters = parseSimpleFilter("has_task_list");

      expect(filters[0].type).toBe("has_task_list");
    });

    it("parses has_code filter", () => {
      const filters = parseSimpleFilter("has_code");

      expect(filters[0].type).toBe("has_code");
    });

    it("parses content.contains(\"text\")", () => {
      const filters = parseSimpleFilter('content.contains("hello")');

      expect(filters[0].type).toBe("content_contains");
      expect(filters[0].value).toBe("hello");
    });

    it("parses multiple conditions with &&", () => {
      const filters = parseSimpleFilter('tag in [work] && content.contains("test")');

      expect(filters).toHaveLength(2);
      expect(filters[0].type).toBe("tag");
      expect(filters[1].type).toBe("content_contains");
    });

    it("marks unknown filters as unknown", () => {
      const filters = parseSimpleFilter('some_custom_expression && pinned');

      expect(filters[0].type).toBe("unknown");
      expect(filters[1].type).toBe("pinned");
    });
  });

  describe("doesMemoMatchFilter", () => {
    it("checks tag filter", () => {
      const memoWithTag = createTestMemo({ tags: ["work", "personal"] });
      const memoWithoutTag = createTestMemo({ tags: ["other"] });

      expect(doesMemoMatchFilter(memoWithTag, { type: "tag", value: "work", raw: "" })).toBe(true);
      expect(doesMemoMatchFilter(memoWithoutTag, { type: "tag", value: "work", raw: "" })).toBe(false);
    });

    it("checks pinned filter", () => {
      const pinnedMemo = createTestMemo({ pinned: true });
      const unpinnedMemo = createTestMemo({ pinned: false });

      expect(doesMemoMatchFilter(pinnedMemo, { type: "pinned", raw: "" })).toBe(true);
      expect(doesMemoMatchFilter(unpinnedMemo, { type: "pinned", raw: "" })).toBe(false);
    });

    it("checks content_contains filter", () => {
      const memo = createTestMemo({ content: "Hello World" });

      expect(doesMemoMatchFilter(memo, { type: "content_contains", value: "hello", raw: "" })).toBe(true);
      expect(doesMemoMatchFilter(memo, { type: "content_contains", value: "other", raw: "" })).toBe(false);
    });

    it("checks property filters", () => {
      const memoWithLink = createTestMemo({
        property: { hasLink: true, hasTaskList: false, hasCode: false, hasIncompleteTasks: false, title: "" },
      });
      const memoWithTaskList = createTestMemo({
        property: { hasLink: false, hasTaskList: true, hasCode: false, hasIncompleteTasks: false, title: "" },
      });
      const memoWithCode = createTestMemo({
        property: { hasLink: false, hasTaskList: false, hasCode: true, hasIncompleteTasks: false, title: "" },
      });

      expect(doesMemoMatchFilter(memoWithLink, { type: "has_link", raw: "" })).toBe(true);
      expect(doesMemoMatchFilter(memoWithTaskList, { type: "has_task_list", raw: "" })).toBe(true);
      expect(doesMemoMatchFilter(memoWithCode, { type: "has_code", raw: "" })).toBe(true);
    });

    it("returns undefined for unknown filters", () => {
      const memo = createTestMemo({});

      expect(doesMemoMatchFilter(memo, { type: "unknown", raw: "" })).toBeUndefined();
    });
  });

  describe("shouldMemoStayInQuery", () => {
    it("checks state filter", () => {
      const normalMemo = createTestMemo({ state: State.NORMAL });
      const archivedMemo = createTestMemo({ state: State.ARCHIVED });

      expect(shouldMemoStayInQuery(normalMemo, { state: State.NORMAL })).toBe(true);
      expect(shouldMemoStayInQuery(archivedMemo, { state: State.NORMAL })).toBe(false);
      expect(shouldMemoStayInQuery(normalMemo, { state: State.ARCHIVED })).toBe(false);
      expect(shouldMemoStayInQuery(archivedMemo, { state: State.ARCHIVED })).toBe(true);
    });

    it("defaults state to NORMAL when not specified", () => {
      const normalMemo = createTestMemo({ state: State.NORMAL });
      const archivedMemo = createTestMemo({ state: State.ARCHIVED });

      expect(shouldMemoStayInQuery(normalMemo, {})).toBe(true);
      expect(shouldMemoStayInQuery(archivedMemo, {})).toBe(false);
    });

    it("checks tag filter via filter string", () => {
      const memoWithTag = createTestMemo({ tags: ["work"] });
      const memoWithoutTag = createTestMemo({ tags: ["other"] });

      expect(shouldMemoStayInQuery(memoWithTag, { filter: "tag in [work]" })).toBe(true);
      expect(shouldMemoStayInQuery(memoWithoutTag, { filter: "tag in [work]" })).toBe(false);
    });

    it("checks pinned filter", () => {
      const pinnedMemo = createTestMemo({ pinned: true });
      const unpinnedMemo = createTestMemo({ pinned: false });

      expect(shouldMemoStayInQuery(pinnedMemo, { filter: "pinned" })).toBe(true);
      expect(shouldMemoStayInQuery(unpinnedMemo, { filter: "pinned" })).toBe(false);
    });

    it("returns undefined for filters containing unknown expressions", () => {
      const memo = createTestMemo({ tags: ["work"] });

      expect(shouldMemoStayInQuery(memo, { filter: 'visibility in ["PRIVATE"]' })).toBeUndefined();
    });
  });

  describe("evaluateMemoFilterChange", () => {
    it("returns canHandleLocally=false for unknown filters", () => {
      const memo = createTestMemo({});
      const result = evaluateMemoFilterChange(memo, { filter: 'visibility in ["PRIVATE"]' });

      expect(result.canHandleLocally).toBe(false);
    });

    it("returns canHandleLocally=true for tag filters", () => {
      const memo = createTestMemo({ tags: ["work"] });
      const result = evaluateMemoFilterChange(memo, { filter: "tag in [work]" });

      expect(result.canHandleLocally).toBe(true);
      expect(result.shouldStay).toBe(true);
    });

    it("returns shouldStay=false when memo no longer matches tag filter", () => {
      const memo = createTestMemo({ tags: ["other"] });
      const result = evaluateMemoFilterChange(memo, { filter: "tag in [work]" });

      expect(result.canHandleLocally).toBe(true);
      expect(result.shouldStay).toBe(false);
    });
  });
});

describe("useMemoQueries QueryClient integration", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
  });

  afterEach(() => {
    queryClient.clear();
  });

  describe("archive/restore scenarios", () => {
    it("archived memo should be removed from normal list cache", () => {
      const memo1 = createTestMemo({ name: "memos/1", state: State.NORMAL });
      const memo2 = createTestMemo({ name: "memos/2", state: State.NORMAL });

      queryClient.setQueryData(memoKeys.list({ state: State.NORMAL }), createTestListResponse([memo1, memo2]));

      const archivedMemo = { ...memo1, state: State.ARCHIVED } as Memo;

      const originalData = queryClient.getQueriesData({ queryKey: memoKeys.lists() });

      queryClient.setQueriesData(
        { queryKey: memoKeys.lists() },
        (data) => {
          const filters = extractListFiltersFromQueryKey(memoKeys.list({ state: State.NORMAL }));
          if (!filters) return data;

          const queryState = filters.state ?? State.NORMAL;

          if (memo1.state === queryState && archivedMemo.state !== queryState) {
            return removeMemoFromListQueryData(data, memo1.name);
          }

          return data;
        },
      );

      const updatedData = queryClient.getQueryData<ListMemosResponse>(memoKeys.list({ state: State.NORMAL }));

      expect(updatedData?.memos).toHaveLength(1);
      expect(updatedData?.memos[0].name).toBe("memos/2");
    });

    it("restored memo should be removed from archived list cache", () => {
      const archivedMemo = createTestMemo({ name: "memos/1", state: State.ARCHIVED });
      const anotherArchivedMemo = createTestMemo({ name: "memos/2", state: State.ARCHIVED });

      queryClient.setQueryData(
        memoKeys.list({ state: State.ARCHIVED }),
        createTestListResponse([archivedMemo, anotherArchivedMemo]),
      );

      const restoredMemo = { ...archivedMemo, state: State.NORMAL } as Memo;

      queryClient.setQueriesData(
        { queryKey: memoKeys.lists() },
        (data) => {
          const filters = extractListFiltersFromQueryKey(memoKeys.list({ state: State.ARCHIVED }));
          if (!filters) return data;

          const queryState = filters.state ?? State.NORMAL;

          if (archivedMemo.state === queryState && restoredMemo.state !== queryState) {
            return removeMemoFromListQueryData(data, archivedMemo.name);
          }

          return data;
        },
      );

      const updatedData = queryClient.getQueryData<ListMemosResponse>(memoKeys.list({ state: State.ARCHIVED }));

      expect(updatedData?.memos).toHaveLength(1);
      expect(updatedData?.memos[0].name).toBe("memos/2");
    });
  });

  describe("delete failure rollback", () => {
    it("should restore memo from snapshot after optimistic removal", () => {
      const memo = createTestMemo({ name: "memos/1", state: State.NORMAL });
      const queryKey = memoKeys.list({ state: State.NORMAL });

      queryClient.setQueryData(queryKey, createTestListResponse([memo]));

      const snapshot = queryClient.getQueriesData({ queryKey: memoKeys.all });

      queryClient.removeQueries({ queryKey: memoKeys.detail(memo.name) });
      queryClient.setQueriesData(
        { queryKey: memoKeys.all },
        (data) => removeMemoFromListQueryData(data, memo.name),
      );

      let listData = queryClient.getQueryData<ListMemosResponse>(queryKey);
      expect(listData?.memos).toHaveLength(0);

      for (const [key, data] of snapshot) {
        queryClient.setQueryData(key, data);
      }

      listData = queryClient.getQueryData<ListMemosResponse>(queryKey);
      expect(listData?.memos).toHaveLength(1);
      expect(listData?.memos[0].name).toBe("memos/1");
    });
  });

  describe("pinned reordering", () => {
    it("should reorder list when memo becomes pinned", () => {
      const memo1 = createTestMemo({
        name: "memos/1",
        pinned: false,
        createTime: { seconds: "1700000003", nanos: 0 },
      });
      const memo2 = createTestMemo({
        name: "memos/2",
        pinned: false,
        createTime: { seconds: "1700000002", nanos: 0 },
      });
      const memo3 = createTestMemo({
        name: "memos/3",
        pinned: false,
        createTime: { seconds: "1700000001", nanos: 0 },
      });

      const queryKey = memoKeys.list({ state: State.NORMAL, orderBy: "pinned desc, create_time desc" });
      queryClient.setQueryData(queryKey, createTestListResponse([memo1, memo2, memo3]));

      const updatedMemo2 = { ...memo2, pinned: true } as Memo;

      queryClient.setQueriesData(
        { queryKey: memoKeys.lists() },
        (data) => patchMemoListQueryData(data, updatedMemo2),
      );

      queryClient.setQueriesData(
        { queryKey: memoKeys.lists() },
        (data) => {
          const filters = { orderBy: "pinned desc, create_time desc" };
          if (filters.orderBy) {
            return sortMemosByOrderByWrapper(data, filters.orderBy);
          }
          return data;
        },
      );

      const updatedData = queryClient.getQueryData<ListMemosResponse>(queryKey);

      expect(updatedData?.memos[0].name).toBe("memos/2");
      expect(updatedData?.memos[0].pinned).toBe(true);
    });
  });

  describe("tag filter evaluation", () => {
    it("should detect memo no longer matches tag filter", () => {
      const memo1 = createTestMemo({ name: "memos/1", tags: ["work", "personal"] });

      const updatedMemo1 = { ...memo1, tags: ["work"] } as Memo;

      const evaluation = evaluateMemoFilterChange(
        updatedMemo1,
        { state: State.NORMAL, filter: "tag in [personal]" },
        memo1,
      );

      expect(evaluation.canHandleLocally).toBe(true);
      expect(evaluation.shouldStay).toBe(false);
    });

    it("should detect memo still matches tag filter", () => {
      const memo = createTestMemo({ name: "memos/1", tags: ["work", "personal"] });

      const updatedMemo = { ...memo, tags: ["work", "personal", "new"] } as Memo;

      const evaluation = evaluateMemoFilterChange(
        updatedMemo,
        { state: State.NORMAL, filter: "tag in [personal]" },
        memo,
      );

      expect(evaluation.canHandleLocally).toBe(true);
      expect(evaluation.shouldStay).toBe(true);
    });

    it("should NOT handle filters with unknown expressions", () => {
      const memo = createTestMemo({ name: "memos/1", tags: ["work"] });

      const evaluation = evaluateMemoFilterChange(
        memo,
        { state: State.NORMAL, filter: 'visibility in ["PRIVATE"]' },
        memo,
      );

      expect(evaluation.canHandleLocally).toBe(false);
    });

    it("should remove memo from cache when tags no longer match", () => {
      const memo1 = createTestMemo({ name: "memos/1", tags: ["work", "personal"] });
      const memo2 = createTestMemo({ name: "memos/2", tags: ["personal"] });

      const queryKey = memoKeys.list({ state: State.NORMAL, filter: "tag in [personal]" });
      queryClient.setQueryData(queryKey, createTestListResponse([memo1, memo2]));

      queryClient.setQueriesData(
        { queryKey: memoKeys.lists() },
        (data) => removeMemoFromListQueryData(data, "memos/1"),
      );

      const updatedData = queryClient.getQueryData<ListMemosResponse>(queryKey);

      expect(updatedData?.memos).toHaveLength(1);
      expect(updatedData?.memos[0].name).toBe("memos/2");
    });
  });
});

function sortMemosByOrderByWrapper<T>(data: T | undefined, orderBy: string): T | undefined {
  if (!data) return data;

  function isListResponse(d: unknown): d is ListMemosResponse {
    return typeof d === "object" && d !== null && Array.isArray((d as { memos?: unknown }).memos);
  }

  function isInfiniteData(d: unknown): d is { pages: ListMemosResponse[] } {
    return typeof d === "object" && d !== null && Array.isArray((d as { pages?: unknown }).pages);
  }

  if (isListResponse(data)) {
    const sortedMemos = sortMemosByOrderBy(data.memos, orderBy);
    return { ...data, memos: sortedMemos } as T;
  }

  if (isInfiniteData(data)) {
    const pages = data.pages.map((page) => ({
      ...page,
      memos: sortMemosByOrderBy(page.memos, orderBy),
    }));
    return { ...data, pages } as T;
  }

  return data;
}
