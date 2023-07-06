package v1

import (
	"github.com/usememos/memos/store"
)

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

func convertMemoRelationFromStore(memoRelation *store.MemoRelation) *MemoRelation {
	return &MemoRelation{
		MemoID:        memoRelation.MemoID,
		RelatedMemoID: memoRelation.RelatedMemoID,
		Type:          MemoRelationType(memoRelation.Type),
	}
}
