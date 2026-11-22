import type { ReactNode } from "react";
import SidebarSectionHeader from "./SidebarSectionHeader";

// 16px between sections: with the header on a 28px row box, a section break is clearly more than a row gap.
export const SIDEBAR_SECTION_STACK_CLASSES = "flex flex-col gap-4";
export const SIDEBAR_SECTION_CONTENT_CLASSES = "flex flex-col gap-0.5";

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
