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
    1: "text-3xl font-bold border-b border-border pb-2",
    2: "text-2xl font-semibold border-b border-border pb-1.5",
    3: "text-xl font-semibold",
    4: "text-lg font-semibold",
    5: "text-base font-semibold",
    6: "text-base font-medium text-muted-foreground",
  };

  return (
    <Component className={cn("mt-3 mb-2 leading-tight", levelClasses[level], className)} {...props}>
      {children}
    </Component>
  );
};
