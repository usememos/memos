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
export const SIDEBAR_ROW_BOX_CLASSES =
  "group flex h-[30px] w-full min-w-0 items-center gap-2 rounded-md px-2 text-[13px] leading-[18px] transition-colors";

/** Goes on whichever element in a row actually takes focus. */
export const SIDEBAR_ROW_FOCUS_CLASSES = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50";

export const SIDEBAR_ROW_CLASSES = `${SIDEBAR_ROW_BOX_CLASSES} ${SIDEBAR_ROW_FOCUS_CLASSES}`;

export const SIDEBAR_ROW_ICON_CLASSES = "size-[15px] shrink-0 opacity-75";
export const SIDEBAR_ROW_COUNT_CLASSES = "text-[11px] tabular-nums text-muted-foreground/60";

/** Idle and selected colouring for a row box, kept in one place so lists cannot drift apart. */
export const sidebarRowStateClasses = (active?: boolean) =>
  active
    ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
    : "text-muted-foreground hover:bg-sidebar-accent/65 hover:text-foreground";

interface Props {
  active?: boolean;
  icon: LucideIcon;
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
    <Icon className={SIDEBAR_ROW_ICON_CLASSES} strokeWidth={1.8} />
    <span className="min-w-0 flex-1 truncate text-left">{label}</span>
    {count != null && count > 0 && <span className={SIDEBAR_ROW_COUNT_CLASSES}>{count}</span>}
    {trailing}
  </button>
);

export default SidebarRow;
