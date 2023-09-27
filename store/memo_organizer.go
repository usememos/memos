package store

import (
	"context"
)

type MemoOrganizer struct {
	MemoID int32
	UserID int32
	Pinned bool
}

type FindMemoOrganizer struct {
	MemoID int32
	UserID int32
}

type DeleteMemoOrganizer struct {
	MemoID *int32
	UserID *int32
}

func (s *Store) UpsertMemoOrganizer(ctx context.Context, upsert *MemoOrganizer) (*MemoOrganizer, error) {
	return s.driver.UpsertMemoOrganizer(ctx, upsert)
}

func (s *Store) GetMemoOrganizer(ctx context.Context, find *FindMemoOrganizer) (*MemoOrganizer, error) {
	return s.driver.GetMemoOrganizer(ctx, find)
}

func (s *Store) DeleteMemoOrganizer(ctx context.Context, delete *DeleteMemoOrganizer) error {
	return s.driver.DeleteMemoOrganizer(ctx, delete)
}
