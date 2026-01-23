import { cn } from "@/lib/utils";
import type { ReactMarkdownProps } from "./types";

interface ImageProps extends React.ImgHTMLAttributes<HTMLImageElement>, ReactMarkdownProps {}

/**
 * Image component for markdown images
 * Responsive with rounded corners
 */
export const Image = ({ className, alt, node: _node, ...props }: ImageProps) => {
  return <img className={cn("max-w-full h-auto rounded-lg my-2", className)} alt={alt} {...props} />;
};
