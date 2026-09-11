import type { FC } from "react";
import { useMemo } from "react";
import MetadataSection, { METADATA_ROW_BOX_CLASSES, MetadataRowRemoveControl } from "@/components/MemoMetadata/MetadataSection";
import type { MemoRelation } from "@/types/proto/api/v1/memo_service_pb";
import { useTranslate } from "@/utils/i18n";
import RelationRow from "./RelationRow";
import { getEditorReferenceRelations } from "./relationHelpers";
import { useResolvedRelationMemos } from "./useResolvedRelationMemos";

interface RelationListEditorProps {
  relations: MemoRelation[];
  onRelationsChange?: (relations: MemoRelation[]) => void;
  parentPage?: string;
  memoName?: string;
}

const RelationListEditor: FC<RelationListEditorProps> = ({ relations, onRelationsChange, parentPage, memoName }) => {
  const t = useTranslate();
  const referenceRelations = useMemo(() => getEditorReferenceRelations(relations, memoName), [relations, memoName]);
  const relatedMemoNames = useMemo(
    () => referenceRelations.flatMap((relation) => (relation.relatedMemo?.name ? [relation.relatedMemo.name] : [])),
    [referenceRelations],
  );
  const resolvedMemos = useResolvedRelationMemos(relatedMemoNames);

  const handleDeleteRelation = (memoName: string) => {
    if (onRelationsChange) {
      onRelationsChange(relations.filter((relation) => relation.relatedMemo?.name !== memoName));
    }
  };

  if (referenceRelations.length === 0) {
    return null;
  }

  return (
    <MetadataSection title={t("common.relations")}>
      {referenceRelations.map((relation) => {
        const relatedMemo = relation.relatedMemo!;
        if (resolvedMemos[relatedMemo.name] === null) return null;
        const memo = relatedMemo.snippet ? relatedMemo : resolvedMemos[relatedMemo.name] || relatedMemo;
        // A split row: the link is the focusable body, and the remove control overlays the trailing end once the row is engaged.
        return (
          <div key={memo.name} className={METADATA_ROW_BOX_CLASSES}>
            <RelationRow memo={memo} parentPage={parentPage} variant="label" />
            <MetadataRowRemoveControl label="Remove relation" onClick={() => handleDeleteRelation(memo.name)} />
          </div>
        );
      })}
    </MetadataSection>
  );
};

export default RelationListEditor;
