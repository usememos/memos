import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export const SIDEBAR_ROW_CLASSES =
  "group flex h-[30px] w-full min-w-0 items-center gap-2 rounded-md px-2 text-[13px] leading-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50";

export const SIDEBAR_ROW_ICON_CLASSES = "size-[15px] shrink-0 opacity-75";
export const SIDEBAR_ROW_COUNT_CLASSES = "text-[11px] tabular-nums text-muted-foreground/60";

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
    className={cn(
      SIDEBAR_ROW_CLASSES,
      active
        ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
        : "text-muted-foreground hover:bg-sidebar-accent/65 hover:text-foreground",
    )}
  >
    <Icon className={SIDEBAR_ROW_ICON_CLASSES} strokeWidth={1.8} />
    <span className="min-w-0 flex-1 truncate text-left">{label}</span>
    {count != null && count > 0 && <span className={SIDEBAR_ROW_COUNT_CLASSES}>{count}</span>}
    {trailing}
  </button>
);

export default SidebarRow;
