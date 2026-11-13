import { Toggle, Tooltip } from "@usememos/ui";
import useCurrentUser from "@/hooks/useCurrentUser";
import { cn } from "@/lib/utils";
import { State } from "@/types/proto/api/common_pb";
import type { Memo } from "@/types/proto/api/memo_service_pb";
import type { User } from "@/types/proto/api/user_service_pb";
import { formatReactionTooltip, useReactionActions } from "./hooks";

interface Props {
  memo: Memo;
  reactionType: string;
  users: User[];
}

const ReactionView = (props: Props) => {
  const { memo, reactionType, users } = props;
  const currentUser = useCurrentUser();
  const readonly = memo.state === State.ARCHIVED;

  const { hasReacted, handleReactionClick } = useReactionActions({ memo });
  const hasReaction = hasReacted(reactionType);

  const isClickable = Boolean(currentUser) && !readonly;
  const label = (
    <span className="inline-flex items-center gap-1">
      <span className="mu-body">{reactionType}</span>
      <span className="mu-caption tabular-nums">{users.length}</span>
    </span>
  );

  return (
    <Tooltip.Provider>
      <Tooltip.Root>
        <Tooltip.Trigger
          render={
            isClickable ? (
              <Toggle
                variant="soft"
                shape="pill"
                size="sm"
                className="shrink-0"
                pressed={hasReaction}
                onPressedChange={() => handleReactionClick(reactionType)}
              />
            ) : (
              <span
                className={cn(
                  "inline-flex h-6 shrink-0 items-center rounded-mu-full px-2",
                  hasReaction ? "bg-mu-selected text-mu-text" : "bg-mu-hover text-mu-text-secondary",
                )}
              />
            )
          }
        >
          {label}
        </Tooltip.Trigger>
        <Tooltip.Popup>
          <p>{formatReactionTooltip(users, reactionType)}</p>
        </Tooltip.Popup>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
};

export default ReactionView;
