package store

import (
	"context"
	"database/sql"
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

func vacuumMemoOrganizer(ctx context.Context, tx *sql.Tx) error {
	stmt := `
	DELETE FROM 
		memo_organizer 
	WHERE 
		memo_id NOT IN (
			SELECT 
				id 
			FROM 
				memo
		)
		OR user_id NOT IN (
			SELECT 
				id 
			FROM 
				user
		)`
	_, err := tx.ExecContext(ctx, stmt)
	if err != nil {
		return err
	}

	return nil
}
