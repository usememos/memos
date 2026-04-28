import { create } from "@bufbuild/protobuf";
import { FieldMaskSchema } from "@bufbuild/protobuf/wkt";
import type { InfiniteData, QueryKey } from "@tanstack/react-query";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { memoServiceClient } from "@/connect";
import { userKeys } from "@/hooks/useUserQueries";
import { State } from "@/types/proto/api/v1/common_pb";
import type { ListMemosRequest, ListMemosResponse, Memo } from "@/types/proto/api/v1/memo_service_pb";
import { ListMemoCommentsRequestSchema, ListMemosRequestSchema, MemoSchema } from "@/types/proto/api/v1/memo_service_pb";

// Query keys factory for consistent cache management
export const memoKeys = {
  all: ["memos"] as const,
  lists: () => [...memoKeys.all, "list"] as const,
  list: (filters: Partial<ListMemosRequest>) => [...memoKeys.lists(), filters] as const,
  details: () => [...memoKeys.all, "detail"] as const,
  detail: (name: string) => [...memoKeys.details(), name] as const,
  comments: (name: string) => [...memoKeys.all, "comments", name] as const,
};

type MemoPatch = Partial<Memo> & Pick<Memo, "name">;
type MemoCollectionQueryData = ListMemosResponse | InfiniteData<ListMemosResponse>;
type QueryDataSnapshot = [QueryKey, MemoCollectionQueryData][];

export type UpdateType = "state" | "pinned" | "content" | "tags" | "other";

function isMemoListResponse(data: unknown): data is ListMemosResponse {
  return typeof data === "object" && data !== null && Array.isArray((data as { memos?: unknown }).memos);
}

function isInfiniteMemoListData(data: unknown): data is InfiniteData<ListMemosResponse> {
  return typeof data === "object" && data !== null && Array.isArray((data as { pages?: unknown }).pages);
}

function extractListFiltersFromQueryKey(queryKey: QueryKey): Partial<ListMemosRequest> | undefined {
  const listsKey = memoKeys.lists();
  if (queryKey.length <= listsKey.length) {
    return undefined;
  }
  for (let i = 0; i < listsKey.length; i++) {
    if (queryKey[i] !== listsKey[i]) {
      return undefined;
    }
  }
  const filters = queryKey[listsKey.length];
  if (typeof filters === "object" && filters !== null) {
    return filters as Partial<ListMemosRequest>;
  }
  return undefined;
}

function removeMemoFromListResponse(response: ListMemosResponse, memoName: string): ListMemosResponse {
  const originalLength = response.memos.length;
  const memos = response.memos.filter((memo) => memo.name !== memoName);
  if (memos.length === originalLength) {
    return response;
  }
  return { ...response, memos };
}

function removeMemoFromListQueryData<T>(data: T | undefined, memoName: string): T | undefined {
  if (!data) {
    return data;
  }

  if (isMemoListResponse(data)) {
    return removeMemoFromListResponse(data, memoName) as T;
  }

  if (isInfiniteMemoListData(data)) {
    let changed = false;
    const pages = data.pages.map((page) => {
      const filteredPage = removeMemoFromListResponse(page, memoName);
      if (filteredPage !== page) {
        changed = true;
      }
      return filteredPage;
    });

    return (changed ? { ...data, pages } : data) as T;
  }

  return data;
}

function patchMemoListResponse(response: ListMemosResponse, update: MemoPatch): ListMemosResponse {
  let changed = false;
  const memos = response.memos.map((memo) => {
    if (memo.name !== update.name) {
      return memo;
    }

    changed = true;
    return { ...memo, ...update };
  });

  return changed ? { ...response, memos } : response;
}

function patchMemoListQueryData<T>(data: T | undefined, update: MemoPatch): T | undefined {
  if (!data) {
    return data;
  }

  if (isMemoListResponse(data)) {
    return patchMemoListResponse(data, update) as T;
  }

  if (isInfiniteMemoListData(data)) {
    let changed = false;
    const pages = data.pages.map((page) => {
      const patchedPage = patchMemoListResponse(page, update);
      if (patchedPage !== page) {
        changed = true;
      }
      return patchedPage;
    });

    return (changed ? { ...data, pages } : data) as T;
  }

  return data;
}

function findMemoInListResponse(response: ListMemosResponse, name: string): Memo | undefined {
  return response.memos.find((memo) => memo.name === name);
}

function findMemoInQueryData(data: unknown, name: string): Memo | undefined {
  if (!data) {
    return undefined;
  }

  if (isMemoListResponse(data)) {
    return findMemoInListResponse(data, name);
  }

  if (isInfiniteMemoListData(data)) {
    for (const page of data.pages) {
      const memo = findMemoInListResponse(page, name);
      if (memo) {
        return memo;
      }
    }
  }

  return undefined;
}

function findMemoInCollectionQueries(queryClient: ReturnType<typeof useQueryClient>, name: string): Memo | undefined {
  for (const [, data] of queryClient.getQueriesData<unknown>({ queryKey: memoKeys.all })) {
    const memo = findMemoInQueryData(data, name);
    if (memo) {
      return memo;
    }
  }

  return undefined;
}

function patchMemoInCollectionQueries(queryClient: ReturnType<typeof useQueryClient>, update: MemoPatch) {
  queryClient.setQueriesData<MemoCollectionQueryData>({ queryKey: memoKeys.all }, (data) => patchMemoListQueryData(data, update));
}

function removeMemoFromCollectionQueries(queryClient: ReturnType<typeof useQueryClient>, memoName: string) {
  queryClient.setQueriesData<MemoCollectionQueryData>(
    { queryKey: memoKeys.all },
    (data) => removeMemoFromListQueryData(data, memoName),
  );
}

function restoreQueriesSnapshot(queryClient: ReturnType<typeof useQueryClient>, snapshot: QueryDataSnapshot) {
  for (const [queryKey, data] of snapshot) {
    queryClient.setQueryData(queryKey, data);
  }
}

export interface OrderByRule {
  field: string;
  direction: "asc" | "desc";
}

export function parseOrderBy(orderBy: string): OrderByRule[] {
  const rules: OrderByRule[] = [];
  const parts = orderBy.split(",").map((s) => s.trim());

  for (const part of parts) {
    const tokens = part.split(/\s+/);
    const field = tokens[0] || "create_time";
    const direction = tokens[1]?.toLowerCase() === "asc" ? "asc" : "desc";
    rules.push({ field, direction });
  }

  return rules;
}

function getMemoSortValue(memo: Memo, field: string): number | string | boolean {
  if (field === "pinned") {
    return memo.pinned;
  }
  if (field === "create_time") {
    return memo.createTime?.seconds?.toString() || "";
  }
  if (field === "update_time") {
    return memo.updateTime?.seconds?.toString() || "";
  }
  return (memo as Record<string, unknown>)[field] as number | string | boolean;
}

function sortMemosByOrderBy(memos: Memo[], orderBy: string): Memo[] {
  const rules = parseOrderBy(orderBy);
  if (rules.length === 0) {
    return memos;
  }

  return [...memos].sort((a, b) => {
    for (const rule of rules) {
      const valA = getMemoSortValue(a, rule.field);
      const valB = getMemoSortValue(b, rule.field);

      let comparison = 0;
      if (typeof valA === "boolean" && typeof valB === "boolean") {
        comparison = valA === valB ? 0 : valA ? 1 : -1;
      } else if (typeof valA === "number" && typeof valB === "number") {
        comparison = valA - valB;
      } else {
        comparison = String(valA).localeCompare(String(valB));
      }

      if (comparison !== 0) {
        return rule.direction === "asc" ? comparison : -comparison;
      }
    }
    return 0;
  });
}

function reorderMemoListResponse(response: ListMemosResponse, orderBy: string): ListMemosResponse {
  const sortedMemos = sortMemosByOrderBy(response.memos, orderBy);
  if (sortedMemos === response.memos) {
    return response;
  }
  return { ...response, memos: sortedMemos };
}

function reorderMemoListQueryData<T>(data: T | undefined, orderBy: string): T | undefined {
  if (!data) {
    return data;
  }

  if (isMemoListResponse(data)) {
    return reorderMemoListResponse(data, orderBy) as T;
  }

  if (isInfiniteMemoListData(data)) {
    let changed = false;
    const pages = data.pages.map((page) => {
      const reorderedPage = reorderMemoListResponse(page, orderBy);
      if (reorderedPage !== page) {
        changed = true;
      }
      return reorderedPage;
    });

    return (changed ? { ...data, pages } : data) as T;
  }

  return data;
}

export interface SimpleFilter {
  type: "tag" | "pinned" | "has_link" | "has_task_list" | "has_code" | "content_contains" | "unknown";
  value?: string;
  raw: string;
}

export function parseSimpleFilter(filter: string): SimpleFilter[] {
  const results: SimpleFilter[] = [];
  const conditions = filter.split(/\s*&&\s*/);

  for (const condition of conditions) {
    const trimmed = condition.trim();

    const tagMatch = trimmed.match(/^tag\s+in\s+\[\s*"?([^"\]]+?)"?\s*\]$/i);
    if (tagMatch) {
      results.push({ type: "tag", value: tagMatch[1], raw: trimmed });
      continue;
    }

    if (trimmed.toLowerCase() === "pinned") {
      results.push({ type: "pinned", raw: trimmed });
      continue;
    }
    if (trimmed.toLowerCase() === "has_link") {
      results.push({ type: "has_link", raw: trimmed });
      continue;
    }
    if (trimmed.toLowerCase() === "has_task_list") {
      results.push({ type: "has_task_list", raw: trimmed });
      continue;
    }
    if (trimmed.toLowerCase() === "has_code") {
      results.push({ type: "has_code", raw: trimmed });
      continue;
    }

    const contentMatch = trimmed.match(/^content\.contains\s*\(\s*"?([^"]+?)"?\s*\)$/i);
    if (contentMatch) {
      results.push({ type: "content_contains", value: contentMatch[1], raw: trimmed });
      continue;
    }

    results.push({ type: "unknown", raw: trimmed });
  }

  return results;
}

export function doesMemoMatchFilter(memo: Memo, filter: SimpleFilter): boolean | undefined {
  switch (filter.type) {
    case "tag":
      if (!filter.value) return undefined;
      return memo.tags.includes(filter.value);

    case "pinned":
      return memo.pinned === true;

    case "has_link":
      return memo.property?.hasLink === true;

    case "has_task_list":
      return memo.property?.hasTaskList === true;

    case "has_code":
      return memo.property?.hasCode === true;

    case "content_contains":
      if (!filter.value) return undefined;
      return memo.content.toLowerCase().includes(filter.value.toLowerCase());

    case "unknown":
      return undefined;

    default:
      return undefined;
  }
}

export function shouldMemoStayInQuery(
  memo: Memo,
  filters: Partial<ListMemosRequest>,
  previousMemo?: Memo,
): boolean | undefined {
  if (filters.state !== undefined) {
    if (memo.state !== filters.state) {
      return false;
    }
  } else {
    if (memo.state !== State.NORMAL) {
      return false;
    }
  }

  if (filters.filter) {
    const simpleFilters = parseSimpleFilter(filters.filter);
    for (const sf of simpleFilters) {
      const matches = doesMemoMatchFilter(memo, sf);
      if (matches === false) {
        return false;
      }
      if (matches === undefined) {
        return undefined;
      }
    }
  }

  return true;
}

function filterMemoFromCollectionQueriesByState(
  queryClient: ReturnType<typeof useQueryClient>,
  memo: Memo,
  previousState?: State,
) {
  const currentState = memo.state;
  const queriesData = queryClient.getQueriesData<MemoCollectionQueryData>({ queryKey: memoKeys.lists() });

  for (const [queryKey, data] of queriesData) {
    const filters = extractListFiltersFromQueryKey(queryKey);
    if (!filters) {
      continue;
    }

    const queryState = filters.state ?? State.NORMAL;

    if (previousState !== undefined && previousState === queryState && currentState !== queryState) {
      const updatedData = removeMemoFromListQueryData(data, memo.name);
      if (updatedData !== data) {
        queryClient.setQueryData(queryKey, updatedData);
      }
      continue;
    }

    if (currentState === queryState) {
      const updatedData = patchMemoListQueryData(data, memo);
      if (updatedData !== data) {
        queryClient.setQueryData(queryKey, updatedData);
      }
    }
  }
}

export type FilterEvaluation = {
  canHandleLocally: boolean;
  shouldStay: boolean;
};

export function evaluateMemoFilterChange(
  memo: Memo,
  filters: Partial<ListMemosRequest>,
  previousMemo?: Memo,
): FilterEvaluation {
  const result = shouldMemoStayInQuery(memo, filters, previousMemo);
  if (result === undefined) {
    return { canHandleLocally: false, shouldStay: true };
  }
  return { canHandleLocally: true, shouldStay: result };
}

function handleOptimisticUpdateForFilter(
  queryClient: ReturnType<typeof useQueryClient>,
  updatedMemo: Memo,
  previousMemo?: Memo,
) {
  const queriesData = queryClient.getQueriesData<MemoCollectionQueryData>({ queryKey: memoKeys.lists() });

  for (const [queryKey, data] of queriesData) {
    const filters = extractListFiltersFromQueryKey(queryKey);
    if (!filters) {
      continue;
    }

    const evaluation = evaluateMemoFilterChange(updatedMemo, filters, previousMemo);

    if (evaluation.canHandleLocally) {
      if (!evaluation.shouldStay) {
        const updatedData = removeMemoFromListQueryData(data, updatedMemo.name);
        if (updatedData !== data) {
          queryClient.setQueryData(queryKey, updatedData);
        }
      } else {
        const updatedData = patchMemoListQueryData(data, updatedMemo);
        if (updatedData !== data) {
          queryClient.setQueryData(queryKey, updatedData);
        }
      }
    }
  }
}

function reorderMemoInCollectionQueries(queryClient: ReturnType<typeof useQueryClient>) {
  const queriesData = queryClient.getQueriesData<MemoCollectionQueryData>({ queryKey: memoKeys.lists() });

  for (const [queryKey, data] of queriesData) {
    const filters = extractListFiltersFromQueryKey(queryKey);
    if (!filters || !filters.orderBy) {
      continue;
    }

    const updatedData = reorderMemoListQueryData(data, filters.orderBy);
    if (updatedData !== data) {
      queryClient.setQueryData(queryKey, updatedData);
    }
  }
}

function determineUpdateTypes(updateMask: string[]): UpdateType[] {
  const types: UpdateType[] = [];

  for (const path of updateMask) {
    if (path === "state") {
      types.push("state");
    } else if (path === "pinned") {
      types.push("pinned");
    } else if (path === "content") {
      types.push("content");
      types.push("tags");
    } else if (!types.includes("other")) {
      types.push("other");
    }
  }

  return types.length > 0 ? types : ["other"];
}

export function useMemos(request: Partial<ListMemosRequest> = {}) {
  return useQuery({
    queryKey: memoKeys.list(request),
    queryFn: async () => {
      const response = await memoServiceClient.listMemos(create(ListMemosRequestSchema, request as Record<string, unknown>));
      return response;
    },
  });
}

export function useInfiniteMemos(request: Partial<ListMemosRequest> = {}, options?: { enabled?: boolean }) {
  return useInfiniteQuery({
    queryKey: memoKeys.list(request),
    queryFn: async ({ pageParam }) => {
      const response = await memoServiceClient.listMemos(
        create(ListMemosRequestSchema, {
          ...request,
          pageToken: pageParam || "",
        } as Record<string, unknown>),
      );
      return response;
    },
    initialPageParam: "",
    getNextPageParam: (lastPage) => lastPage.nextPageToken || undefined,
    staleTime: 1000 * 60,
    gcTime: 1000 * 60 * 5,
    enabled: options?.enabled ?? true,
  });
}

export function useMemo(name: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: memoKeys.detail(name),
    queryFn: async () => {
      const memo = await memoServiceClient.getMemo({ name });
      return memo;
    },
    enabled: options?.enabled ?? true,
    staleTime: 1000 * 10,
  });
}

export function useCreateMemo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (memoToCreate: Memo) => {
      const memo = await memoServiceClient.createMemo({ memo: memoToCreate });
      return memo;
    },
    onSuccess: (newMemo) => {
      queryClient.invalidateQueries({ queryKey: memoKeys.lists() });
      queryClient.setQueryData(memoKeys.detail(newMemo.name), newMemo);
      queryClient.invalidateQueries({ queryKey: userKeys.stats() });
    },
  });
}

export function useUpdateMemo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ update, updateMask }: { update: Partial<Memo>; updateMask: string[] }) => {
      const memo = await memoServiceClient.updateMemo({
        memo: create(MemoSchema, update as Record<string, unknown>),
        updateMask: create(FieldMaskSchema, { paths: updateMask }),
      });
      return memo;
    },
    onMutate: async ({ update, updateMask }) => {
      if (!update.name) {
        return { previousMemo: undefined, updateTypes: [] as UpdateType[], queriesSnapshot: [] as QueryDataSnapshot };
      }

      const updateTypes = determineUpdateTypes(updateMask);

      await queryClient.cancelQueries({ queryKey: memoKeys.all });

      const previousMemo =
        queryClient.getQueryData<Memo>(memoKeys.detail(update.name)) || findMemoInCollectionQueries(queryClient, update.name);

      const queriesSnapshot = queryClient.getQueriesData<MemoCollectionQueryData>({ queryKey: memoKeys.all });

      const memoPatch: MemoPatch = { ...update, name: update.name };

      if (previousMemo) {
        queryClient.setQueryData(memoKeys.detail(update.name), { ...previousMemo, ...memoPatch });
      }

      const updatedMemo = previousMemo ? ({ ...previousMemo, ...memoPatch } as Memo) : undefined;

      if (updateTypes.includes("state") && updatedMemo) {
        filterMemoFromCollectionQueriesByState(queryClient, updatedMemo, previousMemo?.state);
      } else if ((updateTypes.includes("content") || updateTypes.includes("tags")) && updatedMemo) {
        handleOptimisticUpdateForFilter(queryClient, updatedMemo, previousMemo);
      } else if (updateTypes.includes("pinned")) {
        patchMemoInCollectionQueries(queryClient, memoPatch);
        reorderMemoInCollectionQueries(queryClient);
      } else {
        patchMemoInCollectionQueries(queryClient, memoPatch);
      }

      return { previousMemo, updateTypes, queriesSnapshot };
    },
    onError: (_err, { update }, context) => {
      if (context?.queriesSnapshot && context.queriesSnapshot.length > 0) {
        restoreQueriesSnapshot(queryClient, context.queriesSnapshot);
      } else if (context?.previousMemo && update.name) {
        queryClient.setQueryData(memoKeys.detail(update.name), context.previousMemo);
        patchMemoInCollectionQueries(queryClient, context.previousMemo);
      } else {
        queryClient.invalidateQueries({ queryKey: memoKeys.all });
      }
    },
    onSuccess: (updatedMemo, _variables, context) => {
      const updateTypes = context?.updateTypes || [];

      queryClient.setQueryData(memoKeys.detail(updatedMemo.name), updatedMemo);

      if (updateTypes.includes("state")) {
        filterMemoFromCollectionQueriesByState(queryClient, updatedMemo);
      } else if (updateTypes.includes("content") || updateTypes.includes("tags")) {
        handleOptimisticUpdateForFilter(queryClient, updatedMemo);
      } else if (updateTypes.includes("pinned")) {
        patchMemoInCollectionQueries(queryClient, updatedMemo);
        reorderMemoInCollectionQueries(queryClient);
      } else {
        patchMemoInCollectionQueries(queryClient, updatedMemo);
      }

      const shouldInvalidateLists =
        updateTypes.includes("other") ||
        updateTypes.length === 0 ||
        (updateTypes.includes("pinned") && true) ||
        (updateTypes.includes("content") && true) ||
        (updateTypes.includes("tags") && true);

      if (shouldInvalidateLists) {
        queryClient.invalidateQueries({ queryKey: memoKeys.lists() });
      }

      if (updatedMemo.parent) {
        queryClient.invalidateQueries({ queryKey: memoKeys.comments(updatedMemo.parent) });
      }

      queryClient.invalidateQueries({ queryKey: userKeys.stats() });
    },
  });
}

export function useDeleteMemo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (name: string) => {
      await memoServiceClient.deleteMemo({ name });
      return name;
    },
    onMutate: async (name: string) => {
      await queryClient.cancelQueries({ queryKey: memoKeys.all });

      const previousMemo =
        queryClient.getQueryData<Memo>(memoKeys.detail(name)) || findMemoInCollectionQueries(queryClient, name);

      const queriesSnapshot = queryClient.getQueriesData<MemoCollectionQueryData>({ queryKey: memoKeys.all });

      queryClient.removeQueries({ queryKey: memoKeys.detail(name) });
      removeMemoFromCollectionQueries(queryClient, name);

      return { previousMemo, queriesSnapshot };
    },
    onError: (_err, _name, context) => {
      if (context?.queriesSnapshot && context.queriesSnapshot.length > 0) {
        restoreQueriesSnapshot(queryClient, context.queriesSnapshot);
      } else if (context?.previousMemo) {
        queryClient.setQueryData(memoKeys.detail(context.previousMemo.name), context.previousMemo);
        patchMemoInCollectionQueries(queryClient, context.previousMemo);
      } else {
        queryClient.invalidateQueries({ queryKey: memoKeys.all });
      }
    },
    onSuccess: (name) => {
      queryClient.removeQueries({ queryKey: memoKeys.detail(name) });
      queryClient.invalidateQueries({ queryKey: memoKeys.lists() });
      queryClient.invalidateQueries({ queryKey: userKeys.stats() });
    },
  });
}

export function useMemoComments(name: string, options?: { enabled?: boolean; pageSize?: number }) {
  return useQuery({
    queryKey: [...memoKeys.comments(name), options?.pageSize ?? 0],
    queryFn: async () => {
      const response = await memoServiceClient.listMemoComments(
        create(ListMemoCommentsRequestSchema, {
          name,
          pageSize: options?.pageSize ?? 0,
        }),
      );
      return response;
    },
    enabled: options?.enabled ?? true,
    staleTime: 1000 * 60,
  });
}

export {
  extractListFiltersFromQueryKey,
  removeMemoFromListQueryData,
  patchMemoListQueryData,
  findMemoInCollectionQueries,
  patchMemoInCollectionQueries,
  removeMemoFromCollectionQueries,
  filterMemoFromCollectionQueriesByState,
  sortMemosByOrderBy,
};
