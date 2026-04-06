import type { MemoRelation } from "@/types/proto/api/v1/memo_service_pb";
import { MemoRelation_Type } from "@/types/proto/api/v1/memo_service_pb";

export type RelationDirection = "referencing" | "referenced";

export const isReferenceRelation = (relation: MemoRelation): boolean => relation.type === MemoRelation_Type.REFERENCE;

export const getEditorReferenceRelations = (relations: MemoRelation[], memoName?: string): MemoRelation[] => {
  return relations.filter(
    (relation) => isReferenceRelation(relation) && (!memoName || !relation.memo?.name || relation.memo.name === memoName),
  );
};

export const getRelationBuckets = (relations: MemoRelation[], currentMemoName?: string) => {
  return relations.reduce(
    (groups, relation) => {
      if (!isReferenceRelation(relation)) {
        return groups;
      }

      if (relation.memo?.name === currentMemoName && relation.relatedMemo?.name !== currentMemoName) {
        groups.referencing.push(relation);
      } else if (relation.memo?.name !== currentMemoName && relation.relatedMemo?.name === currentMemoName) {
        groups.referenced.push(relation);
      }

      return groups;
    },
    {
      referencing: [] as MemoRelation[],
      referenced: [] as MemoRelation[],
    },
  );
};

export const getRelationMemo = (relation: MemoRelation, direction: RelationDirection) => {
  return direction === "referencing" ? relation.relatedMemo : relation.memo;
};

export const getRelationMemoName = (relation: MemoRelation, direction: RelationDirection): string => {
  return getRelationMemo(relation, direction)?.name ?? "";
};
