import { SmilePlusIcon } from "lucide-react";
import { type ReactElement, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useInstance } from "@/contexts/InstanceContext";
import { cn } from "@/lib/utils";
import type { Memo } from "@/types/proto/api/v1/memo_service_pb";
import { useTranslate } from "@/utils/i18n";
import { useReactionActions } from "./hooks";
import { REACTION_ADD_CLASSES } from "./ReactionView";

interface Props {
  memo: Memo;
  /**
   * The element that opens the picker. Defaults to the round add control that closes a
   * strip of reaction pills; a host with its own action grammar (the memo header) passes
   * the control that belongs there.
   */
  trigger?: ReactElement;
}

/** The emoji picker. It owns only the popover and the grid; the trigger is the host's. */
const ReactionSelector = ({ memo, trigger }: Props) => {
  const t = useTranslate();
  const [open, setOpen] = useState(false);
  const { memoRelatedSetting } = useInstance();

  const { hasReacted, handleReactionClick } = useReactionActions({
    memo,
    onComplete: () => setOpen(false),
  });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-label={t("setting.memo.add-reaction")}
        render={trigger ?? <button type="button" className={REACTION_ADD_CLASSES} />}
      >
        <SmilePlusIcon className="size-4" strokeWidth={1.8} />
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
