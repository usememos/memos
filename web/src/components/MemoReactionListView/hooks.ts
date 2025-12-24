import { uniq } from "lodash-es";
import { useEffect, useState } from "react";
import { memoServiceClient, userServiceClient } from "@/connect";
import useCurrentUser from "@/hooks/useCurrentUser";
import type { Memo, Reaction } from "@/types/proto/api/v1/memo_service_pb";
import type { User } from "@/types/proto/api/v1/user_service_pb";

export type ReactionGroup = Map<string, User[]>;

export const useReactionGroups = (reactions: Reaction[]): ReactionGroup => {
  const [reactionGroup, setReactionGroup] = useState<ReactionGroup>(new Map());

  useEffect(() => {
    const fetchReactionGroups = async () => {
      const newReactionGroup = new Map<string, User[]>();
      for (const reaction of reactions) {
        // Fetch user via gRPC directly since we need it within an effect
        const user = await userServiceClient.getUser({ name: reaction.creator });
        const users = newReactionGroup.get(reaction.reactionType) || [];
        users.push(user);
        newReactionGroup.set(reaction.reactionType, uniq(users));
      }
      setReactionGroup(newReactionGroup);
    };
    fetchReactionGroups();
  }, [reactions]);

  return reactionGroup;
};

interface UseReactionActionsOptions {
  memo: Memo;
  onComplete?: () => void;
}

export const useReactionActions = ({ memo, onComplete }: UseReactionActionsOptions) => {
  const currentUser = useCurrentUser();

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
      // Refetch the memo to get updated reactions
      await memoServiceClient.getMemo({ name: memo.name });
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
