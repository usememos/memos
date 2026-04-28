import { ChevronDown, ChevronUp, SparklesIcon } from "lucide-react";
import { memo, useCallback, useMemo, useState } from "react";
import { useMemoFilterContext } from "@/contexts/MemoFilterContext";
import { cn } from "@/lib/utils";
import { useTranslate } from "@/utils/i18n";
import { extractMentionUsernames } from "@/utils/remark-plugins/remark-mention";
import { shouldUseSearchSnippet } from "@/utils/rehype-plugins/rehype-search-snippet";
import { COMPACT_MODE_CONFIG } from "./constants";
import { useCompactLabel, useCompactMode } from "./hooks";
import { MemoMarkdownRenderer } from "./MemoMarkdownRenderer";
import { useResolvedMentionUsernames } from "./MentionResolutionContext";
import type { MemoContentProps } from "./types";

const MemoContent = (props: MemoContentProps) => {
  const { className, contentClassName, content, onClick, onDoubleClick } = props;
  const t = useTranslate();
  const {
    containerRef: memoContentContainerRef,
    mode: showCompactMode,
    toggle: toggleCompactMode,
  } = useCompactMode(Boolean(props.compact));
  const mentionUsernames = useMemo(() => extractMentionUsernames(content), [content]);
  const resolvedMentionUsernames = useResolvedMentionUsernames(mentionUsernames);
  const { getFiltersByFactor } = useMemoFilterContext();
  const [showFullContent, setShowFullContent] = useState(false);

  const searchKeywords = useMemo(() => {
    const contentSearchFilters = getFiltersByFactor("contentSearch");
    return contentSearchFilters.map((filter) => filter.value);
  }, [getFiltersByFactor]);

  const hasSearchKeywords = searchKeywords.length > 0;

  const shouldUseSnippet = useMemo(() => {
    if (!hasSearchKeywords || showFullContent) return false;
    return shouldUseSearchSnippet({ content, keywords: searchKeywords, thresholdChars: 400 });
  }, [content, searchKeywords, hasSearchKeywords, showFullContent]);

  const toggleShowFullContent = useCallback(() => {
    setShowFullContent((prev) => !prev);
  }, []);

  const compactLabel = useCompactLabel(showCompactMode, t as (key: string) => string);

  const effectiveCompactMode = shouldUseSnippet ? undefined : showCompactMode;

  return (
    <div className={`w-full flex flex-col justify-start items-start text-foreground ${className || ""}`}>
      {shouldUseSnippet && (
        <div className="flex items-center gap-1 mb-1.5 text-xs text-muted-foreground">
          <SparklesIcon className="w-3 h-3" />
          <span>{t("memo.showing-search-matches") || "Showing search matches"}</span>
        </div>
      )}
      <div
        ref={memoContentContainerRef}
        data-memo-content
        className={cn(
          "relative w-full max-w-full wrap-break-word text-base leading-6",
          "[&>*:last-child]:mb-0",
          "[&_.katex-display]:max-w-full",
          "[&_.katex-display]:overflow-x-auto",
          "[&_.katex-display]:overflow-y-hidden",
          effectiveCompactMode === "ALL" && "overflow-hidden",
          contentClassName,
        )}
        style={effectiveCompactMode === "ALL" ? { maxHeight: `${COMPACT_MODE_CONFIG.maxHeightVh}vh` } : undefined}
        onMouseUp={onClick}
        onDoubleClick={onDoubleClick}
      >
        <MemoMarkdownRenderer
          content={content}
          resolvedMentionUsernames={resolvedMentionUsernames}
          searchKeywords={searchKeywords.length > 0 ? searchKeywords : undefined}
          useSearchSnippet={shouldUseSnippet}
        />
        {effectiveCompactMode === "ALL" && (
          <div
            className={cn(
              "absolute inset-x-0 bottom-0 pointer-events-none",
              COMPACT_MODE_CONFIG.gradientHeight,
              "bg-linear-to-t from-background from-0% via-background/60 via-40% to-transparent to-100%",
            )}
          />
        )}
      </div>
      {(showCompactMode !== undefined || shouldUseSnippet) && (
        <div className="relative w-full mt-2 flex flex-row items-center gap-3">
          {shouldUseSnippet && (
            <button
              type="button"
              className="group inline-flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              onClick={toggleShowFullContent}
            >
              {showFullContent ? (
                <>
                  <ChevronUp className="w-3 h-3" />
                  <span>{t("memo.show-search-matches") || "Show matching content only"}</span>
                </>
              ) : (
                <>
                  <ChevronDown className="w-3 h-3" />
                  <span>{t("memo.show-full-content") || "Show full content"}</span>
                </>
              )}
            </button>
          )}
          {showCompactMode !== undefined && !shouldUseSnippet && (
            <button
              type="button"
              className="group inline-flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              onClick={toggleCompactMode}
            >
              <span>{compactLabel}</span>
              {showCompactMode === "ALL" ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default memo(MemoContent);
