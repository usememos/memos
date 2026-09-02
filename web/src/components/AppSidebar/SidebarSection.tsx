import type { ReactNode } from "react";
import SidebarSectionHeader from "./SidebarSectionHeader";

export const SIDEBAR_SECTION_STACK_CLASSES = "flex flex-col gap-3";
export const SIDEBAR_SECTION_CONTENT_CLASSES = "flex flex-col gap-0.5";
export const SIDEBAR_SECTION_ACTION_BUTTON_CLASSES =
  "size-6 rounded text-muted-foreground/65 transition-colors hover:bg-sidebar-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/50";
// Surface-free on purpose: in the rail a fill means a selected row, and a mode toggle is not one.
export const SIDEBAR_SECTION_ACTION_ACTIVE_CLASSES = "text-foreground";
export const SIDEBAR_SECTION_ACTION_ICON_CLASSES = "size-3.5";

interface Props {
  label?: ReactNode;
  ariaLabel?: string;
  children: ReactNode;
  action?: ReactNode;
}

const SidebarSection = ({ label, ariaLabel, children, action }: Props) => (
  <section className="w-full" aria-label={ariaLabel}>
    {label !== undefined && <SidebarSectionHeader action={action}>{label}</SidebarSectionHeader>}
    {/* Flex gap keeps popup focus guards from affecting the visible row rhythm. */}
    <div className={SIDEBAR_SECTION_CONTENT_CLASSES}>{children}</div>
  </section>
);

export default SidebarSection;
