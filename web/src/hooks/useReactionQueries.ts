import { create } from "@bufbuild/protobuf";
import { useIsMutating, useMutation, useQueryClient } from "@tanstack/react-query";
import { memoServiceClient } from "@/connect";
import { findMemoRecord, memoKeys, updateMemoReactions } from "@/hooks/useMemoQueries";
import { memoShareKeys } from "@/hooks/useMemoShareQueries";
import { handleError } from "@/lib/error";
import { showErrorToast } from "@/lib/toast";
import { type Memo, type Reaction, ReactionSchema } from "@/types/proto/api/memo_service_pb";

export function useToggleReaction(memo: Memo, creator: string | undefined) {
  const queryClient = useQueryClient();
  const mutationKey = ["memo-reaction", memo.name];
  const isPending = useIsMutating({ mutationKey }) > 0;
  const sharedMemoKey = [...memoShareKeys.all, "by-share"];
  const cancelReads = () =>
    Promise.all([queryClient.cancelQueries({ queryKey: memoKeys.all }), queryClient.cancelQueries({ queryKey: sharedMemoKey })]);
  const mutation = useMutation({
    mutationKey,
    mutationFn: async ({ reactionType, existing }: { reactionType: string; existing: Reaction[] }) => {
      if (existing.length) {
        await Promise.all(existing.map(({ name }) => memoServiceClient.deleteMemoReaction({ name })));
        return undefined;
      }
      return memoServiceClient.upsertMemoReaction({ parent: memo.name, reaction: { reactionType } });
    },
    onMutate: async ({ reactionType, existing }) => {
      await cancelReads();
      const record = findMemoRecord(queryClient, memo.name);
      if (record === null) return;
      const current = record ?? memo;
      if (!queryClient.getQueryData(memoKeys.detail(memo.name))) queryClient.setQueryData(memoKeys.detail(memo.name), current);
      const previous = current.reactions;
      updateMemoReactions(queryClient, memo.name, (reactions) =>
        existing.length
          ? reactions.filter((reaction) => reaction.creator !== creator || reaction.reactionType !== reactionType)
          : [...reactions, create(ReactionSchema, { name: `${memo.name}/reactions/pending`, creator, reactionType })],
      );
      return { previous };
    },
    onSuccess: async (saved, { reactionType }) => {
      await cancelReads();
      updateMemoReactions(queryClient, memo.name, (reactions) => [
        ...reactions.filter((reaction) => reaction.creator !== creator || reaction.reactionType !== reactionType),
        ...(saved ? [saved] : []),
      ]);
    },
    onError: async (error, { reactionType }, context) => {
      await cancelReads();
      if (context) {
        updateMemoReactions(queryClient, memo.name, (reactions) => [
          ...reactions.filter((reaction) => reaction.creator !== creator || reaction.reactionType !== reactionType),
          ...context.previous.filter((reaction) => reaction.creator === creator && reaction.reactionType === reactionType),
        ]);
      }
      handleError(error, showErrorToast);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: memoKeys.detail(memo.name) });
      void queryClient.invalidateQueries({ queryKey: memoKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: sharedMemoKey });
      if (memo.parent) void queryClient.invalidateQueries({ queryKey: memoKeys.comments(memo.parent) });
    },
  });

  const toggleReaction = (reactionType: string) => {
    if (!creator || queryClient.isMutating({ mutationKey })) return false;
    const record = findMemoRecord(queryClient, memo.name);
    if (record === null) return false;
    const current = record ?? memo;
    const existing = current.reactions.filter((reaction) => reaction.creator === creator && reaction.reactionType === reactionType);
    mutation.mutate({ reactionType, existing });
    return true;
  };

  return { toggleReaction, isPending };
}
