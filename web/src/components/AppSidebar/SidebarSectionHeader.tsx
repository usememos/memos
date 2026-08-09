import type { ReactNode } from "react";

interface Props {
  children: ReactNode;
  action?: ReactNode;
}

const SidebarSectionHeader = ({ children, action }: Props) => (
  <div className="mb-0.5 flex h-5 min-w-0 items-center justify-between gap-2">
    <h2 className="min-w-0 truncate ps-2 text-2xs font-normal uppercase tracking-wide text-muted-foreground/55 select-none">{children}</h2>
    {action}
  </div>
);

export default SidebarSectionHeader;
