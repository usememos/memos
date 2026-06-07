import { TrashIcon } from "lucide-react";
import { cloneElement, isValidElement, useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { useTranslate } from "@/utils/i18n";

const ACTION_WIDTH = 80;
const ACTIONS_WIDTH = ACTION_WIDTH * 2;
const OPEN_THRESHOLD = ACTIONS_WIDTH / 2;
const AXIS_LOCK_THRESHOLD = 5;
const REMOVE_ANIMATION_MS = 250;

// Tracks the close handler of the currently open card so opening a new one auto-closes the previous.
let openCardClose: (() => void) | null = null;

interface PrimaryAction {
  label: string;
  icon: React.ReactNode;
  color: string;
  onTrigger: () => void | Promise<void>;
}

interface Props {
  primaryAction: PrimaryAction;
  onDelete: () => void | Promise<void>;
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
}

interface DragState {
  pointerId: number;
  startX: number;
  startY: number;
  startTranslateX: number;
  axis: "x" | "y" | null;
}

const MemoSwipeActions: React.FC<Props> = ({ primaryAction, onDelete, disabled, className, children }) => {
  const t = useTranslate();
  const trackRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const translateXRef = useRef(0);
  const [translateX, setTranslateX] = useState(0);
  const [animated, setAnimated] = useState(false);
  const [removing, setRemoving] = useState(false);

  const setTranslate = useCallback((value: number) => {
    translateXRef.current = value;
    setTranslateX(value);
  }, []);

  const close = useCallback(() => {
    setAnimated(true);
    setTranslate(0);
    if (openCardClose === close) {
      openCardClose = null;
    }
  }, [setTranslate]);

  useEffect(() => {
    return () => {
      if (openCardClose === close) {
        openCardClose = null;
      }
    };
  }, [close]);

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (disabled || removing) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;

    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startTranslateX: translateXRef.current,
      axis: null,
    };
    setAnimated(false);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;

    const deltaX = event.clientX - drag.startX;
    const deltaY = event.clientY - drag.startY;

    if (drag.axis === null) {
      if (Math.abs(deltaX) < AXIS_LOCK_THRESHOLD && Math.abs(deltaY) < AXIS_LOCK_THRESHOLD) return;
      drag.axis = Math.abs(deltaX) > Math.abs(deltaY) ? "x" : "y";
      if (drag.axis === "x") {
        trackRef.current?.setPointerCapture(drag.pointerId);
      } else {
        // Vertical movement: let the page scroll, stop tracking this gesture.
        dragRef.current = null;
        return;
      }
    }

    if (drag.axis !== "x") return;

    event.preventDefault();
    const next = Math.min(0, Math.max(-ACTIONS_WIDTH, drag.startTranslateX + deltaX));
    setTranslate(next);
  };

  const finishDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag) return;
    if (drag.axis === "x") {
      trackRef.current?.releasePointerCapture(event.pointerId);
    }
    if (drag.axis !== "x") return;

    const shouldOpen = Math.abs(translateXRef.current) > OPEN_THRESHOLD;
    setAnimated(true);

    if (shouldOpen) {
      if (openCardClose && openCardClose !== close) {
        openCardClose();
      }
      openCardClose = close;
      setTranslate(-ACTIONS_WIDTH);
    } else {
      setTranslate(0);
      if (openCardClose === close) {
        openCardClose = null;
      }
    }
  };

  const runAction = (action: () => void | Promise<void>) => {
    if (removing) return;
    if (openCardClose === close) {
      openCardClose = null;
    }
    setRemoving(true);
    window.setTimeout(() => {
      void action();
    }, REMOVE_ANIMATION_MS);
  };

  // As soon as the card slides, it loses its own corner radius — the rounded corner "moves" onto the
  // newly exposed edge of the delete button, so the radius appears to belong to whichever element is on top.
  const isSliding = translateX !== 0;
  const slidingChild =
    isValidElement<{ className?: string }>(children) && isSliding
      ? cloneElement(children, { className: cn(children.props.className, "rounded-none!") })
      : children;

  return (
    <div
      className={cn(
        // `overflow-clip` (unlike `overflow-hidden`) clips content without turning this element
        // into a scroll container — `position: sticky` on the action labels below can therefore
        // still resolve against the page viewport instead of being pinned to the card's bounds.
        "w-full overflow-clip transition-[max-height,opacity] ease-in-out",
        removing ? "opacity-0 duration-200" : "opacity-100 duration-0",
        className,
      )}
      style={{ maxHeight: removing ? 0 : 4000 }}
    >
      {/* Positioning context sized to the card itself — padding on the outer element (e.g. for the pinned
          badge poking above the card) stays outside this box, so the action panel isn't stretched into it. */}
      <div className="relative w-full">
        <div className="absolute inset-y-0 right-0 flex">
          <button
            type="button"
            className="relative h-full text-xs font-medium text-white"
            style={{ width: ACTION_WIDTH, backgroundColor: primaryAction.color }}
            onClick={() => runAction(primaryAction.onTrigger)}
          >
            {/* `sticky top-1/2` + `-translate-y-1/2` keeps the label centered within whichever is
                smaller — the card or the viewport — instead of drifting to the card's midpoint
                (which can land off-screen for very tall cards). */}
            <span className="sticky top-1/2 flex -translate-y-1/2 flex-col items-center gap-1">
              {primaryAction.icon}
              {primaryAction.label}
            </span>
          </button>
          <button
            type="button"
            className={cn("relative h-full text-xs font-medium text-white", isSliding && "rounded-r-lg!")}
            style={{ width: ACTION_WIDTH, backgroundColor: "#E24B4A" }}
            onClick={() => runAction(onDelete)}
          >
            <span className="sticky top-1/2 flex -translate-y-1/2 flex-col items-center gap-1">
              <TrashIcon className="w-5 h-5" />
              {t("common.delete")}
            </span>
          </button>
        </div>
        <div
          ref={trackRef}
          className={cn("relative bg-background", animated && "transition-transform duration-200 ease-out")}
          style={{ transform: `translateX(${translateX}px)`, touchAction: "pan-y" }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={finishDrag}
          onPointerCancel={finishDrag}
        >
          {slidingChild}
        </div>
      </div>
    </div>
  );
};

export default MemoSwipeActions;
