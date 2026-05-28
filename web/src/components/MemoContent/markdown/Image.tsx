import { cn } from "@/lib/utils";
import type { ReactMarkdownProps } from "./types";

interface ImageProps extends React.ImgHTMLAttributes<HTMLImageElement>, ReactMarkdownProps {}

/**
 * Image component for markdown images
 * Responsive with rounded corners
 */
export const Image = ({ className, alt, node: _node, height, width, style, ...props }: ImageProps) => {
  return (
    <img
      className={cn("max-w-full my-2", !height && "h-auto", className)}
      alt={alt}
      style={{ height: height ? `${height}px` : undefined, width: width ? `${width}px` : undefined, ...style }}
      {...props}
    />
  );
};
