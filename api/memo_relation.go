package api

type MemoRelationType string

const (
	MemoRelationReference  MemoRelationType = "REFERENCE"
	MemoRelationAdditional MemoRelationType = "ADDITIONAL"
)

type MemoRelation struct {
	MemoID        int
	RelatedMemoID int
	Type          MemoRelationType
}

type MemoRelationUpsert struct {
	RelatedMemoID int
	Type          MemoRelationType
}
