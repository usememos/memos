import { SmilePlusIcon } from "lucide-react";
import { observer } from "mobx-react-lite";
import { useRef, useState } from "react";
import useClickAway from "react-use/lib/useClickAway";
import { memoServiceClient } from "@/grpcweb";
import useCurrentUser from "@/hooks/useCurrentUser";
import { cn } from "@/lib/utils";
import { memoStore, workspaceStore } from "@/store";
import { Memo } from "@/types/proto/api/v1/memo_service";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";

interface Props {
  memo: Memo;
  className?: string;
  onOpenChange?: (open: boolean) => void;
}

const ReactionSelector = observer((props: Props) => {
  const { memo, className, onOpenChange } = props;
  const currentUser = useCurrentUser();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const workspaceMemoRelatedSetting = workspaceStore.state.memoRelatedSetting;

  useClickAway(containerRef, () => {
    setOpen(false);
    onOpenChange?.(false);
  });

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    onOpenChange?.(newOpen);
  };

  const hasReacted = (reactionType: string) => {
    return memo.reactions.some((r) => r.reactionType === reactionType && r.creator === currentUser?.name);
  };

  const handleReactionClick = async (reactionType: string) => {
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
            reactionType: reactionType,
          },
        });
      }
      await memoStore.getOrFetchMemoByName(memo.name, { skipCache: true });
    } catch {
      // skip error.
    }
    handleOpenChange(false);
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <span
          className={cn(
            "h-7 w-7 flex justify-center items-center rounded-full border cursor-pointer transition-all hover:opacity-80",
            className,
          )}
        >
          <SmilePlusIcon className="w-4 h-4 mx-auto text-muted-foreground" />
        </span>
      </PopoverTrigger>
      <PopoverContent align="center" className="max-w-[90vw] sm:max-w-md">
        <div ref={containerRef}>
          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-1 max-h-64 overflow-y-auto">
            {workspaceMemoRelatedSetting.reactions.map((reactionType) => {
              return (
                <span
                  key={reactionType}
                  className={cn(
                    "inline-flex w-auto text-base cursor-pointer rounded px-1 text-muted-foreground hover:opacity-80 transition-colors",
                    hasReacted(reactionType) && "bg-secondary text-secondary-foreground",
                  )}
                  onClick={() => handleReactionClick(reactionType)}
                >
                  {reactionType}
                </span>
              );
            })}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
});

export default ReactionSelector;
