package store

import (
	"context"
	"database/sql"
)

type Tag struct {
	Name      string
	CreatorID int32
}

type FindTag struct {
	CreatorID int32
}

type DeleteTag struct {
	Name      string
	CreatorID int32
}

func (s *Store) UpsertTag(ctx context.Context, upsert *Tag) (*Tag, error) {
	return s.driver.UpsertTag(ctx, upsert)
}

func (s *Store) ListTags(ctx context.Context, find *FindTag) ([]*Tag, error) {
	return s.driver.ListTags(ctx, find)
}

func (s *Store) DeleteTag(ctx context.Context, delete *DeleteTag) error {
	return s.driver.DeleteTag(ctx, delete)
}

func vacuumTag(ctx context.Context, tx *sql.Tx) error {
	stmt := `
	DELETE FROM 
		tag 
	WHERE 
		creator_id NOT IN (
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
