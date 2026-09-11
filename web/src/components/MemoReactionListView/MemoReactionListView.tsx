import { memo } from "react";
import useCurrentUser from "@/hooks/useCurrentUser";
import { State } from "@/types/proto/api/v1/common_pb";
import type { Memo, Reaction } from "@/types/proto/api/v1/memo_service_pb";
import { useReactionGroups } from "./hooks";
import ReactionSelector from "./ReactionSelector";
import ReactionView from "./ReactionView";

interface Props {
  memo: Memo;
  reactions: Reaction[];
}

const MemoReactionListView = (props: Props) => {
  const { memo: memoData, reactions } = props;
  const currentUser = useCurrentUser();
  const reactionGroup = useReactionGroups(reactions);
  const readonly = memoData.state === State.ARCHIVED;

  if (reactions.length === 0) {
    return null;
  }

  return (
    // Chips are filled surfaces, so their box edge, not their padding, sits on the text edge.
    <div className="flex w-full flex-row flex-wrap items-center justify-start gap-1 select-none">
      {Array.from(reactionGroup).map(([reactionType, users]) => (
        <ReactionView key={`${reactionType.toString()} ${users.length}`} memo={memoData} reactionType={reactionType} users={users} />
      ))}
      {!readonly && currentUser && <ReactionSelector memo={memoData} />}
    </div>
  );
};

export default memo(MemoReactionListView);
