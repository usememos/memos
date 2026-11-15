import {
  type KeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

/** Pointer travel before a press becomes a drag, so a click stays a click. */
const DRAG_THRESHOLD_PX = 4;
/** A finger has to rest this long on a tile before it drags, so swiping still scrolls the page. */
const LONG_PRESS_MS = 350;
/** A finger that moves this far before the long press lands is scrolling. */
const LONG_PRESS_SLOP_PX = 8;
/** How long items take to slide aside, and the lifted copy to settle into its slot. */
const MOTION_MS = 180;
const MOTION_EASING = "cubic-bezier(0.2, 0.9, 0.3, 1)";

const prefersReducedMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

interface Pending {
  index: number;
  pointerId: number;
  x: number;
  y: number;
  /** Where the press landed inside the item, so the lifted copy stays under the pointer at that spot. */
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
  /** Touch on a tile: dragging starts after a long press instead of after movement. */
  longPress: boolean;
  timer?: number;
}

/** The lifted copy's size and where it starts; the hook moves it from there through `ghostRef`. */
export interface DragGrab {
  width: number;
  height: number;
  left: number;
  top: number;
}

interface Slot {
  position: number;
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** `list` with the item at `from` moved to `to`: the order a drag shows before it's dropped. */
export function previewOrder<T>(list: readonly T[], from: number | null, to: number | null): T[] {
  if (from === null || to === null || from === to || from >= list.length || to >= list.length) return [...list];
  const next = [...list];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

/**
 * Reorders a list by pointer or keyboard, without a drag library. While an item is dragged it
 * lifts: a copy follows the pointer (`grab` and `ghostRef`), the list shows the order it would
 * drop into (`dragging` and `over`, applied with {@link previewOrder}), the other items slide
 * aside, and the item's own place is a placeholder. Dropping settles the copy into that place and
 * calls `onMove(from, to)`. Each rendered item carries `data-reorder-position` (its place in the
 * shown order) and `data-reorder-key` (stable, for the slide); the placeholder carries
 * `data-reorder-placeholder`. Mouse and pen drag once they travel a few pixels; a finger on a tile
 * drags after a long press, and on a row only from its grip. Arrow keys on a focused handle move
 * its item by one. The click that ends a drag is swallowed, so dropping a tile doesn't preview it.
 */
export function useDragReorder(count: number, onMove: (from: number, to: number) => void) {
  const containerRef = useRef<HTMLDivElement>(null);
  const ghostRef = useRef<HTMLDivElement>(null);
  const pending = useRef<Pending | null>(null);
  const suppressClick = useRef(false);
  const settling = useRef(false);
  const [dragging, setDragging] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const [grab, setGrab] = useState<DragGrab | null>(null);
  const draggingRef = useRef<number | null>(null);
  const overRef = useRef<number | null>(null);
  // Where each item stood before the shown order last changed, for the slide.
  const snapshot = useRef<Map<string, DOMRect> | null>(null);
  // Each place in the list, relative to the container, measured when the drag starts.
  const slots = useRef<Slot[]>([]);

  const itemsIn = () => Array.from(containerRef.current?.querySelectorAll<HTMLElement>("[data-reorder-key]") ?? []);
  const takeSnapshot = () => {
    snapshot.current = new Map(itemsIn().map((element) => [element.dataset.reorderKey as string, element.getBoundingClientRect()]));
  };

  // Slide every item from where it stood to where the new order puts it. It runs after every
  // render and acts only when a move took a snapshot, so keyboard moves slide too.
  useLayoutEffect(() => {
    const before = snapshot.current;
    snapshot.current = null;
    if (!before || prefersReducedMotion()) return;
    for (const element of itemsIn()) {
      const from = before.get(element.dataset.reorderKey as string);
      if (!from) continue;
      // A slide still running ends here: `from` already caught the item mid-way, so it carries on from there.
      for (const animation of element.getAnimations?.() ?? []) animation.cancel();
      const to = element.getBoundingClientRect();
      const dx = from.left - to.left;
      const dy = from.top - to.top;
      const sx = to.width ? from.width / to.width : 1;
      const sy = to.height ? from.height / to.height : 1;
      if (dx === 0 && dy === 0 && sx === 1 && sy === 1) continue;
      element.animate(
        [
          { transformOrigin: "top left", transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})` },
          { transformOrigin: "top left", transform: "none" },
        ],
        { duration: MOTION_MS, easing: MOTION_EASING },
      );
    }
  });

  const setOverIndex = (index: number | null) => {
    if (overRef.current === index) return;
    takeSnapshot();
    overRef.current = index;
    setOver(index);
  };

  const measureSlots = () => {
    const container = containerRef.current;
    const box = container?.getBoundingClientRect();
    if (!container || !box) {
      slots.current = [];
      return;
    }
    slots.current = Array.from(container.querySelectorAll<HTMLElement>("[data-reorder-position]")).flatMap((element) => {
      const position = Number(element.dataset.reorderPosition);
      if (!Number.isInteger(position)) return [];
      const rect = element.getBoundingClientRect();
      return [
        { position, left: rect.left - box.left, top: rect.top - box.top, right: rect.right - box.left, bottom: rect.bottom - box.top },
      ];
    });
  };

  const start = (press: Pending) => {
    measureSlots();
    draggingRef.current = press.index;
    overRef.current = press.index;
    setDragging(press.index);
    setOver(press.index);
    setGrab({ width: press.width, height: press.height, left: press.x - press.offsetX, top: press.y - press.offsetY });
  };

  const clear = () => {
    draggingRef.current = null;
    overRef.current = null;
    settling.current = false;
    setDragging(null);
    setOver(null);
    setGrab(null);
  };

  // The place under the pointer, by the slots measured at the start. The items themselves won't do:
  // they move as the shown order changes and while they slide, so the item under a still pointer
  // would keep changing and the order would flip back and forth. A place stays put whichever
  // item fills it, since the layout depends only on how many items there are.
  const positionAt = (x: number, y: number): number | null => {
    const box = containerRef.current?.getBoundingClientRect();
    if (!box) return null;
    const px = x - box.left;
    const py = y - box.top;
    return slots.current.find((slot) => px >= slot.left && px < slot.right && py >= slot.top && py < slot.bottom)?.position ?? null;
  };

  const end = (commit: boolean) => {
    const from = draggingRef.current;
    const to = overRef.current;
    if (pending.current?.timer) window.clearTimeout(pending.current.timer);
    pending.current = null;
    if (from === null || settling.current) return;
    // The click that follows this pointerup, if any, arrives before the timer runs.
    suppressClick.current = true;
    window.setTimeout(() => {
      suppressClick.current = false;
    }, 0);

    const finish = () => {
      if (commit && to !== null && to !== from) onMove(from, to);
      clear();
    };
    if (!commit) {
      takeSnapshot();
      clear();
      return;
    }
    // The lifted copy settles into the placeholder, then the list takes the order it showed.
    const ghost = ghostRef.current;
    const slot = containerRef.current?.querySelector<HTMLElement>("[data-reorder-placeholder]");
    if (!ghost || !slot || prefersReducedMotion()) {
      finish();
      return;
    }
    settling.current = true;
    const target = slot.getBoundingClientRect();
    const animation = ghost.animate(
      [
        { translate: ghost.style.translate, scale: "1.03" },
        { translate: `${target.left}px ${target.top}px`, scale: "1" },
      ],
      {
        duration: MOTION_MS,
        easing: MOTION_EASING,
        fill: "forwards",
      },
    );
    // A page that paints no frames (a background tab) never finishes the animation; the timer drops anyway.
    let done = false;
    const settle = () => {
      if (done) return;
      done = true;
      finish();
    };
    animation.onfinish = settle;
    animation.oncancel = settle;
    window.setTimeout(settle, MOTION_MS + 80);
  };

  // The window listeners stay put for the whole life of the list; this keeps `onMove` current in them.
  const endDrag = useEffectEvent(end);

  useEffect(() => {
    const handleMove = (event: PointerEvent) => {
      const press = pending.current;
      if (!press || event.pointerId !== press.pointerId || settling.current) return;
      if (draggingRef.current === null) {
        const distance = Math.hypot(event.clientX - press.x, event.clientY - press.y);
        if (press.longPress) {
          if (distance > LONG_PRESS_SLOP_PX) endDrag(false);
          return;
        }
        if (distance < DRAG_THRESHOLD_PX) return;
        start(press);
      }
      if (ghostRef.current) ghostRef.current.style.translate = `${event.clientX - press.offsetX}px ${event.clientY - press.offsetY}px`;
      // The place under the pointer is where the item would drop; between places, the target stays.
      const position = positionAt(event.clientX, event.clientY);
      if (position !== null) setOverIndex(position);
    };
    const handleUp = (event: PointerEvent) => {
      if (pending.current && event.pointerId === pending.current.pointerId) endDrag(event.type === "pointerup");
    };
    const handleKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape" && draggingRef.current !== null) endDrag(false);
    };
    // Once a finger drags, the page must not scroll under it.
    const handleTouchMove = (event: TouchEvent) => {
      if (draggingRef.current !== null) event.preventDefault();
    };
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointercancel", handleUp);
    window.addEventListener("keydown", handleKey);
    window.addEventListener("touchmove", handleTouchMove, { passive: false });
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleUp);
      window.removeEventListener("keydown", handleKey);
      window.removeEventListener("touchmove", handleTouchMove);
    };
  }, []);

  /** Starts tracking a press on an item. `longPress` is for whole tiles, so touch scrolling still works. */
  const pointerDown = (index: number, options?: { longPress?: boolean }) => (event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0 || count < 2 || draggingRef.current !== null) return;
    // A press on one of the item's own controls is that control's, not a drag; the grip is the exception.
    const control = (event.target as HTMLElement).closest("button, a, [role=menuitem]");
    if (control && control !== event.currentTarget && !control.hasAttribute("data-reorder-handle")) return;
    const longPress = Boolean(options?.longPress) && event.pointerType === "touch";
    // A finger on a row scrolls the page; it drags only from the grip.
    if (event.pointerType === "touch" && !longPress && !(event.target as HTMLElement).closest("[data-reorder-handle]")) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const press: Pending = {
      index,
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      width: rect.width,
      height: rect.height,
      longPress,
    };
    if (longPress) {
      press.timer = window.setTimeout(() => {
        if (pending.current === press) start(press);
      }, LONG_PRESS_MS);
    }
    pending.current = press;
  };

  /** Arrow keys move the focused item one place earlier or later. */
  const keyDown = (index: number) => (event: KeyboardEvent<HTMLElement>) => {
    const step =
      event.key === "ArrowUp" || event.key === "ArrowLeft" ? -1 : event.key === "ArrowDown" || event.key === "ArrowRight" ? 1 : 0;
    if (step === 0) return;
    const target = index + step;
    if (target < 0 || target >= count) return;
    event.preventDefault();
    takeSnapshot();
    onMove(index, target);
  };

  /** Swallows the click that ends a drag, so dropping a tile doesn't open its preview. */
  const clickCapture = (event: ReactMouseEvent) => {
    if (!suppressClick.current) return;
    suppressClick.current = false;
    event.preventDefault();
    event.stopPropagation();
  };

  return { containerRef, ghostRef, dragging, over, grab, pointerDown, keyDown, clickCapture };
}
