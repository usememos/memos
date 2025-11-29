import { useCallback } from "react";
import { memoServiceClient } from "@/grpcweb";
import useCurrentUser from "@/hooks/useCurrentUser";
import { memoStore } from "@/store";
import type { Memo } from "@/types/proto/api/v1/memo_service";
import type { User } from "@/types/proto/api/v1/user_service";

interface UseReactionActionsOptions {
  memo: Memo;
  onComplete?: () => void;
}

/**
 * Hook for handling reaction add/remove operations
 */
export const useReactionActions = ({ memo, onComplete }: UseReactionActionsOptions) => {
  const currentUser = useCurrentUser();

  const hasReacted = useCallback(
    (reactionType: string) => {
      return memo.reactions.some((r) => r.reactionType === reactionType && r.creator === currentUser?.name);
    },
    [memo.reactions, currentUser?.name],
  );

  const handleReactionClick = useCallback(
    async (reactionType: string) => {
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
            reaction: {
              contentId: memo.name,
              reactionType,
            },
          });
        }
        await memoStore.getOrFetchMemoByName(memo.name, { skipCache: true });
      } catch {
        // skip error
      }
      onComplete?.();
    },
    [memo, currentUser, hasReacted, onComplete],
  );

  return {
    hasReacted,
    handleReactionClick,
  };
};

/**
 * Format users list for tooltip display
 */
export const formatReactionTooltip = (users: User[], reactionType: string): string => {
  if (users.length === 0) {
    return "";
  }

  const formatUserName = (user: User) => user.displayName || user.username;

  if (users.length < 5) {
    return `${users.map(formatUserName).join(", ")} reacted with ${reactionType.toLowerCase()}`;
  }

  return `${users.slice(0, 4).map(formatUserName).join(", ")} and ${users.length - 4} more reacted with ${reactionType.toLowerCase()}`;
};
