package store

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
)

type Tag struct {
	Name      string
	CreatorID int
}

type FindTag struct {
	CreatorID int
}

type DeleteTag struct {
	Name      string
	CreatorID int
}

func (s *Store) UpsertTag(ctx context.Context, upsert *Tag) (*Tag, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	query := `
		INSERT INTO tag (
			name, creator_id
		)
		VALUES (?, ?)
		ON CONFLICT(name, creator_id) DO UPDATE 
		SET
			name = EXCLUDED.name
	`
	if _, err := tx.ExecContext(ctx, query, upsert.Name, upsert.CreatorID); err != nil {
		return nil, err
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	tag := upsert
	return tag, nil
}

func (s *Store) ListTags(ctx context.Context, find *FindTag) ([]*Tag, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	where, args := []string{"creator_id = ?"}, []any{find.CreatorID}
	query := `
		SELECT
			name,
			creator_id
		FROM tag
		WHERE ` + strings.Join(where, " AND ") + `
		ORDER BY name ASC
	`
	rows, err := tx.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	list := []*Tag{}
	for rows.Next() {
		tag := &Tag{}
		if err := rows.Scan(
			&tag.Name,
			&tag.CreatorID,
		); err != nil {
			return nil, err
		}

		list = append(list, tag)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	return list, nil
}

func (s *Store) DeleteTag(ctx context.Context, delete *DeleteTag) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	where, args := []string{"name = ?", "creator_id = ?"}, []any{delete.Name, delete.CreatorID}
	query := `DELETE FROM tag WHERE ` + strings.Join(where, " AND ")
	result, err := tx.ExecContext(ctx, query, args...)
	if err != nil {
		return err
	}

	rows, _ := result.RowsAffected()
	if rows == 0 {
		return fmt.Errorf("tag not found")
	}

	if err := tx.Commit(); err != nil {
		// Prevent linter warning.
		return err
	}

	return nil
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
