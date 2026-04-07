import { LinkIcon, XIcon } from "lucide-react";
import type { FC } from "react";
import { useMemo } from "react";
import MetadataSection from "@/components/MemoMetadata/MetadataSection";
import type { MemoRelation } from "@/types/proto/api/v1/memo_service_pb";
import RelationCard from "./RelationCard";
import { getEditorReferenceRelations } from "./relationHelpers";
import { useResolvedRelationMemos } from "./useResolvedRelationMemos";

interface RelationListEditorProps {
  relations: MemoRelation[];
  onRelationsChange?: (relations: MemoRelation[]) => void;
  parentPage?: string;
  memoName?: string;
}

const RelationItemCard: FC<{
  memo: MemoRelation["relatedMemo"];
  onRemove?: () => void;
  parentPage?: string;
}> = ({ memo, onRemove, parentPage }) => {
  return (
    <div className="group relative flex items-center justify-between w-full rounded hover:bg-accent/20 transition-colors">
      <RelationCard memo={memo!} parentPage={parentPage} className="flex-1 hover:bg-transparent" />

      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="p-1 mr-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-destructive/10 active:bg-destructive/10 transition-all touch-manipulation"
          title="Remove"
          aria-label="Remove relation"
        >
          <XIcon className="w-3 h-3 text-muted-foreground hover:text-destructive" />
        </button>
      )}
    </div>
  );
};

const RelationListEditor: FC<RelationListEditorProps> = ({ relations, onRelationsChange, parentPage, memoName }) => {
  const referenceRelations = useMemo(() => getEditorReferenceRelations(relations, memoName), [relations, memoName]);
  const resolvedMemos = useResolvedRelationMemos(referenceRelations);

  const handleDeleteRelation = (memoName: string) => {
    if (onRelationsChange) {
      onRelationsChange(relations.filter((relation) => relation.relatedMemo?.name !== memoName));
    }
  };

  if (referenceRelations.length === 0) {
    return null;
  }

  return (
    <MetadataSection
      icon={LinkIcon}
      title="Relations"
      count={referenceRelations.length}
      contentClassName="flex flex-col gap-0.5 p-1 sm:p-1.5"
    >
      {referenceRelations.map((relation) => {
        const relatedMemo = relation.relatedMemo!;
        const memo = relatedMemo.snippet ? relatedMemo : resolvedMemos[relatedMemo.name] || relatedMemo;
        return <RelationItemCard key={memo.name} memo={memo} onRemove={() => handleDeleteRelation(memo.name)} parentPage={parentPage} />;
      })}
    </MetadataSection>
  );
};

export default RelationListEditor;
