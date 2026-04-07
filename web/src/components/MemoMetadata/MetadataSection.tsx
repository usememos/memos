import type { LucideIcon } from "lucide-react";
import type { PropsWithChildren } from "react";
import { cn } from "@/lib/utils";
import SectionHeader, { type SectionHeaderTab } from "./SectionHeader";

interface MetadataSectionProps extends PropsWithChildren {
  icon: LucideIcon;
  title: string;
  count: number;
  tabs?: SectionHeaderTab[];
  className?: string;
  contentClassName?: string;
}

const MetadataSection = ({ icon, title, count, tabs, className, contentClassName, children }: MetadataSectionProps) => {
  return (
    <div className={cn("w-full overflow-hidden rounded-lg border border-border bg-muted/20", className)}>
      <SectionHeader icon={icon} title={title} count={count} tabs={tabs} />
      <div className={contentClassName}>{children}</div>
    </div>
  );
};

export default MetadataSection;
