import { uniq } from "lodash-es";
import { useEffect, useState } from "react";
import { memoServiceClient } from "@/connect";
import useCurrentUser from "@/hooks/useCurrentUser";
import { memoStore, userStore } from "@/store";
import type { Memo, Reaction } from "@/types/proto/api/v1/memo_service_pb";
import type { User } from "@/types/proto/api/v1/user_service_pb";

export type ReactionGroup = Map<string, User[]>;

export const useReactionGroups = (reactions: Reaction[]): ReactionGroup => {
  const [reactionGroup, setReactionGroup] = useState<ReactionGroup>(new Map());

  useEffect(() => {
    const fetchReactionGroups = async () => {
      const newReactionGroup = new Map<string, User[]>();
      for (const reaction of reactions) {
        const user = await userStore.getOrFetchUser(reaction.creator);
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
      await memoStore.getOrFetchMemoByName(memo.name, { skipCache: true });
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
