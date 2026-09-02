import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { SIDEBAR_LEADING_SLOT_CLASSES, sidebarSurfaceVariants } from "./sidebar-layout";

/**
 * The rail's row rhythm — height, type scale, radius, padding, gap. Every list in the
 * sidebar is built from this, so a row reads the same whether it is a view, a setting or
 * a tag. Split from the focus treatment because a row is not always its own focus target:
 * rows that carry a trailing control put the box on a wrapper and focus on the button
 * inside it.
 */
export const SIDEBAR_ROW_BOX_CLASSES = `${sidebarSurfaceVariants({ role: "row" })} group transition-colors`;

/** Goes on whichever element in a row actually takes focus. */
export const SIDEBAR_ROW_FOCUS_CLASSES =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/50";

export const SIDEBAR_ROW_CLASSES = `${SIDEBAR_ROW_BOX_CLASSES} ${SIDEBAR_ROW_FOCUS_CLASSES}`;

export const SIDEBAR_ROW_ICON_CLASSES = "me-auto size-4 shrink-0 opacity-75";
const SIDEBAR_ROW_COUNT_CLASSES = "text-2xs tabular-nums text-muted-foreground/60";

/**
 * The focusable body of a split row — rows whose box is a wrapper carrying other controls
 * put their label layout and focus ring here. The gap must stay equal to the box's own
 * `gap-1` or slot alignment breaks between one-control and split rows.
 */
export const SIDEBAR_ROW_LABEL_CLASSES = `flex h-full min-w-0 flex-1 items-center gap-1 text-start ${SIDEBAR_ROW_FOCUS_CLASSES}`;

/**
 * Fixed leading slot: a 20px column begins on the artwork rail. Small glyphs pin to its
 * start while 20px marks fill it; the following 4px gap puts every first-level label on
 * the same rail without compensating margins.
 */
export const SIDEBAR_ROW_SLOT_CLASSES = SIDEBAR_LEADING_SLOT_CLASSES;

/** A slot that is itself a control (disclosure, row menu): same box plus the hover chip. */
export const SIDEBAR_ROW_SLOT_BUTTON_CLASSES = `${SIDEBAR_ROW_SLOT_CLASSES} relative rounded hover:bg-sidebar-accent after:absolute after:-inset-0.5 after:content-[''] ${SIDEBAR_ROW_FOCUS_CLASSES}`;

/** Trailing rail for counts, wide enough that digits align down the list. */
export const SIDEBAR_ROW_COUNT_RAIL_CLASSES = `${SIDEBAR_ROW_COUNT_CLASSES} min-w-[3ch] shrink-0 text-end`;

/** The standard icon-in-slot pairing, so every list renders its glyphs identically. */
export const SidebarRowIconSlot = ({ icon: Icon }: { icon: LucideIcon }) => (
  <span className={SIDEBAR_ROW_SLOT_CLASSES} aria-hidden="true">
    <Icon className={SIDEBAR_ROW_ICON_CLASSES} strokeWidth={1.8} />
  </span>
);

/** Idle and selected colouring for a row box, kept in one place so lists cannot drift apart. */
export const sidebarRowStateClasses = (active?: boolean) =>
  active
    ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
    : "text-muted-foreground hover:bg-sidebar-accent/65 hover:text-foreground";

interface Props {
  active?: boolean;
  icon?: LucideIcon;
  label: ReactNode;
  count?: number;
  onClick?: () => void;
  trailing?: ReactNode;
}

const SidebarRow = ({ active, icon: Icon, label, count, onClick, trailing }: Props) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={active || undefined}
    className={cn(SIDEBAR_ROW_CLASSES, sidebarRowStateClasses(active))}
  >
    {Icon && <SidebarRowIconSlot icon={Icon} />}
    <span data-sidebar-label className="min-w-0 flex-1 truncate text-start">
      {label}
    </span>
    {count != null && count > 0 && <span className={SIDEBAR_ROW_COUNT_RAIL_CLASSES}>{count}</span>}
    {trailing}
  </button>
);

export default SidebarRow;
