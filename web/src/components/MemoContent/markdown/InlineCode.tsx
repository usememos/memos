import { cn } from "@/lib/utils";
import type { ReactMarkdownProps } from "./types";

interface InlineCodeProps extends React.HTMLAttributes<HTMLElement>, ReactMarkdownProps {
  children: React.ReactNode;
}

/**
 * Inline code component with background and monospace font
 */
export const InlineCode = ({ children, className, node: _node, ...props }: InlineCodeProps) => {
  return (
    <code className={cn("font-mono text-sm bg-muted px-1 py-0.5 rounded-md", className)} {...props}>
      {children}
    </code>
  );
};
