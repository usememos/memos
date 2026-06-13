import { markdownStyles } from "@/lib/markdownStyles";
import { cn } from "@/lib/utils";
import { NestedMarkdownRenderContext } from "../MarkdownRenderContext";
import type { ReactMarkdownProps } from "./types";

interface BlockquoteProps extends React.BlockquoteHTMLAttributes<HTMLQuoteElement>, ReactMarkdownProps {
  children: React.ReactNode;
}

/**
 * Blockquote component with left border accent
 */
export const Blockquote = ({ children, className, node: _node, ...props }: BlockquoteProps) => {
  return (
    <blockquote className={cn(markdownStyles.blockquote, className)} {...props}>
      <NestedMarkdownRenderContext>{children}</NestedMarkdownRenderContext>
    </blockquote>
  );
};
