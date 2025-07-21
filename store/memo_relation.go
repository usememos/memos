package store

import (
	"context"
)

type MemoRelationType string

const (
	// MemoRelationReference is the type for a reference memo relation.
	MemoRelationReference MemoRelationType = "REFERENCE"
	// MemoRelationComment is the type for a comment memo relation.
	MemoRelationComment MemoRelationType = "COMMENT"
)

type MemoRelation struct {
	MemoID        int32
	RelatedMemoID int32
	Type          MemoRelationType
}

type FindMemoRelation struct {
	MemoID        *int32
	RelatedMemoID *int32
	Type          *MemoRelationType
	MemoFilter    *string
}

type DeleteMemoRelation struct {
	MemoID        *int32
	RelatedMemoID *int32
	Type          *MemoRelationType
}

func (s *Store) UpsertMemoRelation(ctx context.Context, create *MemoRelation) (*MemoRelation, error) {
	return s.driver.UpsertMemoRelation(ctx, create)
}

func (s *Store) ListMemoRelations(ctx context.Context, find *FindMemoRelation) ([]*MemoRelation, error) {
	return s.driver.ListMemoRelations(ctx, find)
}

func (s *Store) DeleteMemoRelation(ctx context.Context, delete *DeleteMemoRelation) error {
	return s.driver.DeleteMemoRelation(ctx, delete)
}
