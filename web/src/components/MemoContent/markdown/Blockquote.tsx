import { cn } from "@/lib/utils";
import type { ReactMarkdownProps } from "./types";

interface BlockquoteProps extends React.BlockquoteHTMLAttributes<HTMLQuoteElement>, ReactMarkdownProps {
  children: React.ReactNode;
}

/**
 * Blockquote component with left border accent
 */
export const Blockquote = ({ children, className, node: _node, ...props }: BlockquoteProps) => {
  return (
    <blockquote className={cn("my-0 mb-2 border-l-4 border-primary/30 pl-3 text-muted-foreground italic", className)} {...props}>
      {children}
    </blockquote>
  );
};
