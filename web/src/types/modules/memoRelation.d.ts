type MemoRelationType = "REFERENCE" | "COMMENT";

interface MemoRelation {
  memoId: MemoId;
  relatedMemoId: MemoId;
  type: MemoRelationType;
}

interface MemoRelationUpsert {
  relatedMemoId: MemoId;
  type: MemoRelationType;
}
