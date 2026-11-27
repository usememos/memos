import { useMemo } from "react";
import { useResolvedUsersByNames } from "@/contexts/MentionResolutionContext";
import useCurrentUser from "@/hooks/useCurrentUser";
import { useToggleReaction } from "@/hooks/useReactionQueries";
import { useSpaces } from "@/hooks/useSpaceQueries";
import { extractUsernameFromName } from "@/lib/resource-names";
import { State } from "@/types/proto/api/common_pb";
import { type Memo, type Reaction, Visibility } from "@/types/proto/api/memo_service_pb";
import { SpaceMember_Role } from "@/types/proto/api/space_service_pb";
import { isSuperUser } from "@/utils/user";

export const useReactionGroups = (reactions: Reaction[]) => {
  const creatorNames = useMemo(() => reactions.map((reaction) => reaction.creator), [reactions]);
  const users = useResolvedUsersByNames(creatorNames);
  return useMemo(() => {
    const groups = new Map<string, { reactions: Reaction[]; names: string[] }>();
    for (const reaction of reactions) {
      const group = groups.get(reaction.reactionType) ?? { reactions: [], names: [] };
      const user = users.get(reaction.creator);
      group.reactions.push(reaction);
      group.names.push(user?.displayName || user?.username || extractUsernameFromName(reaction.creator));
      groups.set(reaction.reactionType, group);
    }
    return groups;
  }, [reactions, users]);
};

export const useReactionActions = ({ memo }: { memo: Memo }) => {
  const currentUser = useCurrentUser();
  const admin = isSuperUser(currentUser);
  const { data: spaces } = useSpaces(currentUser?.name, { enabled: Boolean(memo.space) && !admin });
  const role = spaces?.find((space) => space.name === memo.space)?.currentUserRole;
  const active = Boolean(currentUser) && currentUser?.state !== State.ARCHIVED && memo.state !== State.ARCHIVED;
  const canReact =
    active &&
    (admin ||
      ((!memo.space || role === SpaceMember_Role.ADMIN || role === SpaceMember_Role.USER) &&
        (memo.visibility !== Visibility.PRIVATE || memo.creator === currentUser?.name)));
  const { toggleReaction, isPending } = useToggleReaction(memo, currentUser?.name);
  const hasReacted = (reactionType: string) =>
    memo.reactions.some((reaction) => reaction.reactionType === reactionType && reaction.creator === currentUser?.name);

  const handleReactionClick = (reactionType: string) => {
    if (!active || (!canReact && !hasReacted(reactionType))) return false;
    return toggleReaction(reactionType);
  };

  return { hasReacted, handleReactionClick, isPending, canReact, canWithdraw: active };
};
