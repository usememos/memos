import { Dialog } from "@base-ui/react/dialog";
import { XIcon } from "lucide-react";
import { type CSSProperties, type ReactNode, type RefObject, useCallback, useEffect, useRef, useState } from "react";
import { type PersistedWidthConfig, SidebarResizeHandle, usePersistedWidth } from "@/components/AppSidebar";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTranslate } from "@/utils/i18n";

/** App sidebar plus enough map beside the rail to keep a selection visible. */
const RESERVED_BESIDE_PANEL = 256 + 160;
const PANEL_WIDTH_CONFIG: PersistedWidthConfig = {
  storageKey: "memos-map-panel-width",
  defaultWidth: 400,
  minWidth: 320,
  maxWidthFor: (viewportWidth) => Math.min(640, viewportWidth - RESERVED_BESIDE_PANEL),
};

interface Props {
  open: boolean;
  title: string;
  subtitle?: string;
  desktop: boolean;
  container: RefObject<HTMLElement | null>;
  busy: boolean;
  onClose: () => void;
  onSize: (size: { width: number; height: number }) => void;
  children: ReactNode;
}

export function MapPanel({ open, title, subtitle, desktop, container, busy, onClose, onSize, children }: Props) {
  const t = useTranslate();
  const ref = useRef<HTMLDivElement>(null);
  const [element, setElement] = useState<HTMLDivElement | null>(null);
  const attachPanel = useCallback((node: HTMLDivElement | null) => {
    ref.current = node;
    setElement(node);
  }, []);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const iconControlClassName = buttonVariants({ variant: "quiet", size: "icon-compact" });
  const { width, minWidth, maxWidth, setWidth } = usePersistedWidth(PANEL_WIDTH_CONFIG);
  useEffect(() => {
    if (!open || !element) {
      onSize({ width: 0, height: 0 });
      return;
    }
    const observer = new ResizeObserver(() => {
      const rect = element.getBoundingClientRect();
      onSize({ width: rect.width, height: rect.height });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [open, onSize, element]);

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
      <Dialog.Portal container={container}>
        <Dialog.Popup
          ref={attachPanel}
          initialFocus={scrollRef}
          aria-describedby={undefined}
          data-map-panel
          style={{ "--map-panel-width": `${width}px`, ...(!desktop ? { height: expanded ? "90%" : "45%" } : {}) } as CSSProperties}
          className={cn(
            "absolute z-20 flex min-h-0 flex-col border border-border/70 bg-background shadow-md outline-none transition-transform duration-200",
            desktop
              ? "inset-y-3 end-3 w-[var(--map-panel-width)] rounded-xl data-starting-style:translate-x-full data-ending-style:translate-x-full"
              : "inset-x-0 bottom-0 rounded-t-2xl pb-[env(safe-area-inset-bottom)] data-starting-style:translate-y-full data-ending-style:translate-y-full",
          )}
        >
          {desktop && (
            <SidebarResizeHandle
              width={width}
              minWidth={minWidth}
              maxWidth={maxWidth}
              onWidthChange={setWidth}
              targetRef={ref}
              cssVariable="--map-panel-width"
              defaultWidth={PANEL_WIDTH_CONFIG.defaultWidth}
              edge="start"
              label={t("map.resize-panel")}
            />
          )}
          {!desktop && (
            <button
              type="button"
              className="flex h-7 shrink-0 items-center justify-center"
              aria-label={t(expanded ? "map.collapse" : "map.expand")}
              onClick={() => setExpanded((value) => !value)}
            >
              <span className="h-1 w-10 rounded-full bg-muted-foreground/35" />
            </button>
          )}
          <header className="flex shrink-0 items-center gap-0.5 border-b border-border/70 py-2.5 ps-3 pe-3">
            <div className="min-w-0 flex-1">
              <Dialog.Title className="truncate text-base font-semibold tracking-tight text-foreground">{title}</Dialog.Title>
              {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
            </div>
            <Dialog.Close disabled={busy} render={<button type="button" className={iconControlClassName} aria-label={t("common.close")} />}>
              <XIcon strokeWidth={1.8} />
            </Dialog.Close>
          </header>
          <div ref={scrollRef} tabIndex={-1} className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 outline-none">
            {children}
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
