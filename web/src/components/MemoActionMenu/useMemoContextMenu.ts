import type { Menu } from "@usememos/ui";
import { type RefObject, useEffect, useState } from "react";

const NATIVE_TARGETS = [
  "a, button, input, textarea, select, label, summary, img, audio, video, iframe",
  '[role="button"], [role="link"], [role="checkbox"], [contenteditable="true"], [data-mention][data-resolved]',
].join(", ");

function isOverSelection(event: PointerEvent, selection: Selection | null) {
  if (!selection || selection.isCollapsed) return false;
  for (let i = 0; i < selection.rangeCount; i++) {
    for (const rect of selection.getRangeAt(i).getClientRects()) {
      if (event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom) {
        return true;
      }
    }
  }
  return false;
}

export function useMemoContextMenu(cardRef?: RefObject<HTMLElement | null>) {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<Menu.PopupProps["anchor"]>();

  useEffect(() => {
    const card = cardRef?.current;
    if (!card) return;

    // Some browsers select the word under the pointer before firing contextmenu.
    // Only a selection the reader already made should claim the secondary click.
    let useMemoMenu = false;
    const onPointerDown = (event: PointerEvent) => {
      useMemoMenu =
        event.pointerType !== "touch" &&
        (event.button === 2 || (event.button === 0 && event.ctrlKey)) &&
        !isOverSelection(event, card.ownerDocument.getSelection());
    };
    const onContextMenu = (event: MouseEvent) => {
      const eligible = useMemoMenu;
      useMemoMenu = false;
      if (!eligible || event.defaultPrevented || !(event.target instanceof Element) || event.target.closest(NATIVE_TARGETS)) return;

      event.preventDefault();
      const bounds = card.getBoundingClientRect();
      const x = event.clientX - bounds.left;
      const y = event.clientY - bounds.top;
      setAnchor({
        contextElement: card,
        getBoundingClientRect() {
          const { left, top } = card.getBoundingClientRect();
          return new DOMRect(left + x, top + y, 0, 0);
        },
      });
      setOpen(true);
    };
    card.addEventListener("pointerdown", onPointerDown);
    card.addEventListener("contextmenu", onContextMenu);
    return () => {
      card.removeEventListener("pointerdown", onPointerDown);
      card.removeEventListener("contextmenu", onContextMenu);
    };
  }, [cardRef]);

  const onOpenChange: Menu.RootProps["onOpenChange"] = (nextOpen, details) => {
    if (nextOpen) setAnchor(undefined);
    if (!nextOpen && anchor && (details.reason === "escape-key" || details.reason === "item-press")) {
      cardRef?.current?.focus({ preventScroll: true });
    }
    setOpen(nextOpen);
  };

  return { open, onOpenChange, anchor };
}
