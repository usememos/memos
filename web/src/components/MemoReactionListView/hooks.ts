import { useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { memoServiceClient } from "@/connect";
import useCurrentUser from "@/hooks/useCurrentUser";
import { memoKeys } from "@/hooks/useMemoQueries";
import { useUsersByNames } from "@/hooks/useUserQueries";
import type { Memo, Reaction } from "@/types/proto/api/v1/memo_service_pb";
import type { User } from "@/types/proto/api/v1/user_service_pb";

export type ReactionGroup = Map<string, User[]>;

export const useReactionGroups = (reactions: Reaction[]): ReactionGroup => {
  const creatorNames = useMemo(() => reactions.map((r) => r.creator), [reactions]);
  const { data: userMap } = useUsersByNames(creatorNames);

  return useMemo(() => {
    const reactionGroup = new Map<string, User[]>();
    for (const reaction of reactions) {
      const user = userMap?.get(reaction.creator);
      if (!user) continue;

      const users = reactionGroup.get(reaction.reactionType) || [];
      users.push(user);
      reactionGroup.set(reaction.reactionType, users);
    }
    return reactionGroup;
  }, [reactions, userMap]);
};

interface UseReactionActionsOptions {
  memo: Memo;
  onComplete?: () => void;
}

export const useReactionActions = ({ memo, onComplete }: UseReactionActionsOptions) => {
  const currentUser = useCurrentUser();
  const queryClient = useQueryClient();

  const hasReacted = (reactionType: string) => {
    return memo.reactions.some((r) => r.reactionType === reactionType && r.creator === currentUser?.name);
  };

  const handleReactionClick = async (reactionType: string) => {
    if (!currentUser) return;

    try {
      if (hasReacted(reactionType)) {
        const reactions = memo.reactions.filter(
          (reaction) => reaction.reactionType === reactionType && reaction.creator === currentUser.name,
        );
        for (const reaction of reactions) {
          await memoServiceClient.deleteMemoReaction({ name: reaction.name });
        }
      } else {
        await memoServiceClient.upsertMemoReaction({
          name: memo.name,
          reaction: { contentId: memo.name, reactionType },
        });
      }
      // Refetch the memo to get updated reactions and invalidate cache
      const updatedMemo = await memoServiceClient.getMemo({ name: memo.name });
      queryClient.setQueryData(memoKeys.detail(memo.name), updatedMemo);
      queryClient.invalidateQueries({ queryKey: memoKeys.lists() });
    } catch {
      // skip error
    }
    onComplete?.();
  };

  return { hasReacted, handleReactionClick };
};

export const formatReactionTooltip = (users: User[], reactionType: string): string => {
  if (users.length === 0) return "";
  const formatUserName = (user: User) => user.displayName || user.username;
  if (users.length < 5) {
    return `${users.map(formatUserName).join(", ")} reacted with ${reactionType.toLowerCase()}`;
  }
  return `${users.slice(0, 4).map(formatUserName).join(", ")} and ${users.length - 4} more reacted with ${reactionType.toLowerCase()}`;
};
