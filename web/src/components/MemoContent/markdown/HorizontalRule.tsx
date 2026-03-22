import { cn } from "@/lib/utils";
import type { ReactMarkdownProps } from "./types";

interface HorizontalRuleProps extends React.HTMLAttributes<HTMLHRElement>, ReactMarkdownProps {}

/**
 * Horizontal rule separator
 */
export const HorizontalRule = ({ className, node: _node, ...props }: HorizontalRuleProps) => {
  return <hr className={cn("my-2 h-0 border-0 border-b border-border", className)} {...props} />;
};
