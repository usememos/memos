package api

type MemoRelationType string

const (
	MemoRelationReference  MemoRelationType = "REFERENCE"
	MemoRelationAdditional MemoRelationType = "ADDITIONAL"
)

type MemoRelationCreate struct {
	// Standard fields
	MemoId         int              `json:"memoId"`
	RelationMemoId int              `json:"RelationMemoId"`
	Type           MemoRelationType `json:"type"`
}
