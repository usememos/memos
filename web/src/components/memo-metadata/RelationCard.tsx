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
        "w-full flex flex-row justify-start items-center text-sm leading-5 text-muted-foreground hover:text-foreground hover:bg-accent rounded px-1 py-1 transition-colors",
        className,
      )}
      to={`/${memo.name}`}
      viewTransition
      state={{ from: parentPage }}
    >
      <span className="text-[10px] opacity-60 leading-4 border border-border font-mono px-1 rounded-full mr-1">{memoId.slice(0, 6)}</span>
      <span className="truncate">{memo.snippet}</span>
    </Link>
  );
};

export default RelationCard;
