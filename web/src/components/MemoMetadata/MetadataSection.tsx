import type { LucideIcon } from "lucide-react";
import type { PropsWithChildren, Ref } from "react";
import { cn } from "@/lib/utils";
import SectionHeader, { type SectionHeaderTab } from "./SectionHeader";

interface MetadataSectionProps extends PropsWithChildren {
  icon: LucideIcon;
  title: string;
  count: number;
  tabs?: SectionHeaderTab[];
  className?: string;
  contentClassName?: string;
  rootRef?: Ref<HTMLDivElement>;
}

const MetadataSection = ({ icon, title, count, tabs, className, contentClassName, rootRef, children }: MetadataSectionProps) => {
  return (
    <div ref={rootRef} className={cn("w-full overflow-hidden rounded-lg border border-border bg-muted/20", className)}>
      <SectionHeader icon={icon} title={title} count={count} tabs={tabs} />
      <div className={contentClassName}>{children}</div>
    </div>
  );
};

export default MetadataSection;
