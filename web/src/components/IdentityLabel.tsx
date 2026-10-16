import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const TEXT_SCALE = { sm: "text-base", md: "text-lg", lg: "text-2xl", hero: "text-[2rem]" } as const;

interface Props {
  mark: ReactNode;
  label: string;
  size?: keyof typeof TEXT_SCALE;
  collapsed?: boolean;
  wrap?: boolean;
  className?: string;
}

/** Shared mark and name typography for navigation and page branding. */
const IdentityLabel = ({ mark, label, size = "md", collapsed, wrap, className }: Props) => (
  <span
    className={cn("flex min-w-0 items-center text-foreground", size === "hero" ? "gap-3" : size === "lg" ? "gap-2.5" : "gap-2", className)}
  >
    {mark}
    {!collapsed && (
      <span
        className={cn("min-w-0", wrap ? "wrap-anywhere" : "truncate", TEXT_SCALE[size], "font-normal leading-[1.25] tracking-[-0.025em]")}
        style={{ fontFamily: 'Georgia, "Times New Roman", Times, serif' }}
      >
        {label}
      </span>
    )}
  </span>
);

export default IdentityLabel;
