import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * The rail's row rhythm — height, type scale, radius, padding, gap. Every list in the
 * sidebar is built from this, so a row reads the same whether it is a view, a setting or
 * a tag. Split from the focus treatment because a row is not always its own focus target:
 * rows that carry a trailing control put the box on a wrapper and focus on the button
 * inside it.
 */
export const SIDEBAR_ROW_BOX_CLASSES = "group flex h-[30px] w-full min-w-0 items-center gap-2 rounded-md px-2 text-ui transition-colors";

/** Goes on whichever element in a row actually takes focus. */
export const SIDEBAR_ROW_FOCUS_CLASSES = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50";

export const SIDEBAR_ROW_CLASSES = `${SIDEBAR_ROW_BOX_CLASSES} ${SIDEBAR_ROW_FOCUS_CLASSES}`;

export const SIDEBAR_ROW_ICON_CLASSES = "size-[15px] shrink-0 opacity-75";
const SIDEBAR_ROW_COUNT_CLASSES = "text-2xs tabular-nums text-muted-foreground/60";

/**
 * The focusable body of a split row — rows whose box is a wrapper carrying other controls
 * put their label layout and focus ring here. The gap must stay equal to the box's own
 * `gap-2` or slot alignment breaks between one-control and split rows.
 */
export const SIDEBAR_ROW_LABEL_CLASSES = `flex h-full min-w-0 flex-1 items-center gap-2 text-start ${SIDEBAR_ROW_FOCUS_CLASSES}`;

/**
 * Fixed leading slot: icons and disclosures share one vertical line across every list and
 * mode. The box is 24px so a disclosure gets a real hit target, but the icon inside must
 * line up with the bare 15px icons of plain rows — the negative margins cancel the extra
 * width on both sides so slotted rows keep the same icon and label positions.
 */
export const SIDEBAR_ROW_SLOT_CLASSES = "-mx-1 flex size-6 shrink-0 items-center justify-center";

/** A slot that is itself a control (disclosure, row menu): same box plus the hover chip. */
export const SIDEBAR_ROW_SLOT_BUTTON_CLASSES = `${SIDEBAR_ROW_SLOT_CLASSES} rounded hover:bg-sidebar-accent ${SIDEBAR_ROW_FOCUS_CLASSES}`;

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
    <span className="min-w-0 flex-1 truncate text-start">{label}</span>
    {count != null && count > 0 && <span className={SIDEBAR_ROW_COUNT_RAIL_CLASSES}>{count}</span>}
    {trailing}
  </button>
);

export default SidebarRow;
