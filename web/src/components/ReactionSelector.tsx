import { SmilePlusIcon } from "lucide-react";
import { observer } from "mobx-react-lite";
import { useRef, useState } from "react";
import useClickAway from "react-use/lib/useClickAway";
import { memoServiceClient } from "@/grpcweb";
import useCurrentUser from "@/hooks/useCurrentUser";
import { memoStore, workspaceStore } from "@/store/v2";
import { Memo } from "@/types/proto/api/v1/memo_service";
import { cn } from "@/utils";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/Popover";

interface Props {
  memo: Memo;
  className?: string;
}

const ReactionSelector = observer((props: Props) => {
  const { memo, className } = props;
  const currentUser = useCurrentUser();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const workspaceMemoRelatedSetting = workspaceStore.state.memoRelatedSetting;

  useClickAway(containerRef, () => {
    setOpen(false);
  });

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
          await memoServiceClient.deleteMemoReaction({ id: reaction.id });
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
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <span
          className={cn(
            "h-7 w-7 flex justify-center items-center rounded-full border border-zinc-200 dark:border-zinc-700 hover:opacity-70 cursor-pointer",
            className,
          )}
        >
          <SmilePlusIcon className="w-4 h-4 mx-auto text-gray-500 dark:text-gray-400" />
        </span>
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={2}>
        <div ref={containerRef}>
          <div className="flex flex-row flex-wrap py-0.5 px-2 h-auto gap-1 max-w-56">
            {workspaceMemoRelatedSetting.reactions.map((reactionType) => {
              return (
                <span
                  key={reactionType}
                  className={cn(
                    "inline-flex w-auto text-base cursor-pointer rounded px-1 text-gray-500 dark:text-gray-400 hover:opacity-80",
                    hasReacted(reactionType) && "bg-blue-100 dark:bg-zinc-800",
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
