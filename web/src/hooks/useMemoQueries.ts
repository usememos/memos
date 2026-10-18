import { create } from "@bufbuild/protobuf";
import { FieldMaskSchema } from "@bufbuild/protobuf/wkt";
import { Code, ConnectError } from "@connectrpc/connect";
import {
  type InfiniteData,
  type QueryClient,
  queryOptions,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useCallback, useSyncExternalStore } from "react";
import { memoServiceClient } from "@/connect";
import { attachmentKeys } from "@/hooks/useAttachmentQueries";
import { memoShareKeys } from "@/hooks/useMemoShareQueries";
import { userKeys } from "@/hooks/useUserQueries";
import { DEFAULT_LIST_MEMOS_PAGE_SIZE } from "@/lib/constants";
import { shouldRetry } from "@/lib/query-client";
import type { ListMemosRequest, ListMemosResponse, Memo } from "@/types/proto/api/memo_service_pb";
import { ListMemoCommentsRequestSchema, ListMemosRequestSchema, MemoSchema } from "@/types/proto/api/memo_service_pb";

// Query keys factory for consistent cache management
export const memoKeys = {
  all: ["memos"] as const,
  lists: () => [...memoKeys.all, "list"] as const,
  list: (filters: Partial<ListMemosRequest>) => [...memoKeys.lists(), filters] as const,
  details: () => [...memoKeys.all, "detail"] as const,
  detail: (name: string) => [...memoKeys.details(), name] as const,
  comments: (name: string) => [...memoKeys.all, "comments", name] as const,
  linkMetadata: (url: string) => [...memoKeys.all, "linkMetadata", url] as const,
};

export const memoDetailQueryOptions = (name: string) =>
  queryOptions({
    queryKey: memoKeys.detail(name),
    queryFn: async ({ client, signal }) => {
      try {
        return await memoServiceClient.getMemo({ name }, { signal });
      } catch (error) {
        if (!isMemoUnavailableError(error)) throw error;
        // Store a content-free result, replacing any formerly readable detail.
        // Remove copies and snippets so collection fallbacks cannot revive them.
        discardUnavailableMemo(client, name);
        return null;
      }
    },
    retry: shouldRetry,
    staleTime: 1000 * 10,
    // A previous denial cannot establish access on a new visit, even while fresh.
    refetchOnMount: (query) => (query.state.data === null ? "always" : true),
  });

export function isMemoUnavailableError(error: unknown): boolean {
  return error instanceof ConnectError && (error.code === Code.PermissionDenied || error.code === Code.NotFound);
}

function discardUnavailableMemo(client: QueryClient, name: string) {
  const stripRelations = (memo: Memo): Memo => {
    const relations = memo.relations.filter((relation) => relation.memo?.name !== name && relation.relatedMemo?.name !== name);
    return relations.length === memo.relations.length ? memo : { ...memo, relations };
  };
  for (const [key, data] of client.getQueriesData<unknown>({ queryKey: memoKeys.all })) {
    let next: unknown;
    if (isMemo(data)) next = data.name === name ? data : stripRelations(data);
    else next = mapMemoCollection(data, (memos) => filterMemos(memos, (memo) => memo.name !== name, stripRelations));
    if (next !== data) client.setQueryData(key, next);
  }
}

type MemoPatch = Partial<Memo> & Pick<Memo, "name">;

// The shapes a memo query holds: a memo list response (`memos`), a comment list
// response (`comments`), a bare array (the calendar month), the infinite-query
// pages of either response, or one memo (a detail or a shared memo).

function isMemo(data: unknown): data is Memo {
  return typeof data === "object" && data !== null && typeof (data as { name?: unknown }).name === "string" && "content" in data;
}

function isMemoListResponse(data: unknown): data is ListMemosResponse {
  return typeof data === "object" && data !== null && Array.isArray((data as { memos?: unknown }).memos);
}

function isMemoCommentsResponse(data: unknown): data is { comments: Memo[] } {
  return typeof data === "object" && data !== null && Array.isArray((data as { comments?: unknown }).comments);
}

function isInfiniteData(data: unknown): data is InfiniteData<unknown> {
  return typeof data === "object" && data !== null && Array.isArray((data as { pages?: unknown }).pages);
}

function memosOfPage(page: unknown): Memo[] | undefined {
  if (Array.isArray(page)) return page as Memo[];
  if (isMemoListResponse(page)) return page.memos;
  if (isMemoCommentsResponse(page)) return page.comments;
  return undefined;
}

/** Replaces a page's memos, keeping the page's reference when the memos did not change. */
function withMemos<T>(page: T, memos: Memo[]): T {
  if (memosOfPage(page) === memos) return page;
  if (Array.isArray(page)) return memos as T;
  if (isMemoListResponse(page)) return { ...page, memos } as T;
  return { ...(page as object), comments: memos } as T;
}

/** Maps every page of memos in a collection query, keeping references where nothing changed. */
function mapMemoCollection<T>(data: T, map: (memos: Memo[]) => Memo[]): T {
  if (isInfiniteData(data)) {
    const pages = data.pages.map((page) => mapMemoCollection(page, map));
    return pages.some((page, index) => page !== data.pages[index]) ? ({ ...data, pages } as T) : data;
  }
  const memos = memosOfPage(data);
  return memos ? withMemos(data, map(memos)) : data;
}

function filterMemos(memos: Memo[], keep: (memo: Memo) => boolean, map: (memo: Memo) => Memo = (memo) => memo): Memo[] {
  const next = memos.filter(keep).map(map);
  return next.length === memos.length && next.every((memo, index) => memo === memos[index]) ? memos : next;
}

function patchMemos(memos: Memo[], update: MemoPatch): Memo[] {
  let changed = false;
  const next = memos.map((memo) => {
    if (memo.name !== update.name) return memo;
    changed = true;
    return { ...memo, ...update };
  });
  return changed ? next : memos;
}

function* memosInQueryData(data: unknown): Generator<Memo> {
  if (isMemo(data)) {
    yield data;
    return;
  }
  const pages = isInfiniteData(data) ? data.pages : [data];
  for (const page of pages) {
    const memos = memosOfPage(page);
    if (memos) yield* memos;
  }
}

function findMemoInQueryData(data: unknown, name: string): Memo | undefined {
  for (const memo of memosInQueryData(data)) {
    if (memo.name === name) return memo;
  }
  return undefined;
}

/** The query roots that hold memos: the memo queries, and shared memos under their tokens. */
const MEMO_QUERY_ROOTS = [memoKeys.all, memoShareKeys.all] as const;

/**
 * Looks a memo up by name in the collections already fetched (lists, comments,
 * the calendar month): a seed for a detail query that would otherwise refetch
 * a memo the page already shows. A detail cached as unavailable (`null`) wins.
 */
export function findMemoInCollectionQueries(queryClient: QueryClient, name: string, freshOnly = false): Memo | undefined {
  if (queryClient.getQueryData(memoKeys.detail(name)) === null) return undefined;
  for (const [key, data] of queryClient.getQueriesData<unknown>({ queryKey: memoKeys.all })) {
    if (isMemo(data)) continue;
    const state = queryClient.getQueryState(key);
    if (freshOnly && (!state || state.isInvalidated || state.dataUpdatedAt < Date.now() - 10_000)) continue;
    const memo = findMemoInQueryData(data, name);
    if (memo) return memo;
  }
  return undefined;
}

/**
 * The freshest copy of a memo any query holds, by name: a detail, a shared memo, or
 * an entry in a list, comment page or month. `null` when a detail query recorded it as
 * unavailable, `undefined` when no query holds it.
 */
export function findMemoRecord(queryClient: QueryClient, name: string): Memo | null | undefined {
  if (queryClient.getQueryData(memoKeys.detail(name)) === null) return null;
  let found: Memo | undefined;
  let foundAt = -1;
  for (const root of MEMO_QUERY_ROOTS) {
    for (const query of queryClient.getQueryCache().findAll({ queryKey: root })) {
      if (query.state.dataUpdatedAt <= foundAt) continue;
      const memo = findMemoInQueryData(query.state.data, name);
      if (memo) {
        found = memo;
        foundAt = query.state.dataUpdatedAt;
      }
    }
  }
  return found;
}

function patchMemoInCollectionQueries(queryClient: QueryClient, update: MemoPatch) {
  queryClient.setQueriesData<unknown>({ queryKey: memoKeys.all }, (data: unknown) =>
    isMemo(data) ? data : mapMemoCollection(data, (memos) => patchMemos(memos, update)),
  );
}

/**
 * A memo by name, read from whatever query already holds it, with no request of its
 * own: a card in a list reads the list's copy and follows the list's refetches and the
 * mutations' optimistic patches. Returns `null` for a memo recorded as unavailable and
 * `undefined` for one no query holds.
 */
export function useMemoRecord(name: string): Memo | null | undefined {
  const queryClient = useQueryClient();
  const subscribe = useCallback(
    (onChange: () => void) =>
      queryClient.getQueryCache().subscribe((event) => {
        const root = event.query.queryKey[0];
        if (MEMO_QUERY_ROOTS.some((key) => key[0] === root)) onChange();
      }),
    [queryClient],
  );
  const getSnapshot = useCallback(() => findMemoRecord(queryClient, name), [queryClient, name]);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/**
 * A memo by name for a surface that shows it: the copy a query already holds, or else
 * one fetch of the detail. Unlike `useMemo`, it never refetches on its own, so a list
 * of cards costs no requests beyond the list's.
 */
export function useMemoByName(name: string, options?: { enabled?: boolean }) {
  const record = useMemoRecord(name);
  const query = useQuery({
    ...memoDetailQueryOptions(name),
    enabled: (options?.enabled ?? true) && record === undefined,
  });
  const data = record ?? undefined;
  return {
    data,
    isUnavailable: record === null,
    isLoading: record === undefined && query.isLoading,
    error: record === undefined ? query.error : null,
  };
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
    queryFn: async ({ pageParam, signal }) => {
      const response = await memoServiceClient.listMemos(
        create(ListMemosRequestSchema, {
          ...request,
          pageToken: pageParam || "",
        } as Record<string, unknown>),
        { signal },
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
  const query = useQuery({
    ...memoDetailQueryOptions(name),
    enabled: options?.enabled ?? true,
  });
  return { ...query, data: query.data ?? undefined, isUnavailable: query.data === null };
}

function isHTTPURL(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function useLinkMetadata(url: string, options?: { enabled?: boolean }) {
  const trimmedUrl = url.trim();

  return useQuery({
    queryKey: memoKeys.linkMetadata(trimmedUrl),
    queryFn: async () => {
      const metadata = await memoServiceClient.getLinkMetadata({ url: trimmedUrl });
      return metadata;
    },
    enabled: (options?.enabled ?? true) && isHTTPURL(trimmedUrl),
    staleTime: 1000 * 60 * 60 * 24,
    gcTime: 1000 * 60 * 60 * 24,
  });
}

/** Creates a memo, or a comment on `parent`; the server fills the comment's parent and relation. */
export function useCreateMemo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ memo, parent }: { memo: Memo; parent?: string }) => {
      return parent ? await memoServiceClient.createMemoComment({ parent, comment: memo }) : await memoServiceClient.createMemo({ memo });
    },
    onSuccess: (newMemo, { parent }) => {
      queryClient.setQueryData(memoKeys.detail(newMemo.name), newMemo);
      queryClient.invalidateQueries({ queryKey: memoKeys.lists() });
      if (parent) {
        // The parent's comment list and its comment count.
        queryClient.invalidateQueries({ queryKey: memoKeys.comments(parent) });
        queryClient.invalidateQueries({ queryKey: memoKeys.detail(parent) });
      }
      queryClient.invalidateQueries({ queryKey: userKeys.stats() });
      // Creating a memo can bind previously unlinked attachments.
      queryClient.invalidateQueries({ queryKey: attachmentKeys.lists() });
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
      if (updateMask.includes("space")) return { previousMemo: undefined };
      if (!update.name) {
        return { previousMemo: undefined };
      }

      // Cancel outgoing refetches to prevent race conditions
      await queryClient.cancelQueries({ queryKey: memoKeys.all });

      // Snapshot previous value for rollback on error
      const previousMemo =
        queryClient.getQueryData<Memo>(memoKeys.detail(update.name)) || findMemoInCollectionQueries(queryClient, update.name);
      const memoPatch: MemoPatch = { ...update, name: update.name };

      // Optimistically update the cache
      if (previousMemo) {
        queryClient.setQueryData(memoKeys.detail(update.name), { ...previousMemo, ...memoPatch });
      }
      patchMemoInCollectionQueries(queryClient, memoPatch);

      return { previousMemo };
    },
    onError: (_err, { update }, context) => {
      // Rollback on error
      if (context?.previousMemo && update.name) {
        queryClient.setQueryData(memoKeys.detail(update.name), context.previousMemo);
        patchMemoInCollectionQueries(queryClient, context.previousMemo);
      } else {
        queryClient.invalidateQueries({ queryKey: memoKeys.all });
      }
    },
    onSuccess: (updatedMemo, { updateMask }) => {
      if (updateMask.includes("space")) {
        queryClient.invalidateQueries({ queryKey: memoKeys.all });
      }
      // Update cache with server response
      queryClient.setQueryData(memoKeys.detail(updatedMemo.name), updatedMemo);
      patchMemoInCollectionQueries(queryClient, updatedMemo);
      // Invalidate lists to refresh
      queryClient.invalidateQueries({ queryKey: memoKeys.lists() });
      if (updatedMemo.parent) {
        // The parent's comment list, and the parent itself, which carries the comment relation.
        queryClient.invalidateQueries({ queryKey: memoKeys.comments(updatedMemo.parent) });
        queryClient.invalidateQueries({ queryKey: memoKeys.detail(updatedMemo.parent) });
      }
      // Invalidate user stats
      queryClient.invalidateQueries({ queryKey: userKeys.stats() });
      // Placement changes move linked attachments between scoped libraries.
      queryClient.invalidateQueries({ queryKey: attachmentKeys.lists() });
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
    onSuccess: (name) => {
      // Remove from cache
      queryClient.removeQueries({ queryKey: memoKeys.detail(name) });
      // Invalidate lists
      queryClient.invalidateQueries({ queryKey: memoKeys.lists() });
      // Invalidate user stats
      queryClient.invalidateQueries({ queryKey: userKeys.stats() });
      // Memo deletion can remove or unlink associated attachments.
      queryClient.invalidateQueries({ queryKey: attachmentKeys.lists() });
    },
  });
}

export function useMemoComments(name: string, options?: { enabled?: boolean; pageSize?: number }) {
  return useQuery({
    queryKey: [...memoKeys.comments(name), options?.pageSize ?? 0],
    queryFn: async () => {
      const response = await memoServiceClient.listMemoComments(
        create(ListMemoCommentsRequestSchema, {
          parent: name,
          pageSize: options?.pageSize ?? 0,
        }),
      );
      return response;
    },
    enabled: options?.enabled ?? true,
    staleTime: 1000 * 60, // 1 minute
  });
}

// useInfiniteMemoComments paginates through every comment via nextPageToken, instead of
// stopping at the server's default page size (the cause of comments being truncated to 10).
export function useInfiniteMemoComments(name: string, options?: { enabled?: boolean; pageSize?: number }) {
  const pageSize = options?.pageSize ?? DEFAULT_LIST_MEMOS_PAGE_SIZE;
  return useInfiniteQuery({
    queryKey: [...memoKeys.comments(name), "infinite", pageSize],
    queryFn: async ({ pageParam }) => {
      const response = await memoServiceClient.listMemoComments(
        create(ListMemoCommentsRequestSchema, {
          parent: name,
          pageSize,
          pageToken: pageParam || "",
        }),
      );
      return response;
    },
    initialPageParam: "",
    getNextPageParam: (lastPage) => lastPage.nextPageToken || undefined,
    select: (data) => data.pages.flatMap((page) => page.comments),
    enabled: options?.enabled ?? true,
    staleTime: 1000 * 60, // 1 minute
  });
}
