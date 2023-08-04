package store

import (
	"context"
	"database/sql"
	"strings"
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
	stmt := `
		INSERT INTO tag (
			name, creator_id
		)
		VALUES (?, ?)
		ON CONFLICT(name, creator_id) DO UPDATE 
		SET
			name = EXCLUDED.name
	`
	if _, err := s.db.ExecContext(ctx, stmt, upsert.Name, upsert.CreatorID); err != nil {
		return nil, err
	}

	tag := upsert
	return tag, nil
}

func (s *Store) ListTags(ctx context.Context, find *FindTag) ([]*Tag, error) {
	where, args := []string{"creator_id = ?"}, []any{find.CreatorID}
	query := `
		SELECT
			name,
			creator_id
		FROM tag
		WHERE ` + strings.Join(where, " AND ") + `
		ORDER BY name ASC
	`
	rows, err := s.db.QueryContext(ctx, query, args...)
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

	return list, nil
}

func (s *Store) DeleteTag(ctx context.Context, delete *DeleteTag) error {
	where, args := []string{"name = ?", "creator_id = ?"}, []any{delete.Name, delete.CreatorID}
	stmt := `DELETE FROM tag WHERE ` + strings.Join(where, " AND ")
	result, err := s.db.ExecContext(ctx, stmt, args...)
	if err != nil {
		return err
	}
	if _, err = result.RowsAffected(); err != nil {
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
