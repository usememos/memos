import { create } from "@bufbuild/protobuf";
import { timestampFromDate } from "@bufbuild/protobuf/wkt";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { memoServiceClient } from "@/connect";
import type { Attachment } from "@/types/proto/api/v1/attachment_service_pb";
import type { MemoShare } from "@/types/proto/api/v1/memo_service_pb";
import {
  CreateMemoShareRequestSchema,
  DeleteMemoShareRequestSchema,
  GetMemoByShareRequestSchema,
  ListMemoSharesRequestSchema,
  MemoShareSchema,
} from "@/types/proto/api/v1/memo_service_pb";

// Query keys factory for share-related cache management.
export const memoShareKeys = {
  all: ["memo-shares"] as const,
  list: (memoName: string) => [...memoShareKeys.all, "list", memoName] as const,
  byShare: (shareId: string) => [...memoShareKeys.all, "by-share", shareId] as const,
};

/** Lists all active share links for a memo (creator-only). */
export function useMemoShares(memoName: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: memoShareKeys.list(memoName),
    queryFn: async () => {
      const response = await memoServiceClient.listMemoShares(create(ListMemoSharesRequestSchema, { parent: memoName }));
      return response.memoShares;
    },
    enabled: options?.enabled ?? !!memoName,
  });
}

/** Creates a new share link for a memo. */
export function useCreateMemoShare() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ memoName, expireTime }: { memoName: string; expireTime?: Date }) => {
      const memoShare = create(MemoShareSchema, {
        expireTime: expireTime ? timestampFromDate(expireTime) : undefined,
      });
      const response = await memoServiceClient.createMemoShare(create(CreateMemoShareRequestSchema, { parent: memoName, memoShare }));
      return response;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: memoShareKeys.list(variables.memoName) });
    },
  });
}

/** Revokes (deletes) a share link. */
export function useDeleteMemoShare() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ name, memoName }: { name: string; memoName: string }) => {
      await memoServiceClient.deleteMemoShare(create(DeleteMemoShareRequestSchema, { name }));
      return memoName;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: memoShareKeys.list(variables.memoName) });
    },
  });
}

/** Resolves a share token to its memo. Used by the public SharedMemo page. */
export function useSharedMemo(shareId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: memoShareKeys.byShare(shareId),
    queryFn: async () => {
      const memo = await memoServiceClient.getMemoByShare(create(GetMemoByShareRequestSchema, { shareId }));
      return memo;
    },
    enabled: options?.enabled ?? !!shareId,
    retry: false, // Don't retry NOT_FOUND — the link is invalid or expired
  });
}

/**
 * Returns the share URL for a MemoShare resource.
 * The token is the last path segment of the share name (memos/{uid}/shares/{token}).
 */
export function getShareUrl(share: MemoShare): string {
  const token = share.name.split("/").pop() ?? "";
  return `${window.location.origin}/memos/shares/${token}`;
}

/**
 * Returns the token portion of a MemoShare resource name.
 * Format: memos/{memo}/shares/{token}
 */
export function getShareToken(share: MemoShare): string {
  return share.name.split("/").pop() ?? "";
}

/** Rewrites attachment URLs to include a share token for unauthenticated access. */
export function withShareAttachmentLinks(attachments: Attachment[], token: string): Attachment[] {
  return attachments.map((a) => {
    if (a.externalLink) return a;
    return { ...a, externalLink: `${window.location.origin}/file/${a.name}/${a.filename}?share_token=${encodeURIComponent(token)}` };
  });
}
