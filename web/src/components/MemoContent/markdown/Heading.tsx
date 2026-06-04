import { cn } from "@/lib/utils";
import type { ReactMarkdownProps } from "./types";

interface HeadingProps extends React.HTMLAttributes<HTMLHeadingElement>, ReactMarkdownProps {
  level: 1 | 2 | 3 | 4 | 5 | 6;
  children: React.ReactNode;
}

/**
 * Get text content from React children recursively.
 */
function getTextContent(children: React.ReactNode): string {
  if (typeof children === "string") return children;
  if (typeof children === "number") return String(children);
  if (Array.isArray(children)) return children.map(getTextContent).join("");
  if (children && typeof children === "object" && "props" in children) {
    return getTextContent((children.props as { children?: React.ReactNode }).children ?? "");
  }
  return "";
}

/**
 * Slugify a string into a URL-friendly anchor ID.
 */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Heading component for h1-h6 elements.
 * Renders semantic heading levels with consistent styling.
 * Includes slug-based ID for anchor navigation.
 */
export const Heading = ({ level, children, className, node: _node, ...props }: HeadingProps) => {
  const Component = `h${level}` as const;

  const levelClasses = {
    1: "text-3xl font-bold border-b border-border pb-2",
    2: "text-2xl font-semibold border-b border-border pb-1.5",
    3: "text-xl font-semibold",
    4: "text-lg font-semibold",
    5: "text-base font-semibold",
    6: "text-base font-medium text-muted-foreground",
  };

  const text = getTextContent(children);
  const slug = slugify(text);

  return (
    <Component id={slug} className={cn("mt-3 mb-2 leading-tight", levelClasses[level], className)} {...props}>
      {children}
    </Component>
  );
};
