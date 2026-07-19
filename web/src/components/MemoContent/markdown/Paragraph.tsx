import type { Element } from "hast";
import { useLinkPreviewEnabled } from "@/contexts/ViewContext";
import { useNearViewport } from "@/hooks/useNearViewport";
import { markdownStyles } from "@/lib/markdownStyles";
import { cn } from "@/lib/utils";
import LinkMetadataCard from "../LinkMetadataCard";
import { useMarkdownRenderContext } from "../MarkdownRenderContext";
import type { ReactMarkdownProps } from "./types";

interface ParagraphProps extends React.HTMLAttributes<HTMLParagraphElement>, ReactMarkdownProps {
  children: React.ReactNode;
}

interface DeferredLinkPreviewProps extends React.HTMLAttributes<HTMLParagraphElement> {
  children: React.ReactNode;
  href: string;
}

export function getSingleLinkHref(node?: Element): string | undefined {
  if (!node || node.tagName !== "p") {
    return undefined;
  }

  const meaningfulChildren = node.children.filter((child) => {
    return !(child.type === "text" && child.value.trim() === "");
  });

  if (meaningfulChildren.length !== 1) {
    return undefined;
  }

  const onlyChild = meaningfulChildren[0];
  if (onlyChild.type !== "element" || onlyChild.tagName !== "a") {
    return undefined;
  }

  const href = onlyChild.properties?.href;
  if (typeof href !== "string") {
    return undefined;
  }

  const meaningfulLinkChildren = onlyChild.children.filter((child) => {
    return !(child.type === "text" && child.value.trim() === "");
  });

  if (meaningfulLinkChildren.length !== 1) {
    return undefined;
  }

  const onlyLinkChild = meaningfulLinkChildren[0];
  return onlyLinkChild.type === "text" && onlyLinkChild.value === href ? href : undefined;
}

const DeferredLinkPreview = ({ children, className, href, ...props }: DeferredLinkPreviewProps) => {
  const { ref: viewportRef, isNearViewport } = useNearViewport<HTMLParagraphElement>();
  const fallback = (
    <p ref={viewportRef} className={cn(markdownStyles.paragraph, className)} {...props}>
      {children}
    </p>
  );

  return <LinkMetadataCard url={href} fallback={fallback} enabled={isNearViewport} />;
};

export const Paragraph = ({ children, className, node, ...props }: ParagraphProps) => {
  const { blockDepth } = useMarkdownRenderContext();
  const linkPreviewEnabled = useLinkPreviewEnabled();
  const href = blockDepth === 0 && linkPreviewEnabled ? getSingleLinkHref(node) : undefined;

  if (href) {
    return (
      <DeferredLinkPreview href={href} className={className} {...props}>
        {children}
      </DeferredLinkPreview>
    );
  }

  return (
    <p className={cn(markdownStyles.paragraph, className)} {...props}>
      {children}
    </p>
  );
};
