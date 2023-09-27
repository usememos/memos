package store

import (
	"context"
	"database/sql"
)

type MemoRelationType string

const (
	MemoRelationReference  MemoRelationType = "REFERENCE"
	MemoRelationAdditional MemoRelationType = "ADDITIONAL"
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

func (s *Store) GetMemoRelation(ctx context.Context, find *FindMemoRelation) (*MemoRelation, error) {
	list, err := s.ListMemoRelations(ctx, find)
	if err != nil {
		return nil, err
	}

	if len(list) == 0 {
		return nil, nil
	}

	return list[0], nil
}

func (s *Store) DeleteMemoRelation(ctx context.Context, delete *DeleteMemoRelation) error {
	return s.driver.DeleteMemoRelation(ctx, delete)
}

func vacuumMemoRelations(ctx context.Context, tx *sql.Tx) error {
	if _, err := tx.ExecContext(ctx, `
		DELETE FROM memo_relation
		WHERE memo_id NOT IN (SELECT id FROM memo) OR related_memo_id NOT IN (SELECT id FROM memo)
	`); err != nil {
		return err
	}
	return nil
}
