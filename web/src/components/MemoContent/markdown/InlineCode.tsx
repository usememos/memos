import { markdownStyles } from "@/lib/markdownStyles";
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
    <code className={cn(markdownStyles.inlineCode, className)} {...props}>
      {children}
    </code>
  );
};
