import { ChevronDown, ChevronUp } from "lucide-react";
import { memo, useMemo } from "react";
import { cn } from "@/lib/utils";
import { useTranslate } from "@/utils/i18n";
import { extractMentionUsernames } from "@/utils/remark-plugins/remark-mention";
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

  const compactLabel = useCompactLabel(showCompactMode, t as (key: string) => string);

  return (
    <div className={`w-full flex flex-col justify-start items-start text-foreground ${className || ""}`}>
      <div
        ref={memoContentContainerRef}
        data-memo-content
        className={cn(
          "relative w-full max-w-full wrap-break-word text-base leading-6",
          "[&>*:last-child]:mb-0",
          "[&_.katex-display]:max-w-full",
          "[&_.katex-display]:overflow-x-auto",
          "[&_.katex-display]:overflow-y-hidden",
          showCompactMode === "ALL" && "overflow-hidden",
          contentClassName,
        )}
        style={showCompactMode === "ALL" ? { maxHeight: `${COMPACT_MODE_CONFIG.maxHeightVh}vh` } : undefined}
        onMouseUp={onClick}
        onDoubleClick={onDoubleClick}
      >
        <MemoMarkdownRenderer content={content} resolvedMentionUsernames={resolvedMentionUsernames} />
        {showCompactMode === "ALL" && (
          <div
            className={cn(
              "absolute inset-x-0 bottom-0 pointer-events-none",
              COMPACT_MODE_CONFIG.gradientHeight,
              "bg-linear-to-t from-background from-0% via-background/60 via-40% to-transparent to-100%",
            )}
          />
        )}
      </div>
      {showCompactMode !== undefined && (
        <div className="relative w-full mt-2">
          <button
            type="button"
            className="group inline-flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            onClick={toggleCompactMode}
          >
            <span>{compactLabel}</span>
            {showCompactMode === "ALL" ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
          </button>
        </div>
      )}
    </div>
  );
};

export default memo(MemoContent);
