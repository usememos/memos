import { Button, Popover, Toggle, Tooltip } from "@usememos/ui";
import { SmilePlusIcon } from "lucide-react";
import { type ReactElement, useRef, useState } from "react";
import { useInstance } from "@/contexts/InstanceContext";
import type { Memo } from "@/types/proto/api/memo_service_pb";
import { useTranslate } from "@/utils/i18n";
import { useReactionActions } from "./hooks";

interface Props {
  memo: Memo;
  /**
   * The element that opens the picker. Defaults to the quiet add control that closes a
   * strip of reaction pills; a host with its own action grammar (the memo header) passes
   * the control that belongs there.
   */
  trigger?: ReactElement;
}

/** The emoji picker. It owns only the popover and the grid; the trigger is the host's. */
const ReactionSelector = ({ memo, trigger }: Props) => {
  const t = useTranslate();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const { memoRelatedSetting } = useInstance();

  const { hasReacted, handleReactionClick } = useReactionActions({
    memo,
    onComplete: () => {
      if (popupRef.current?.contains(document.activeElement)) triggerRef.current?.focus({ preventScroll: true });
      setOpen(false);
    },
  });

  return (
    <Popover.Root
      open={open}
      onOpenChange={(nextOpen, details) => {
        // Focus must reach the header trigger before closing hides its wrapper.
        if (!nextOpen && details.reason === "escape-key") triggerRef.current?.focus({ preventScroll: true });
        setOpen(nextOpen);
      }}
    >
      <Tooltip.Root>
        <Tooltip.Trigger
          render={
            <Popover.Trigger
              ref={triggerRef}
              aria-label={t("setting.memo.add-reaction")}
              render={trigger ?? <Button variant="ghost" shape="pill" size="sm" icon={<SmilePlusIcon />} />}
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
      <Popover.Popup
        ref={popupRef}
        align="start"
        initialFocus={(interactionType) => (interactionType === "keyboard" ? true : popupRef.current)}
        aria-label={t("setting.memo.add-reaction")}
        className="mu-compact w-max p-[calc(var(--mu-space-2)-1px)] transition-none"
      >
        <div className="grid max-h-[var(--mu-list-height)] grid-flow-col gap-0.5 overflow-y-auto max-sm:grid-flow-row max-sm:grid-cols-[repeat(4,max-content)] [@media(pointer:coarse)]:grid-flow-row [@media(pointer:coarse)]:grid-cols-[repeat(4,max-content)]">
          {memoRelatedSetting.reactions.map((reactionType) => (
            <Toggle
              key={reactionType}
              variant="ghost"
              className="w-[var(--mu-row-height)] p-0 data-pressed:bg-mu-selected"
              aria-label={reactionType}
              pressed={hasReacted(reactionType)}
              onPressedChange={() => handleReactionClick(reactionType)}
            >
              <span className="mu-body" aria-hidden>
                {reactionType}
              </span>
            </Toggle>
          ))}
        </div>
      </Popover.Popup>
    </Popover.Root>
  );
};

export default ReactionSelector;
