import type { ReactNode } from "react";

interface Props {
  children: ReactNode;
  action?: ReactNode;
}

const SidebarSectionHeader = ({ children, action }: Props) => (
  // The header sits on the same 28px box as a row, so every list keeps one 30px pitch. Its
  // 20px action ends 16px from the edge, centred on the rail's action axis (see sidebar-layout).
  <div className="mb-0.5 flex h-7 min-w-0 items-center justify-between gap-2 pe-1">
    {/* Sentence case, one type step below the 13px medium rows it labels: it reads apart by
        size and space, not by capitals or a darker ink. */}
    <h2 className="min-w-0 truncate ps-2 mu-label-xs text-mu-text-secondary select-none">{children}</h2>
    {action}
  </div>
);

export default SidebarSectionHeader;
