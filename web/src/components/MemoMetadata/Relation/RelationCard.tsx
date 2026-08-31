import MemoSnippetLink from "@/components/MemoView/components/MemoSnippetLink";
import { createMemoNavigationState, type MemoOriginScope } from "@/components/MemoView/navigation";
import type { MemoRelation_Memo } from "@/types/proto/api/v1/memo_service_pb";

interface RelationCardProps {
  memo: MemoRelation_Memo;
  parentPage?: string;
  parentScope?: MemoOriginScope;
  className?: string;
}

const RelationCard = ({ memo, parentPage, parentScope, className }: RelationCardProps) => {
  return (
    <MemoSnippetLink
      name={memo.name}
      snippet={memo.snippet}
      to={`/${memo.name}`}
      state={parentPage && parentScope ? createMemoNavigationState(parentPage, parentScope) : undefined}
      className={className}
    />
  );
};

export default RelationCard;
