import { SmilePlusIcon } from "lucide-react";
import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useInstance } from "@/contexts/InstanceContext";
import { cn } from "@/lib/utils";
import type { Memo } from "@/types/proto/api/v1/memo_service_pb";
import { useReactionActions } from "./hooks";

interface Props {
  memo: Memo;
  className?: string;
  onOpenChange?: (open: boolean) => void;
}

const ReactionSelector = (props: Props) => {
  const { memo, className, onOpenChange } = props;
  const [open, setOpen] = useState(false);
  const { memoRelatedSetting } = useInstance();

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    onOpenChange?.(newOpen);
  };

  const { hasReacted, handleReactionClick } = useReactionActions({
    memo,
    onComplete: () => handleOpenChange(false),
  });

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
        <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-1 max-h-64 overflow-y-auto">
          {memoRelatedSetting.reactions.map((reactionType) => (
            <button
              type="button"
              key={reactionType}
              className={cn(
                "inline-flex w-auto text-base cursor-pointer rounded px-1 text-muted-foreground hover:opacity-80 transition-colors",
                hasReacted(reactionType) && "bg-secondary text-secondary-foreground",
              )}
              onClick={() => handleReactionClick(reactionType)}
            >
              {reactionType}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default ReactionSelector;
