import { Toggle, Tooltip } from "@usememos/ui";
import { useEffect, useId, useRef, useState } from "react";
import { emojiName } from "@/lib/emoji";
import { cn } from "@/lib/utils";
import type { Memo } from "@/types/proto/api/memo_service_pb";
import { useReactionActions } from "./hooks";

interface Props {
  memo: Memo;
  reactionType: string;
  count: number;
  names: string[];
}

const ReactionView = ({ memo, reactionType, count, names }: Props) => {
  const { hasReacted, handleReactionClick, isPending, canReact, canWithdraw } = useReactionActions({ memo });
  const pressed = hasReacted(reactionType);
  const clickable = canReact || (canWithdraw && pressed);
  const [open, setOpen] = useState(false);
  const triggerId = useId();
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const longPressed = useRef(false);
  const clearTimer = () => clearTimeout(timer.current);
  useEffect(() => clearTimer, []);
  const label = (
    <span className="inline-flex items-center gap-1">
      <span className="mu-body">{reactionType}</span>
      <span className="mu-caption tabular-nums">{count}</span>
    </span>
  );
  const accessibleName = `${emojiName(reactionType)}: ${count} · ${names.join(", ")}`;

  return (
    <Tooltip.Root open={open} onOpenChange={setOpen} triggerId={triggerId}>
      <Tooltip.Trigger
        id={triggerId}
        onPointerDown={(event) => {
          if (event.pointerType !== "touch") return;
          longPressed.current = false;
          clearTimer();
          timer.current = setTimeout(() => {
            longPressed.current = true;
            setOpen(true);
          }, 500);
        }}
        onPointerUp={() => {
          clearTimer();
          if (longPressed.current) timer.current = setTimeout(() => setOpen(false), 2000);
        }}
        onPointerCancel={() => {
          clearTimer();
          longPressed.current = false;
          setOpen(false);
        }}
        onPointerLeave={() => {
          clearTimer();
          if (longPressed.current) setOpen(false);
        }}
        onContextMenu={(event) => {
          if (longPressed.current) event.preventDefault();
        }}
        onClickCapture={(event) => {
          if (longPressed.current) {
            event.preventDefault();
            event.stopPropagation();
            longPressed.current = false;
          }
        }}
        render={
          clickable ? (
            <Toggle
              variant="soft"
              shape="pill"
              size="sm"
              className="shrink-0"
              aria-label={accessibleName}
              aria-disabled={isPending}
              pressed={pressed}
              onPressedChange={() => {
                handleReactionClick(reactionType);
              }}
            />
          ) : (
            <span
              aria-label={accessibleName}
              className={cn(
                "inline-flex h-6 shrink-0 items-center rounded-mu-full px-2",
                pressed ? "bg-mu-selected text-mu-text" : "bg-mu-hover text-mu-text-secondary",
              )}
            />
          )
        }
      >
        {label}
      </Tooltip.Trigger>
      <Tooltip.Popup className="max-w-64">
        <p>{names.join(", ")}</p>
      </Tooltip.Popup>
    </Tooltip.Root>
  );
};

export default ReactionView;
