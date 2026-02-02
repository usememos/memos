import { cn } from "@/lib/utils";
import type { ReactMarkdownProps } from "./types";

interface ParagraphProps extends React.HTMLAttributes<HTMLParagraphElement>, ReactMarkdownProps {
  children: React.ReactNode;
}

/**
 * Paragraph component with compact spacing
 */
export const Paragraph = ({ children, className, node: _node, ...props }: ParagraphProps) => {
  return (
    <p className={cn("my-0 mb-2 leading-6", className)} {...props}>
      {children}
    </p>
  );
};
