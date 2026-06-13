import { headingClass } from "@/lib/markdownStyles";
import { cn } from "@/lib/utils";
import type { ReactMarkdownProps } from "./types";

interface HeadingProps extends React.HTMLAttributes<HTMLHeadingElement>, ReactMarkdownProps {
  level: 1 | 2 | 3 | 4 | 5 | 6;
  children: React.ReactNode;
}

/**
 * Heading component for h1-h6 elements.
 * Renders semantic heading levels with consistent styling.
 * Anchor IDs are assigned by the rehypeHeadingId plugin.
 */
export const Heading = ({ level, children, className, node: _node, ...props }: HeadingProps) => {
  const Component = `h${level}` as const;

  return (
    <Component className={cn(headingClass(level), className)} {...props}>
      {children}
    </Component>
  );
};
