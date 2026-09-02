import { SmilePlusIcon } from "lucide-react";
import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useInstance } from "@/contexts/InstanceContext";
import { cn } from "@/lib/utils";
import type { Memo } from "@/types/proto/api/v1/memo_service_pb";
import { useTranslate } from "@/utils/i18n";
import { useReactionActions } from "./hooks";

interface Props {
  memo: Memo;
  className?: string;
  onOpenChange?: (open: boolean) => void;
}

const ReactionSelector = (props: Props) => {
  const { memo, className, onOpenChange } = props;
  const t = useTranslate();
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
      <PopoverTrigger
        render={
          <button
            type="button"
            aria-label={t("setting.memo.add-reaction")}
            className={cn(
              "flex size-7 cursor-pointer items-center justify-center rounded-full border text-muted-foreground transition-all hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
              className,
            )}
          />
        }
      >
        <SmilePlusIcon className="mx-auto size-4" />
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
