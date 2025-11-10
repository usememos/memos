import { LinkIcon, XIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { extractMemoIdFromName } from "@/store/common";
import { MemoRelation_Memo } from "@/types/proto/api/v1/memo_service";
import { DisplayMode } from "./types";

interface RelationCardProps {
  memo: MemoRelation_Memo;
  mode: DisplayMode;
  onRemove?: () => void;
  parentPage?: string;
  className?: string;
}

/**
 * Shared relation card component for displaying linked memos
 *
 * Editor mode: Badge with remove button, click to remove
 * View mode: Link with memo ID and snippet, click to navigate
 */
const RelationCard = ({ memo, mode, onRemove, parentPage, className }: RelationCardProps) => {
  const memoId = extractMemoIdFromName(memo.name);

  // Editor mode: Badge with remove
  if (mode === "edit") {
    return (
      <div
        className={cn(
          "relative inline-flex items-center gap-1.5 px-2 h-7 rounded-md border border-border bg-background text-secondary-foreground text-xs transition-colors hover:bg-accent",
          className,
        )}
      >
        <LinkIcon className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
        <span className="truncate max-w-[160px]">{memo.snippet}</span>
        {onRemove && (
          <button
            className="shrink-0 rounded hover:bg-accent transition-colors p-0.5"
            onPointerDown={(e) => {
              e.stopPropagation();
            }}
            onMouseDown={(e) => {
              e.stopPropagation();
            }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onRemove();
            }}
          >
            <XIcon className="w-3 h-3 text-muted-foreground hover:text-foreground" />
          </button>
        )}
      </div>
    );
  }

  // View mode: Navigable link with ID and snippet
  return (
    <Link
      className={cn(
        "w-full flex flex-row justify-start items-center text-sm leading-5 text-muted-foreground hover:text-foreground hover:bg-accent rounded px-1 py-1 transition-colors",
        className,
      )}
      to={`/${memo.name}`}
      viewTransition
      state={{
        from: parentPage,
      }}
    >
      <span className="text-[10px] opacity-60 leading-4 border border-border font-mono px-1 rounded-full mr-1">{memoId.slice(0, 6)}</span>
      <span className="truncate">{memo.snippet}</span>
    </Link>
  );
};

export default RelationCard;
