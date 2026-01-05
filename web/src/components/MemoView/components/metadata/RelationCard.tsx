import { Link } from "react-router-dom";
import { extractMemoIdFromName } from "@/helpers/resource-names";
import { cn } from "@/lib/utils";
import type { MemoRelation_Memo } from "@/types/proto/api/v1/memo_service_pb";

interface RelationCardProps {
  memo: MemoRelation_Memo;
  parentPage?: string;
  className?: string;
}

const RelationCard = ({ memo, parentPage, className }: RelationCardProps) => {
  const memoId = extractMemoIdFromName(memo.name);

  return (
    <Link
      className={cn(
        "flex items-center gap-1 px-1 py-1 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-accent/20 transition-colors group",
        className,
      )}
      to={`/${memo.name}`}
      viewTransition
      state={{ from: parentPage }}
    >
      <span className="text-[8px] font-mono px-1 py-0.5 rounded border border-border bg-muted/40 group-hover:bg-accent/30 transition-colors shrink-0">
        {memoId.slice(0, 6)}
      </span>
      <span className="truncate">{memo.snippet}</span>
    </Link>
  );
};

export default RelationCard;
