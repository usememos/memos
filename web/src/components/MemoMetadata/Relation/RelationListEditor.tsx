import { LinkIcon, MilestoneIcon } from "lucide-react";
import type { FC } from "react";
import { useMemo } from "react";
import { METADATA_ROW_BOX_CLASSES, MetadataRowDetail, MetadataRowRemoveControl } from "@/components/MemoMetadata/MetadataSection";
import type { MemoRelation } from "@/types/proto/api/memo_service_pb";
import { useTranslate } from "@/utils/i18n";
import RelationRow from "./RelationRow";
import { getEditorBacklinkRelations, getEditorReferenceRelations } from "./relationHelpers";
import { useRelationMemoDates, useResolvedRelationMemos } from "./useResolvedRelationMemos";

interface RelationListEditorProps {
  relations: MemoRelation[];
  onRelationsChange?: (relations: MemoRelation[]) => void;
  parentPage?: string;
  memoName?: string;
}

/**
 * The draft's links as rows in the editor's one list: the memos it links to, which can be
 * removed, then the memos that link to it, read-only, so the memo keeps its shape while edited.
 * Each row shows the memo's text and, in its details, when it was written.
 */
const RelationListEditor: FC<RelationListEditorProps> = ({ relations, onRelationsChange, parentPage, memoName }) => {
  const t = useTranslate();
  const referenceRelations = useMemo(() => getEditorReferenceRelations(relations, memoName), [relations, memoName]);
  const backlinkRelations = useMemo(() => getEditorBacklinkRelations(relations, memoName), [relations, memoName]);
  const relatedMemoNames = useMemo(
    () => [
      ...referenceRelations.flatMap((relation) => (relation.relatedMemo?.name ? [relation.relatedMemo.name] : [])),
      ...backlinkRelations.flatMap((relation) => (relation.memo?.name ? [relation.memo.name] : [])),
    ],
    [referenceRelations, backlinkRelations],
  );
  const resolvedMemos = useResolvedRelationMemos(relatedMemoNames);
  const dates = useRelationMemoDates(relatedMemoNames);

  const handleDeleteRelation = (name: string) => {
    onRelationsChange?.(relations.filter((relation) => relation.relatedMemo?.name !== name));
  };

  return (
    <>
      {referenceRelations.map((relation) => {
        const relatedMemo = relation.relatedMemo!;
        if (resolvedMemos[relatedMemo.name] === null) return null;
        const memo = relatedMemo.snippet ? relatedMemo : resolvedMemos[relatedMemo.name] || relatedMemo;
        // A split row: the link is the focusable body, and the remove control overlays the trailing end once the row is engaged.
        return (
          <div key={memo.name} className={METADATA_ROW_BOX_CLASSES}>
            <RelationRow
              memo={memo}
              parentPage={parentPage}
              variant="label"
              icon={LinkIcon}
              trailing={<MetadataRowDetail parts={[dates[memo.name]]} />}
            />
            {onRelationsChange && (
              <MetadataRowRemoveControl label={t("editor.remove-relation")} onClick={() => handleDeleteRelation(memo.name)} />
            )}
          </div>
        );
      })}
      {backlinkRelations.map((relation) => {
        const linkingMemo = relation.memo!;
        if (resolvedMemos[linkingMemo.name] === null) return null;
        const memo = resolvedMemos[linkingMemo.name] || linkingMemo;
        return (
          <RelationRow
            key={memo.name}
            memo={memo}
            parentPage={parentPage}
            icon={MilestoneIcon}
            title={t("common.referenced-by")}
            trailing={<MetadataRowDetail parts={[dates[memo.name]]} />}
          />
        );
      })}
    </>
  );
};

export default RelationListEditor;
