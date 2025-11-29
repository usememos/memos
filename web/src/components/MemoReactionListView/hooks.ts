import { uniq } from "lodash-es";
import { useEffect, useState } from "react";
import { userStore } from "@/store";
import type { Reaction } from "@/types/proto/api/v1/memo_service";
import type { User } from "@/types/proto/api/v1/user_service";
import type { ReactionGroup } from "./types";

/**
 * Hook for grouping reactions by type and fetching user data
 */
export const useReactionGroups = (reactions: Reaction[]): ReactionGroup => {
  const [reactionGroup, setReactionGroup] = useState<ReactionGroup>(new Map());

  useEffect(() => {
    const fetchReactionGroups = async () => {
      const newReactionGroup = new Map<string, User[]>();

      for (const reaction of reactions) {
        const user = await userStore.getOrFetchUserByName(reaction.creator);
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
