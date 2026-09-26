import { LinkIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { memoReferenceStyles } from "@/lib/markdownStyles";
import { cn } from "@/lib/utils";
import { createMemoNavigationState } from "../../MemoView/navigation";
import type { ReactMarkdownProps } from "./types";

interface MemoReferenceLinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement>, ReactMarkdownProps {
  /** The reference destination, already validated as `/memos/<uid>`. */
  href: string;
  /** Collection page that rendered the enclosing memo, so Back returns to it. */
  parentPage?: string;
  children: React.ReactNode;
}

/**
 * An inline reference to another memo. It is an ordinary Markdown link in the
 * source; here it renders as a chip so a reference reads as one word inside the
 * sentence instead of as a link to somewhere else, and it routes in-app rather
 * than opening a tab.
 */
export const MemoReferenceLink = ({ href, parentPage, children, className, node: _node, ...props }: MemoReferenceLinkProps) => (
  <Link
    to={href}
    state={parentPage ? createMemoNavigationState(parentPage) : undefined}
    className={cn(memoReferenceStyles.base, className)}
    data-memo-reference={href}
    {...props}
  >
    <LinkIcon className="size-[0.85em] shrink-0" strokeWidth={2.2} />
    <span className="truncate">{children}</span>
  </Link>
);
