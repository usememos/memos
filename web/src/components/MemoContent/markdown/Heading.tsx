import { cn } from "@/lib/utils";
import type { ReactMarkdownProps } from "./types";

interface HeadingProps extends React.HTMLAttributes<HTMLHeadingElement>, ReactMarkdownProps {
  level: 1 | 2 | 3 | 4 | 5 | 6;
  children: React.ReactNode;
}

/**
 * Heading component for h1-h6 elements
 * Renders semantic heading levels with consistent styling
 */
export const Heading = ({ level, children, className, node: _node, ...props }: HeadingProps) => {
  const Component = `h${level}` as const;

  const levelClasses = {
    1: "text-3xl font-bold border-b border-border pb-1",
    2: "text-2xl border-b border-border pb-1",
    3: "text-xl",
    4: "text-base",
    5: "text-sm",
    6: "text-sm text-muted-foreground",
  };

  return (
    <Component className={cn("mt-3 mb-2 font-semibold leading-tight", levelClasses[level], className)} {...props}>
      {children}
    </Component>
  );
};
