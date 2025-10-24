/**
 * Custom link component for react-markdown wikilinks
 *
 * Handles [[wikilink]] rendering with custom styling and click behavior.
 * The remark-wiki-link plugin converts [[target]] to anchor elements.
 */

interface WikiLinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  href?: string;
  children?: React.ReactNode;
}

export const WikiLink: React.FC<WikiLinkProps> = ({ href, children, ...props }) => {
  // Check if this is a wikilink (remark-wiki-link adds specific href pattern)
  const isWikiLink = href?.startsWith("#/wiki/") || props.className?.includes("wikilink");

  if (isWikiLink) {
    // Extract target from href or data attribute
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
  }

  // Regular link - render normally with external link styling
  const isExternal = href?.startsWith("http://") || href?.startsWith("https://");

  return (
    <a
      {...props}
      href={href}
      className="text-primary hover:opacity-80 transition-colors underline"
      target={isExternal ? "_blank" : undefined}
      rel={isExternal ? "noopener noreferrer" : undefined}
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </a>
  );
};
