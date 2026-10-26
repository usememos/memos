import type { Editor } from "@usememos/editor";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { MemoMarkdown } from "@/components/MemoEditor/MemoMarkdown";
import { createMemoNavigationState } from "@/components/MemoView/navigation";
import { useContentSearchTerms } from "@/contexts/MemoFilterContext";
import { useDevicePreferences } from "@/hooks/useDevicePreferences";
import { useNearViewport } from "@/hooks/useNearViewport";
import { markdownStyles } from "@/lib/markdownStyles";
import { cn } from "@/lib/utils";
import { getCreatorHomePath } from "@/router/routes";
import type { Attachment } from "@/types/proto/api/attachment_service_pb";
import { findAnchorTarget } from "@/utils/markdown-manipulation";
import { headingSlugs } from "./headings";
import LinkMetadataCard from "./LinkMetadataCard";
import { type LinkCardMount, linkCardsExtension } from "./linkCards";
import { useSearchMatchHighlight } from "./useSearchMatchHighlight";
import { useTagNavigation } from "./useTagNavigation";

export interface MemoContentViewProps {
  content: string;
  /** Attachments bound to this memo, used to resolve managed image URLs in share/S3 modes. */
  attachments?: readonly Attachment[];
  /** Resource name of the memo (e.g. `memos/abc123`). Lets in-memo anchor links open the memo detail page. */
  memoName?: string;
  /** Collection page that rendered the memo, preserved when an inline link opens its detail page. */
  parentPage?: string;
  /** The card renders collapsed (ClampedSection), so in-memo anchor links navigate instead of scrolling. */
  compact?: boolean;
  /**
   * Lets the viewer tick task items, for a memo they can manage. Called with the new
   * Markdown, in which only the ticked item's `[ ]` or `[x]` changed.
   */
  onTaskToggle?: (content: string) => void;
  className?: string;
  contentClassName?: string;
  onClick?: (e: React.MouseEvent) => void;
  onDoubleClick?: (e: React.MouseEvent) => void;
}

const LinkPreview = ({ href }: { href: string }) => {
  const { ref, isNearViewport } = useNearViewport<HTMLAnchorElement>();
  const fallback = (
    <a ref={ref} href={href} target="_blank" rel="noopener noreferrer" className={markdownStyles.link}>
      {href}
    </a>
  );
  return <LinkMetadataCard url={href} fallback={fallback} enabled={isNearViewport} />;
};

/** A mounted card, keyed for React: the element is the editor's, so the key cannot be derived from the block. */
interface LinkCard extends LinkCardMount {
  readonly key: number;
}
let nextLinkCardKey = 0;

/**
 * A memo's content, read-only, with the memo view's own surface over MemoMarkdown: tags and
 * mentions navigate, in-memo anchors scroll, bare links become preview cards, and the page's
 * search matches are painted. Owners can tick task items: each tick reports the new Markdown,
 * in which only that item's `[ ]` or `[x]` changed. Truncation is not this component's
 * concern — compact cards are bounded by ClampedSection around the whole memo body;
 * `compact` only tells in-memo anchor links to open the detail page, since a collapsed card
 * may hide their target. MemoEditor shows a memo by name through it; previews pass content.
 */
const MemoContentViewImpl = (props: MemoContentViewProps) => {
  const { className, contentClassName, content, attachments, memoName, parentPage, compact, onTaskToggle, onClick, onDoubleClick } = props;
  const navigate = useNavigate();
  const { linkPreview: linkPreviewEnabled } = useDevicePreferences();
  const navigateToTag = useTagNavigation(parentPage);
  // Whatever the page's search matched is painted here, without altering the rendered tree.
  const contentRef = useRef<HTMLDivElement>(null);
  useSearchMatchHighlight(contentRef, useContentSearchTerms());
  const [editor, setEditor] = useState<Editor | null>(null);

  // Bare links become preview cards through the editor's block view: it hands over an
  // element per such paragraph and keeps it while the block is unchanged, so the card
  // portaled into it survives renders. Built once; the setting is read through a ref and
  // applied with a refresh of this view.
  const [cards, setCards] = useState<readonly LinkCard[]>([]);
  const linkPreviewEnabledRef = useRef(linkPreviewEnabled);
  linkPreviewEnabledRef.current = linkPreviewEnabled;
  const linkCards = useMemo(
    () => [
      linkCardsExtension({
        isEnabled: () => linkPreviewEnabledRef.current,
        onMount: (mount) =>
          setCards((previous) => [...previous.filter((card) => card.element !== mount.element), { ...mount, key: nextLinkCardKey++ }]),
        onUnmount: (element) => setCards((previous) => previous.filter((card) => card.element !== element)),
      }),
    ],
    [],
  );
  const appliedLinkPreview = useRef(linkPreviewEnabled);
  useEffect(() => {
    if (appliedLinkPreview.current === linkPreviewEnabled) return;
    appliedLinkPreview.current = linkPreviewEnabled;
    editor?.refreshViews("linkCards");
  }, [editor, linkPreviewEnabled]);

  // In-memo anchors scroll within this memo; a collapsed card may hide the target, so it opens the detail page.
  const handleLinkClick = ({ href }: { href: string }) => {
    if (!href.startsWith("#")) return false;
    const id = decodeURIComponent(href.slice(1));
    const target = !compact && id && contentRef.current ? findAnchorTarget(contentRef.current, id) : null;
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "center" });
    } else if (memoName) {
      navigate(`/${memoName}${href}`, { state: parentPage ? createMemoNavigationState(parentPage) : undefined });
    }
    return true;
  };

  return (
    <div className={`w-full flex flex-col justify-start items-start text-foreground ${className || ""}`}>
      <div
        ref={contentRef}
        data-memo-content
        data-memo-name={memoName}
        className={cn(
          "relative w-full max-w-full wrap-break-word text-base leading-6",
          "[&_.katex-display]:max-w-full",
          "[&_.katex-display]:overflow-x-auto",
          "[&_.katex-display]:overflow-y-hidden",
          contentClassName,
        )}
        onMouseUp={onClick}
        onDoubleClick={onDoubleClick}
      >
        <MemoMarkdown
          editorRef={setEditor}
          value={content}
          onChange={onTaskToggle}
          taskToggle={Boolean(onTaskToggle)}
          toolbar={false}
          slashMenu={false}
          attachments={attachments}
          extensions={linkCards}
          headingIds={headingSlugs}
          onLinkClick={handleLinkClick}
          // Tags filter the list when clicked here; mentions of people who exist open their page.
          onTagClick={navigateToTag}
          onMentionClick={(username) => navigate(getCreatorHomePath(username))}
          className="memo-content-root"
        />
        {cards.map((card) => createPortal(<LinkPreview href={card.href} />, card.element, String(card.key)))}
      </div>
    </div>
  );
};

export const MemoContentView = memo(MemoContentViewImpl);
