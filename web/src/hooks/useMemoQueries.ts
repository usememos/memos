import { create } from "@bufbuild/protobuf";
import { FieldMaskSchema } from "@bufbuild/protobuf/wkt";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { memoServiceClient } from "@/connect";
import type { ListMemosRequest, Memo } from "@/types/proto/api/v1/memo_service_pb";
import { ListMemosRequestSchema, MemoSchema } from "@/types/proto/api/v1/memo_service_pb";

// Query keys factory for consistent cache management
export const memoKeys = {
  all: ["memos"] as const,
  lists: () => [...memoKeys.all, "list"] as const,
  list: (filters: Partial<ListMemosRequest>) => [...memoKeys.lists(), filters] as const,
  details: () => [...memoKeys.all, "detail"] as const,
  detail: (name: string) => [...memoKeys.details(), name] as const,
};

/**
 * Hook to fetch a list of memos with filtering and sorting.
 * @param request - Request parameters (state, orderBy, filter, pageSize)
 */
export function useMemos(request: Partial<ListMemosRequest> = {}) {
  return useQuery({
    queryKey: memoKeys.list(request),
    queryFn: async () => {
      const response = await memoServiceClient.listMemos(create(ListMemosRequestSchema, request as Record<string, unknown>));
      return response;
    },
  });
}

/**
 * Hook for infinite scrolling/pagination of memos.
 * Automatically fetches pages as the user scrolls.
 *
 * @param request - Partial request configuration (state, orderBy, filter, pageSize)
 * @returns React Query infinite query result with pages of memos
 */
export function useInfiniteMemos(request: Partial<ListMemosRequest> = {}) {
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
    staleTime: 1000 * 60, // Consider data fresh for 1 minute
    gcTime: 1000 * 60 * 5, // Keep unused data in cache for 5 minutes
  });
}

/**
 * Hook to fetch a single memo by its resource name.
 * @param name - Memo resource name (e.g., "memos/123")
 * @param options - Query options including enabled flag
 */
export function useMemo(name: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: memoKeys.detail(name),
    queryFn: async () => {
      const memo = await memoServiceClient.getMemo({ name });
      return memo;
    },
    enabled: options?.enabled ?? true,
    staleTime: 1000 * 60, // 1 minute - memos can be edited frequently
  });
}

/**
 * Hook to create a new memo.
 * Automatically invalidates memo lists and user stats on success.
 */
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
      queryClient.invalidateQueries({ queryKey: ["users", "stats"] });
    },
  });
}

/**
 * Hook to update an existing memo with optimistic updates.
 * Implements rollback on error for better UX.
 */
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
      await queryClient.cancelQueries({ queryKey: memoKeys.detail(update.name) });

      // Snapshot previous value for rollback on error
      const previousMemo = queryClient.getQueryData<Memo>(memoKeys.detail(update.name));

      // Optimistically update the cache
      if (previousMemo) {
        queryClient.setQueryData(memoKeys.detail(update.name), { ...previousMemo, ...update });
      }

      return { previousMemo };
    },
    onError: (_err, { update }, context) => {
      // Rollback on error
      if (context?.previousMemo && update.name) {
        queryClient.setQueryData(memoKeys.detail(update.name), context.previousMemo);
      }
    },
    onSuccess: (updatedMemo) => {
      // Update cache with server response
      queryClient.setQueryData(memoKeys.detail(updatedMemo.name), updatedMemo);
      // Invalidate lists to refresh
      queryClient.invalidateQueries({ queryKey: memoKeys.lists() });
      // Invalidate user stats
      queryClient.invalidateQueries({ queryKey: ["users", "stats"] });
    },
  });
}

/**
 * Hook to delete a memo.
 * Automatically removes memo from cache and invalidates lists on success.
 */
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
      queryClient.invalidateQueries({ queryKey: ["users", "stats"] });
    },
  });
}
