package api

type MemoRelationType string

const (
	MemoRelationReference  MemoRelationType = "REFERENCE"
	MemoRelationAdditional MemoRelationType = "ADDITIONAL"
)

type MemoRelationCreate struct {
	// Standard fields
	MemoID         int              `json:"memoId"`
	RelationMemoID int              `json:"RelationMemoId"`
	Type           MemoRelationType `json:"type"`
}
