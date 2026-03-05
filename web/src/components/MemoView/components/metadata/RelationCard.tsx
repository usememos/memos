import type { MemoRelation_Memo } from "@/types/proto/api/v1/memo_service_pb";
import MemoSnippetLink from "../MemoSnippetLink";

interface RelationCardProps {
  memo: MemoRelation_Memo;
  parentPage?: string;
  className?: string;
}

const RelationCard = ({ memo, parentPage, className }: RelationCardProps) => {
  return (
    <MemoSnippetLink name={memo.name} snippet={memo.snippet} to={`/${memo.name}`} state={{ from: parentPage }} className={className} />
  );
};

export default RelationCard;
