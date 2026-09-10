import { Dialog } from "@base-ui/react/dialog";
import { XIcon } from "lucide-react";
import { type ReactNode, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { type PersistedWidthConfig, SidebarResizeHandle, usePersistedWidth, useSidebarWidth } from "@/components/AppSidebar";
import { buttonVariants } from "@/components/ui/button";
import useMediaQuery from "@/hooks/useMediaQuery";
import { cn } from "@/lib/utils";
import { useTranslate } from "@/utils/i18n";

/**
 * Custom property carrying the card's width. It lives on the document root, where both the card
 * and the page beside it can read it: a drag previews into it at frame rate and commits once on
 * release, so the page reflows live without a React render per frame. Tailwind cannot read this
 * constant, so the classes and `MEMO_PANEL_WIDTH_CSS` repeat the literal name.
 */
const PANEL_WIDTH_VAR = "--memo-panel-width";
/** The card's current width as a CSS expression, for pages that give way to it. */
export const MEMO_PANEL_WIDTH_CSS = `var(${PANEL_WIDTH_VAR})`;
/** The title's type, shared with hosts that show the same content inline without the card. */
export const MEMO_PANEL_TITLE_CLASS = "truncate text-base font-semibold tracking-tight text-foreground";
const ICON_CONTROL_CLASS = buttonVariants({ variant: "quiet", size: "icon-compact" });
const PANEL_DEFAULT_WIDTH = 400;
const PANEL_MIN_WIDTH = 320;
const PANEL_MAX_WIDTH = 640;
/** The gap the floating card keeps from the viewport edges, the `3` in `inset-y-3 end-3`. */
export const MEMO_PANEL_INSET = 12;
/** The bottom sheet's two heights as a share of the viewport: a peek, and nearly all of it. */
const SHEET_PEEK_SHARE = 0.45;
const SHEET_FULL_SHARE = 0.9;

export interface MemoPanelSize {
  width: number;
  height: number;
}

export interface MemoPanelProps {
  open: boolean;
  title: string;
  subtitle?: string;
  /**
   * The least the page needs beside the card at desktop widths, not counting the app sidebar or
   * the card's own insets, which the panel accounts for; it caps the shared persisted width.
   */
  reservedWidth: number;
  /** While true the panel refuses to close: a save is in flight and must not lose its host. */
  busy?: boolean;
  onClose: () => void;
  /** The surface's committed size, so the page can keep clear of it; zero while closed. */
  onSize?: (size: MemoPanelSize) => void;
  children: ReactNode;
}

/**
 * The floating surface a page opens beside its main view to read a selection of memos: a day
 * in the calendar, a place on the map. From md it is a resizable card at the end edge, non-modal
 * so the view behind stays clickable; below md it is a bottom sheet with a grab handle that
 * toggles between a peek and nearly full height. One persisted width serves every host, like
 * the sidebar's. The panel keeps showing its last content while it slides out, so a cleared
 * selection never flashes an empty state on the way.
 */
export function MemoPanel({ open, title, subtitle, reservedWidth, busy = false, onClose, onSize, children }: MemoPanelProps) {
  const t = useTranslate();
  const desktop = useMediaQuery("md");
  const ref = useRef<HTMLDivElement>(null);
  // The drag previews into the document root, where both the card and the page beside it read.
  const rootRef = useRef<HTMLElement>(document.documentElement);
  const [element, setElement] = useState<HTMLDivElement | null>(null);
  const attachPanel = useCallback((node: HTMLDivElement | null) => {
    ref.current = node;
    setElement(node);
  }, []);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const sheetShare = expanded ? SHEET_FULL_SHARE : SHEET_PEEK_SHARE;

  const { width: sidebarWidth } = useSidebarWidth();
  const widthConfig = useMemo<PersistedWidthConfig>(
    () => ({
      storageKey: "memos-memo-panel-width",
      defaultWidth: PANEL_DEFAULT_WIDTH,
      minWidth: PANEL_MIN_WIDTH,
      maxWidthFor: (viewportWidth) => Math.min(PANEL_MAX_WIDTH, viewportWidth - sidebarWidth - 2 * MEMO_PANEL_INSET - reservedWidth),
    }),
    [sidebarWidth, reservedWidth],
  );
  const { width, minWidth, maxWidth, setWidth } = usePersistedWidth(widthConfig);
  useEffect(() => {
    const root = rootRef.current;
    root.style.setProperty(PANEL_WIDTH_VAR, `${width}px`);
    return () => {
      root.style.removeProperty(PANEL_WIDTH_VAR);
    };
  }, [width]);

  // Measured once per committed change, like the sidebar's: a drag previews through the custom
  // property and commits on release, so the page hears about it once rather than per frame.
  useLayoutEffect(() => {
    if (!onSize) return;
    if (!open || !element) {
      onSize({ width: 0, height: 0 });
      return;
    }
    const rect = element.getBoundingClientRect();
    onSize({ width: rect.width, height: rect.height });
  }, [onSize, open, element, desktop, width, sheetShare]);

  // The popup stays mounted through its exit transition; keep what it was showing for the ride.
  const lastShown = useRef({ title, subtitle, children });
  if (open) lastShown.current = { title, subtitle, children };
  const shown = lastShown.current;

  return (
    <Dialog.Root
      open={open}
      modal={false}
      disablePointerDismissal
      onOpenChange={(next, details) => {
        if (!next) {
          if (busy) details.cancel();
          else onClose();
        }
      }}
    >
      <Dialog.Portal>
        <Dialog.Popup
          ref={attachPanel}
          initialFocus={scrollRef}
          aria-describedby={undefined}
          style={!desktop ? { height: `${sheetShare * 100}dvh` } : undefined}
          className={cn(
            "fixed z-30 flex min-h-0 flex-col border border-border/70 bg-background shadow-md outline-none transition-transform duration-200",
            desktop
              ? "inset-y-3 end-3 w-[var(--memo-panel-width)] rounded-xl data-starting-style:translate-x-full data-ending-style:translate-x-full"
              : "inset-x-0 bottom-0 rounded-t-2xl pb-[env(safe-area-inset-bottom)] data-starting-style:translate-y-full data-ending-style:translate-y-full",
          )}
        >
          {desktop && (
            // The rail stops short of the corners so it reads as the straight run of the card's edge.
            <div className="absolute inset-y-3 start-0 w-0">
              <SidebarResizeHandle
                width={width}
                minWidth={minWidth}
                maxWidth={maxWidth}
                onWidthChange={setWidth}
                targetRef={rootRef}
                cssVariable={PANEL_WIDTH_VAR}
                defaultWidth={PANEL_DEFAULT_WIDTH}
                edge="start"
                label={t("common.resize-panel")}
              />
            </div>
          )}
          {!desktop && (
            <button
              type="button"
              className="flex h-7 shrink-0 items-center justify-center"
              aria-label={t(expanded ? "common.collapse-panel" : "common.expand-panel")}
              onClick={() => setExpanded((value) => !value)}
            >
              <span className="h-1 w-10 rounded-full bg-muted-foreground/35" />
            </button>
          )}
          <header className="flex shrink-0 items-center gap-0.5 border-b border-border/70 py-2.5 ps-3 pe-3">
            <div className="min-w-0 flex-1">
              <Dialog.Title className={MEMO_PANEL_TITLE_CLASS}>{shown.title}</Dialog.Title>
              {shown.subtitle && <p className="truncate text-xs text-muted-foreground">{shown.subtitle}</p>}
            </div>
            <Dialog.Close disabled={busy} render={<button type="button" className={ICON_CONTROL_CLASS} aria-label={t("common.close")} />}>
              <XIcon strokeWidth={1.8} />
            </Dialog.Close>
          </header>
          <div ref={scrollRef} tabIndex={-1} className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 outline-none">
            {shown.children}
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
