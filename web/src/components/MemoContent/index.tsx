import type { Editor } from "@usememos/editor";
import { MarkdownEditor } from "@usememos/editor/react";
import "@usememos/editor/style.css";
import { memo, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useContentSearchTerms } from "@/contexts/MemoFilterContext";
import { useLinkPreviewEnabled } from "@/contexts/ViewContext";
import { useNearViewport } from "@/hooks/useNearViewport";
import { markdownStyles } from "@/lib/markdownStyles";
import {
  MEMO_EDITOR_THEME,
  MEMO_MARKDOWN,
  memoEditorLabels,
  memoExtensions,
  memoMentionOptions,
  memoResolveUrl,
  memoTagOptions,
} from "@/lib/memo-markdown";
import { cn } from "@/lib/utils";
import { getCreatorHomePath } from "@/router/routes";
import { useTranslate } from "@/utils/i18n";
import { findAnchorTarget } from "@/utils/markdown-manipulation";
import { createMemoNavigationState } from "../MemoView/navigation";
import { findIslands, type Island, sameIslands } from "./enhance";
import { headingSlugs } from "./headings";
import LinkMetadataCard from "./LinkMetadataCard";
import { useResolvedMentionUsernames } from "./MentionResolutionContext";
import type { MemoContentProps } from "./types";
import { useSearchMatchHighlight } from "./useSearchMatchHighlight";
import { useTagNavigation } from "./useTagNavigation";

// A memo with a Mermaid diagram draws it in the page's color scheme; the editor keeps drawn
// diagrams, so a new scheme needs a new editor to draw them again.
const MERMAID_FENCE = /^ {0,3}(?:`{3,}|~{3,})[ \t]*mermaid\b/im;
const subscribeColorScheme = (onChange: () => void) => {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["style"] });
  return () => observer.disconnect();
};
const getColorScheme = () => document.documentElement.style.colorScheme;

const LinkPreview = ({ href }: { href: string }) => {
  const { ref, isNearViewport } = useNearViewport<HTMLAnchorElement>();
  const fallback = (
    <a ref={ref} href={href} target="_blank" rel="noopener noreferrer" className={markdownStyles.link}>
      {href}
    </a>
  );
  return <LinkMetadataCard url={href} fallback={fallback} enabled={isNearViewport} />;
};

/**
 * A memo's content, shown by the same Markdown editor the composer uses, read-only. Owners
 * can tick task items: each tick reports the new Markdown, in which only that item's
 * `[ ]` or `[x]` changed. Truncation is not this component's concern — compact cards are
 * bounded by ClampedSection around the whole memo body; `compact` only tells in-memo
 * anchor links to open the detail page, since a collapsed card may hide their target.
 */
const MemoContent = (props: MemoContentProps) => {
  const { className, contentClassName, content, attachments, memoName, parentPage, compact, onTaskToggle, onClick, onDoubleClick } = props;
  const t = useTranslate();
  const navigate = useNavigate();
  const { userTagsSetting } = useAuth();
  const labels = useMemo(() => memoEditorLabels(t), [t]);
  const linkPreviewEnabled = useLinkPreviewEnabled();
  const resolvedMentionUsernames = useResolvedMentionUsernames(content);
  const navigateToTag = useTagNavigation(parentPage);
  // Whatever the page's search matched is painted here, without altering the rendered tree.
  const contentRef = useRef<HTMLDivElement>(null);
  useSearchMatchHighlight(contentRef, useContentSearchTerms());
  const [editor, setEditor] = useState<Editor | null>(null);
  const colorScheme = useSyncExternalStore(subscribeColorScheme, getColorScheme, () => "");
  const editorKey = MERMAID_FENCE.test(content) ? colorScheme : undefined;
  const [islands, setIslands] = useState<Island[]>([]);

  // Tag colors and resolved mentions come from outside the document: the decorations
  // read them here, and the editor decorates again when they change.
  const decorationState = useRef({ resolvedMentionUsernames, userTagsSetting });
  decorationState.current = { resolvedMentionUsernames, userTagsSetting };
  const extensions = useMemo(
    () =>
      memoExtensions({
        tags: memoTagOptions(() => decorationState.current.userTagsSetting),
        mentions: memoMentionOptions((username) => decorationState.current.resolvedMentionUsernames.has(username)),
      }),
    [],
  );
  // Redecorate only when what the decorations read actually changed: a new editor already
  // decorates with the current values, and a resolution that comes back equal is a no-op.
  const mentionKey = [...resolvedMentionUsernames].sort().join(" ");
  const decorated = useRef({ mentionKey, userTagsSetting });
  useEffect(() => {
    const changed = decorated.current.mentionKey !== mentionKey || decorated.current.userTagsSetting !== userTagsSetting;
    decorated.current = { mentionKey, userTagsSetting };
    if (changed) editor?.redecorate();
  }, [editor, mentionKey, userTagsSetting]);

  const resolveUrl = useMemo(() => memoResolveUrl(attachments), [attachments]);

  // Mount memos' own UI after every render of the editor's blocks: on load, on a new
  // value, and when a ticked task item or new image URLs re-render blocks.
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    const root = editor.root;
    let frame: number | null = null;
    const update = () => {
      frame = null;
      if (editor.isDestroyed) return;
      const next = findIslands(editor, root, linkPreviewEnabled);
      setIslands((previous) => (sameIslands(previous, next) ? previous : next));
    };
    update();
    const observer = new MutationObserver(() => {
      frame ??= requestAnimationFrame(update);
    });
    observer.observe(root, { childList: true });
    return () => {
      observer.disconnect();
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, [editor, content, linkPreviewEnabled, resolveUrl]);

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

  const handleClick = (event: React.MouseEvent) => {
    const target = event.target as HTMLElement;
    const tag = target.closest<HTMLElement>(".mbe-tag")?.dataset.tag;
    if (tag) {
      event.stopPropagation();
      navigateToTag(tag);
      return;
    }
    const mention = target.closest<HTMLElement>(".mbe-mention[data-resolved]")?.dataset.mention;
    if (mention) {
      event.stopPropagation();
      navigate(getCreatorHomePath(mention));
    }
  };

  return (
    <div className={`w-full flex flex-col justify-start items-start text-foreground ${className || ""}`}>
      <div
        ref={contentRef}
        data-memo-content
        data-memo-name={memoName}
        className={cn(
          "relative w-full max-w-full wrap-break-word text-base leading-6",
          // Tags filter the list when clicked here; the composer shows them the same, without the click.
          "[&_.mbe-tag]:cursor-pointer [&_.mbe-tag]:transition-opacity [&_.mbe-tag:hover]:opacity-75",
          "[&_.mbe-mention[data-resolved]]:cursor-pointer [&_.mbe-mention[data-resolved]:hover]:underline",
          "[&_.katex-display]:max-w-full",
          "[&_.katex-display]:overflow-x-auto",
          "[&_.katex-display]:overflow-y-hidden",
          contentClassName,
        )}
        onClick={handleClick}
        onMouseUp={onClick}
        onDoubleClick={onDoubleClick}
      >
        <MarkdownEditor
          key={editorKey}
          ref={setEditor}
          value={content}
          onChange={onTaskToggle}
          editable={false}
          taskToggle={Boolean(onTaskToggle)}
          toolbar={false}
          slashMenu={false}
          markdown={MEMO_MARKDOWN}
          extensions={extensions}
          theme={MEMO_EDITOR_THEME}
          labels={labels}
          resolveUrl={resolveUrl}
          referrerPolicy="no-referrer"
          headingIds={headingSlugs}
          onLinkClick={handleLinkClick}
          className="memo-content-root"
        />
        {islands.map((island) => createPortal(<LinkPreview href={island.href} />, island.target, island.key))}
      </div>
    </div>
  );
};

export default memo(MemoContent);
