import React from "react";

/**
 * Default link component for regular markdown links
 *
 * Handles external links with proper target and rel attributes.
 */

interface DefaultLinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  node?: any; // AST node from react-markdown
  href?: string;
  children?: React.ReactNode;
}

export const DefaultLink: React.FC<DefaultLinkProps> = ({ href, children, ...props }) => {
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
