import { Popover, Tooltip } from "@usememos/ui";
import { SmilePlusIcon } from "lucide-react";
import { type ReactElement, useState } from "react";
import { useInstance } from "@/contexts/InstanceContext";
import { cn } from "@/lib/utils";
import type { Memo } from "@/types/proto/api/memo_service_pb";
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
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Tooltip.Root>
        <Tooltip.Trigger
          render={
            <Popover.Trigger
              aria-label={t("setting.memo.add-reaction")}
              render={trigger ?? <button type="button" className={REACTION_ADD_CLASSES} />}
              // A host trigger brings its own icon; the default button draws this one.
              children={trigger ? undefined : <SmilePlusIcon className="mu-icon" />}
            />
          }
        />
        <Tooltip.Popup>{t("setting.memo.add-reaction")}</Tooltip.Popup>
      </Tooltip.Root>
      {/*
       * The header trigger is intentionally hidden once its memo card is no
       * longer hovered. An exit transition would therefore outlive its anchor
       * and Base UI would briefly reposition the portal at (0, 0). Close this
       * picker immediately instead of animating an unanchored popup.
       */}
      {/* The list variant gives the grid a Menu's inset; each emoji is a cell with a menu row's height, radius and hover fill. */}
      <Popover.Popup align="center" variant="list" className="max-w-[90vw] transition-none sm:max-w-md">
        <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 max-h-64 overflow-y-auto">
          {memoRelatedSetting.reactions.map((reactionType) => (
            <button
              type="button"
              key={reactionType}
              className={cn(
                "inline-flex h-8 items-center justify-center rounded-mu-lg text-base cursor-pointer hover:bg-mu-hover",
                hasReacted(reactionType) && "bg-mu-key",
              )}
              onClick={() => handleReactionClick(reactionType)}
            >
              {reactionType}
            </button>
          ))}
        </div>
      </Popover.Popup>
    </Popover.Root>
  );
};

export default ReactionSelector;
