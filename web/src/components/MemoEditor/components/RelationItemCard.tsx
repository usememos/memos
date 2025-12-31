import { LinkIcon, XIcon } from "lucide-react";
import type { FC } from "react";
import { Link } from "react-router-dom";
import { extractMemoIdFromName } from "@/helpers/resource-names";
import { cn } from "@/lib/utils";
import type { MemoRelation_Memo } from "@/types/proto/api/v1/memo_service_pb";

interface RelationItemCardProps {
  memo: MemoRelation_Memo;
  onRemove?: () => void;
  parentPage?: string;
  className?: string;
}

const RelationItemCard: FC<RelationItemCardProps> = ({ memo, onRemove, parentPage, className }) => {
  const memoId = extractMemoIdFromName(memo.name);

  if (onRemove) {
    return (
      <div
        className={cn(
          "relative flex items-center gap-1.5 px-1.5 py-1 rounded border border-transparent hover:border-border hover:bg-accent/20 transition-all",
          className,
        )}
      >
        <LinkIcon className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
        <span className="text-xs font-medium truncate flex-1" title={memo.snippet}>
          {memo.snippet}
        </span>

        <div className="flex-shrink-0 flex items-center gap-0.5">
          <button
            type="button"
            onClick={onRemove}
            className="p-0.5 rounded hover:bg-destructive/10 active:bg-destructive/10 transition-colors touch-manipulation"
            title="Remove"
            aria-label="Remove relation"
          >
            <XIcon className="w-3 h-3 text-muted-foreground hover:text-destructive" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <Link
      className={cn(
        "relative flex items-center gap-1.5 px-1.5 py-1 rounded border border-transparent hover:border-border hover:bg-accent/20 transition-all",
        className,
      )}
      to={`/${memo.name}`}
      viewTransition
      state={{ from: parentPage }}
    >
      <span className="text-[10px] font-mono px-1 py-0.5 rounded bg-muted/50 text-muted-foreground shrink-0">{memoId.slice(0, 6)}</span>
      <span className="text-xs truncate flex-1" title={memo.snippet}>
        {memo.snippet}
      </span>
    </Link>
  );
};

export default RelationItemCard;
