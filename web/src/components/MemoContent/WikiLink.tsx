import React from "react";

/**
 * Custom link component for react-markdown wikilinks
 *
 * Handles [[wikilink]] rendering with custom styling and click behavior.
 * The remark-wiki-link plugin converts [[target]] to anchor elements.
 *
 * Note: This component should only be used for wikilinks.
 * Regular links are handled by the default anchor element.
 */

interface WikiLinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  node?: any; // AST node from react-markdown
  href?: string;
  children?: React.ReactNode;
}

export const WikiLink: React.FC<WikiLinkProps> = ({ href, children, ...props }) => {
  // Extract target from href
  // remark-wiki-link creates hrefs like "#/wiki/target"
  const target = href?.replace("#/wiki/", "") || "";

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    e.stopPropagation();

    // TODO: Implement wikilink navigation
    // This could navigate to memo detail, show preview, etc.
    console.log("Wikilink clicked:", target);
  };

  return (
    <a
      {...props}
      href={href}
      className="wikilink text-primary hover:opacity-80 transition-colors underline"
      data-target={target}
      onClick={handleClick}
    >
      {children}
    </a>
  );
};
