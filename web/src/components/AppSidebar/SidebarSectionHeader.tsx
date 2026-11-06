import type { ReactNode } from "react";

interface Props {
  children: ReactNode;
  action?: ReactNode;
}

const SidebarSectionHeader = ({ children, action }: Props) => (
  <div className="mb-0.5 flex h-6 min-w-0 items-center justify-between gap-2">
    {/* Sentence case at the small label weight: it reads apart from the 400-weight muted rows by
        weight and space, not by capitals or a size below the type scale. */}
    <h2 className="min-w-0 truncate ps-2 mu-label-sm text-mu-ink-muted select-none">{children}</h2>
    {action}
  </div>
);

export default SidebarSectionHeader;
