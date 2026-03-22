import { cn } from "@/lib/utils";
import type { ReactMarkdownProps } from "./types";

interface LinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement>, ReactMarkdownProps {
  children: React.ReactNode;
}

/**
 * Link component for external links
 * Opens in new tab with security attributes
 */
export const Link = ({ children, className, href, node: _node, ...props }: LinkProps) => {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "text-primary underline decoration-primary/50 underline-offset-2 transition-colors hover:decoration-primary",
        className,
      )}
      {...props}
    >
      {children}
    </a>
  );
};
