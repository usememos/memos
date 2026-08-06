import {
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";
import { useTranslate } from "@/utils/i18n";
import { SIDEBAR_DEFAULT_WIDTH, SIDEBAR_WIDTH_VAR } from "./useSidebarWidth";

/** Arrow-key nudge, matching the 16px rhythm the sidebar rows sit on. */
const KEYBOARD_STEP = 16;

interface Props {
  width: number;
  minWidth: number;
  maxWidth: number;
  onWidthChange: (width: number) => void;
  /** Element carrying the width custom property, written to directly while dragging. */
  targetRef: RefObject<HTMLElement | null>;
}

const SidebarResizeHandle = ({ width, minWidth, maxWidth, onWidthChange, targetRef }: Props) => {
  const t = useTranslate();
  // `dragging` drives the band's styling; `draggingRef` is what the handlers and the unmount
  // cleanup read, so neither depends on a state update having been flushed first.
  const [dragging, setDragging] = useState(false);
  const draggingRef = useRef(false);
  const frameRef = useRef<number | null>(null);
  const pendingRef = useRef(width);
  const originRef = useRef({ x: 0, width });

  const clamp = useCallback((next: number) => Math.min(Math.max(Math.round(next), minWidth), maxWidth), [minWidth, maxWidth]);

  // The drag bypasses React: layout follows the custom property, so the rail tracks the cursor at
  // frame rate while the tree — sidebar, feed, column grid — re-renders exactly once, on release.
  const previewWidth = useCallback(
    (next: number) => {
      pendingRef.current = next;
      if (frameRef.current != null) return;
      frameRef.current = requestAnimationFrame(() => {
        frameRef.current = null;
        targetRef.current?.style.setProperty(SIDEBAR_WIDTH_VAR, `${pendingRef.current}px`);
      });
    },
    [targetRef],
  );

  const stopPreview = useCallback(() => {
    if (frameRef.current == null) return;
    cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
  }, []);

  // Unmounting can interrupt a drag: the window crossing the desktop breakpoint takes the whole
  // rail with it, so `endDrag` never runs. The shell outlives the rail and React will not rewrite
  // a style property whose value it thinks is unchanged, so the previewed width would otherwise
  // survive as layout that disagrees with both state and storage. Put the committed width back —
  // it is the width the drag started from, since a drag commits nothing until release.
  useEffect(
    () => () => {
      stopPreview();
      if (draggingRef.current) {
        targetRef.current?.style.setProperty(SIDEBAR_WIDTH_VAR, `${originRef.current.width}px`);
      }
    },
    [stopPreview, targetRef],
  );

  // Hold the resize cursor for the whole gesture, so it does not flicker into a text caret
  // whenever the pointer outruns the handle and crosses the memo list.
  useEffect(() => {
    if (!dragging) return;
    const { body } = document;
    const previousCursor = body.style.cursor;
    const previousUserSelect = body.style.userSelect;
    body.style.cursor = "col-resize";
    body.style.userSelect = "none";
    return () => {
      body.style.cursor = previousCursor;
      body.style.userSelect = previousUserSelect;
    };
  }, [dragging]);

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    originRef.current = { x: event.clientX, width };
    pendingRef.current = width;
    draggingRef.current = true;
    setDragging(true);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    // Track the delta rather than the raw cursor x, so grabbing anywhere in the strip
    // does not snap the rail's edge to the pointer.
    previewWidth(clamp(originRef.current.width + event.clientX - originRef.current.x));
  };

  const endDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    stopPreview();
    draggingRef.current = false;
    setDragging(false);
    onWidthChange(pendingRef.current);
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const next =
      event.key === "ArrowLeft"
        ? width - KEYBOARD_STEP
        : event.key === "ArrowRight"
          ? width + KEYBOARD_STEP
          : event.key === "Home"
            ? minWidth
            : event.key === "End"
              ? maxWidth
              : undefined;
    if (next === undefined) return;
    event.preventDefault();
    onWidthChange(next);
  };

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={t("common.resize-sidebar")}
      aria-valuenow={width}
      aria-valuemin={minWidth}
      aria-valuemax={maxWidth}
      tabIndex={0}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onDoubleClick={() => onWidthChange(SIDEBAR_DEFAULT_WIDTH)}
      onKeyDown={handleKeyDown}
      className="group absolute inset-y-0 -right-1 z-10 flex w-2 cursor-col-resize touch-none justify-center focus-visible:outline-none"
    >
      {/* A 2px band centering to whole pixels inside the 8px strip, so it covers the rail's
          border and stays crisp at 1x instead of antialiasing across a half-pixel seam. */}
      <div
        className={cn(
          "h-full w-0.5 transition-colors",
          dragging ? "bg-primary/70" : "bg-transparent group-hover:bg-border group-focus-visible:bg-primary/70",
        )}
      />
    </div>
  );
};

export default SidebarResizeHandle;
