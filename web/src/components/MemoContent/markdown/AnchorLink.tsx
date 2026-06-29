import { Link } from "react-router-dom";
import { markdownStyles } from "@/lib/markdownStyles";
import { cn } from "@/lib/utils";
import type { ReactMarkdownProps } from "./types";

interface AnchorLinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement>, ReactMarkdownProps {
  href: string;
  /** Resource name of the enclosing memo (e.g. `memos/abc123`), when known. */
  memoName?: string;
  /** Whether the memo is rendered as a collapsed feed card. */
  compact?: boolean;
  children: React.ReactNode;
}

/**
 * Renders in-page anchors (footnote references/backrefs, heading links — any `href="#…"`).
 *
 * When the target lives in a fully-rendered memo (detail, share, preview, expanded feed card),
 * we scroll to it within that memo's own container — scoped so duplicate footnote ids across a
 * feed can't send us to the wrong memo. When the memo is a collapsed feed card the footnote is
 * below the fold, so we fall back to navigating to the memo detail page (with the hash), where
 * MemoDetail scrolls the target into view.
 */
export const AnchorLink = ({ href, memoName, compact, children, className, node: _node, ...props }: AnchorLinkProps) => {
  const handleClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (compact) return; // Let the link navigate to the detail page.
    const id = decodeURIComponent(href.slice(1));
    if (!id) return;
    // Scope the lookup to this memo's own container so duplicate footnote ids elsewhere in a feed
    // can't steal the scroll.
    const root = event.currentTarget.closest("[data-memo-content]");
    const target = root?.querySelector(`#${CSS.escape(id)}`);
    if (target) {
      event.preventDefault();
      target.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  const classes = cn(markdownStyles.link, className);

  if (memoName) {
    return (
      <Link to={`/${memoName}${href}`} onClick={handleClick} className={classes} {...props}>
        {children}
      </Link>
    );
  }

  return (
    <a href={href} onClick={handleClick} className={classes} {...props}>
      {children}
    </a>
  );
};
