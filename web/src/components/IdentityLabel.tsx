import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** The wordmark keeps its own lettering scale: it is the brand mark set as text, not app text. */
const WORDMARK_SCALE = { sm: "text-base", md: "text-lg", lg: "text-2xl", hero: "text-[2rem]" } as const;
/**
 * Every other name is app text on the package's type scale. In navigation it leads by weight: the
 * sidebar's title is one step above its 13px labels and semibold, not a larger size.
 */
const TITLE_SCALE = { sm: "mu-label font-semibold", md: "mu-title font-semibold", lg: "mu-heading", hero: "mu-display" } as const;

interface Props {
  mark: ReactNode;
  label: string;
  size?: keyof typeof WORDMARK_SCALE;
  /** Sets the label as the brand wordmark. Only the product's own name takes it. */
  wordmark?: boolean;
  collapsed?: boolean;
  wrap?: boolean;
  className?: string;
}

/**
 * Shared mark and name layout for navigation and page branding. A place, Space, person or custom
 * instance title is a sans title. The product name follows the brand wordmark's weight and spacing
 * in the theme's serif stack; the exact face is not required.
 */
const IdentityLabel = ({ mark, label, size = "md", wordmark, collapsed, wrap, className }: Props) => (
  <span
    className={cn("flex min-w-0 items-center text-mu-text", size === "hero" ? "gap-3" : size === "lg" ? "gap-2.5" : "gap-2", className)}
  >
    {mark}
    {!collapsed && (
      <span
        className={cn(
          "min-w-0",
          wrap ? "wrap-anywhere" : "truncate",
          wordmark ? [WORDMARK_SCALE[size], "font-serif font-semibold leading-[1.25] tracking-[-0.015em]"] : TITLE_SCALE[size],
        )}
      >
        {label}
      </span>
    )}
  </span>
);

export default IdentityLabel;
