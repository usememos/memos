import { Dialog } from "@usememos/ui";
import type { ReactNode } from "react";
import useMediaQuery from "@/hooks/useMediaQuery";
import { cn } from "@/lib/utils";

/**
 * The dialog a drawing opens in, for viewing and editing alike. From `md` up it nearly fills
 * the window, 24px from each edge, so the memo stays in view around it; narrower, it fills the
 * screen. The drawing's paper fills it edge to edge, and the controls float on the paper.
 * One Popup with changing props, so crossing the breakpoint never remounts the canvas.
 */
export const DrawingDialogPopup = ({ label, children }: { label: string; children: ReactNode }) => {
  const isInset = useMediaQuery("md");
  return (
    <Dialog.Popup
      variant="bare"
      fullScreen={!isInset}
      sheet={false}
      aria-label={label}
      className={cn(isInset && "h-[calc(100dvh-48px)] max-h-none w-[calc(100vw-48px)] max-w-none overflow-hidden")}
    >
      {children}
    </Dialog.Popup>
  );
};

/**
 * A row of floating bars along the paper's top or bottom edge, clear of a phone's safe areas.
 * Only the bars take pointer events; the paper between them stays drawable.
 */
export const FloatingRow = ({ edge, className, children }: { edge: "top" | "bottom"; className?: string; children: ReactNode }) => (
  <div
    className={cn(
      "pointer-events-none absolute inset-x-3 flex gap-2",
      edge === "top"
        ? "top-[calc(12px+env(safe-area-inset-top))] items-center justify-between"
        : "bottom-[calc(12px+env(safe-area-inset-bottom))] justify-center",
      className,
    )}
  >
    {children}
  </div>
);

/**
 * A lone action on the paper, without a bar: the button is its own surface. Light in every
 * theme, like the paper under it.
 */
export const FloatingAction = ({ children }: { children: ReactNode }) => (
  <div data-theme="light" className="pointer-events-auto">
    {children}
  </div>
);

/**
 * A group of controls floating on the paper: one raised bar with flat controls inside, so no
 * shadow sits inside another. Light in every theme, like the paper under it.
 */
export const FloatingBar = ({ className, children }: { className?: string; children: ReactNode }) => (
  <div
    data-theme="light"
    className={cn("pointer-events-auto flex items-center gap-0.5 rounded-mu-lg bg-mu-surface p-1 shadow-mu-pop", className)}
  >
    {children}
  </div>
);
