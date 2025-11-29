import { observer } from "mobx-react-lite";
import { memo } from "react";
import useCurrentUser from "@/hooks/useCurrentUser";
import { State } from "@/types/proto/api/v1/common";
import { ReactionSelector, ReactionView } from "../reactions";
import { useReactionGroups } from "./hooks";
import type { MemoReactionListViewProps } from "./types";

/**
 * MemoReactionListView displays the reactions on a memo:
 * - Groups reactions by type
 * - Shows reaction emoji with count
 * - Allows adding new reactions (if not readonly)
 */
const MemoReactionListView = observer((props: MemoReactionListViewProps) => {
  const { memo: memoData, reactions } = props;
  const currentUser = useCurrentUser();
  const reactionGroup = useReactionGroups(reactions);
  const readonly = memoData.state === State.ARCHIVED;

  if (reactions.length === 0) {
    return null;
  }

  return (
    <div className="w-full flex flex-row justify-start items-start flex-wrap gap-1 select-none">
      {Array.from(reactionGroup).map(([reactionType, users]) => (
        <ReactionView key={`${reactionType.toString()} ${users.length}`} memo={memoData} reactionType={reactionType} users={users} />
      ))}
      {!readonly && currentUser && <ReactionSelector memo={memoData} />}
    </div>
  );
});

export default memo(MemoReactionListView);
