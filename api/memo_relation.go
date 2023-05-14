package api

type MemoRelationType string

const (
	MemoRelationReference  MemoRelationType = "REFERENCE"
	MemoRelationAdditional MemoRelationType = "ADDITIONAL"
)

type MemoRelation struct {
	MemoID        int              `json:"memoId"`
	RelatedMemoID int              `json:"relatedMemoId"`
	Type          MemoRelationType `json:"type"`
}

type MemoRelationUpsert struct {
	RelatedMemoID int              `json:"relatedMemoId"`
	Type          MemoRelationType `json:"type"`
}
