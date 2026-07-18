import React, { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface SectionChipProps {
  text: string;
  href: string;
  isSelected: boolean;
}

/** Compact pill counterpart of SectionMenuItem, for the horizontal strip on narrow screens. */
const SectionChip: React.FC<SectionChipProps> = ({ text, href, isSelected }) => {
  const chipRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    if (isSelected) {
      chipRef.current?.scrollIntoView({ inline: "center", block: "nearest" });
    }
  }, [isSelected]);

  return (
    <a
      ref={chipRef}
      href={href}
      aria-current={isSelected ? "page" : undefined}
      className={cn(
        "shrink-0 whitespace-nowrap rounded-full border px-3 py-1 text-[13px] leading-5 transition-colors",
        isSelected
          ? "border-transparent bg-accent font-medium text-foreground"
          : "border-border/70 text-muted-foreground hover:bg-accent/60 hover:text-foreground",
      )}
    >
      {text}
    </a>
  );
};

export default SectionChip;
