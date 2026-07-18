import { LucideIcon } from "lucide-react";
import React from "react";
import { cn } from "@/lib/utils";

interface SectionMenuItemProps {
  text: string;
  icon: LucideIcon;
  href: string;
  isSelected: boolean;
}

const SectionMenuItem: React.FC<SectionMenuItemProps> = ({ text, icon: IconComponent, href, isSelected }) => {
  return (
    <a
      href={href}
      aria-current={isSelected ? "page" : undefined}
      className={cn(
        "flex w-full min-w-0 items-center gap-2 rounded-md px-2 py-1 text-[13px] leading-5 transition-colors",
        isSelected ? "bg-accent font-medium text-foreground" : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
      )}
    >
      <IconComponent className={cn("size-3.5 shrink-0", isSelected ? "opacity-80" : "opacity-60")} />
      <span className="truncate">{text}</span>
    </a>
  );
};

export default SectionMenuItem;
