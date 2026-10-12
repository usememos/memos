import { ChevronRightIcon } from "lucide-react";
import { markdownStyles } from "@/lib/markdownStyles";
import { cn } from "@/lib/utils";
import { NestedMarkdownRenderContext } from "../MarkdownRenderContext";
import type { ReactMarkdownProps } from "./types";

interface DetailsProps extends React.DetailsHTMLAttributes<HTMLDetailsElement>, ReactMarkdownProps {}
interface SummaryProps extends React.HTMLAttributes<HTMLElement>, ReactMarkdownProps {}

export const Details = ({ children, className, node: _node, ...props }: DetailsProps) => (
  <details className={cn(markdownStyles.details, className)} {...props}>
    <NestedMarkdownRenderContext>{children}</NestedMarkdownRenderContext>
  </details>
);

export const Summary = ({ children, className, node: _node, ...props }: SummaryProps) => (
  <summary className={cn(markdownStyles.summary, className)} {...props}>
    <ChevronRightIcon aria-hidden="true" className={markdownStyles.disclosureIcon} />
    {children}
  </summary>
);
