import { observer } from "mobx-react-lite";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import useCurrentUser from "@/hooks/useCurrentUser";
import { cn } from "@/lib/utils";
import { State } from "@/types/proto/api/v1/common";
import { formatReactionTooltip, useReactionActions } from "./hooks";
import type { ReactionViewProps } from "./types";

/**
 * ReactionView component displays a single reaction pill with count
 * Clicking toggles the reaction for the current user
 */
const ReactionView = observer((props: ReactionViewProps) => {
  const { memo, reactionType, users } = props;
  const currentUser = useCurrentUser();
  const hasReaction = users.some((user) => currentUser && user.username === currentUser.username);
  const readonly = memo.state === State.ARCHIVED;

  const { handleReactionClick } = useReactionActions({ memo });

  const handleClick = () => {
    if (!currentUser || readonly) return;
    handleReactionClick(reactionType);
  };

  const isClickable = currentUser && !readonly;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className={cn(
              "h-7 border px-2 py-0.5 rounded-full flex flex-row justify-center items-center gap-1",
              "text-sm text-muted-foreground",
              isClickable && "cursor-pointer",
              !isClickable && "cursor-default",
              hasReaction && "bg-accent border-border",
            )}
            onClick={handleClick}
            disabled={!isClickable}
          >
            <span>{reactionType}</span>
            <span className="opacity-60">{users.length}</span>
          </button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{formatReactionTooltip(users, reactionType)}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
});

export default ReactionView;
