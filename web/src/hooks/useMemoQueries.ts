import { create } from "@bufbuild/protobuf";
import { FieldMaskSchema } from "@bufbuild/protobuf/wkt";
import type { InfiniteData } from "@tanstack/react-query";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { memoServiceClient } from "@/connect";
import { userKeys } from "@/hooks/useUserQueries";
import type { ListMemosRequest, ListMemosResponse, Memo } from "@/types/proto/api/v1/memo_service_pb";
import { ListMemosRequestSchema, MemoSchema } from "@/types/proto/api/v1/memo_service_pb";

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

function isMemoListResponse(data: unknown): data is ListMemosResponse {
  return typeof data === "object" && data !== null && Array.isArray((data as { memos?: unknown }).memos);
}

function isInfiniteMemoListData(data: unknown): data is InfiniteData<ListMemosResponse> {
  return typeof data === "object" && data !== null && Array.isArray((data as { pages?: unknown }).pages);
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
    staleTime: 1000 * 10, // 10 seconds - reduced to prevent stale data in collaborative editing
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
      // Invalidate memo lists to refetch
      queryClient.invalidateQueries({ queryKey: memoKeys.lists() });
      // Add new memo to cache
      queryClient.setQueryData(memoKeys.detail(newMemo.name), newMemo);
      // Invalidate user stats
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
    onMutate: async ({ update }) => {
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
    onSuccess: (updatedMemo) => {
      // Update cache with server response
      queryClient.setQueryData(memoKeys.detail(updatedMemo.name), updatedMemo);
      patchMemoInCollectionQueries(queryClient, updatedMemo);
      // Invalidate lists to refresh
      queryClient.invalidateQueries({ queryKey: memoKeys.lists() });
      if (updatedMemo.parent) {
        queryClient.invalidateQueries({ queryKey: memoKeys.comments(updatedMemo.parent) });
      }
      // Invalidate user stats
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
    onSuccess: (name) => {
      // Remove from cache
      queryClient.removeQueries({ queryKey: memoKeys.detail(name) });
      // Invalidate lists
      queryClient.invalidateQueries({ queryKey: memoKeys.lists() });
      // Invalidate user stats
      queryClient.invalidateQueries({ queryKey: userKeys.stats() });
    },
  });
}

export function useMemoComments(name: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: memoKeys.comments(name),
    queryFn: async () => {
      const response = await memoServiceClient.listMemoComments({ name });
      return response;
    },
    enabled: options?.enabled ?? true,
    staleTime: 1000 * 60, // 1 minute
  });
}
