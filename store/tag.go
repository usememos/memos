package store

import (
	"context"
	"database/sql"
	"fmt"
	"strings"

	"github.com/usememos/memos/api"
	"github.com/usememos/memos/common"
)

type tagRaw struct {
	Name      string
	CreatorID int
}

func (raw *tagRaw) toTag() *api.Tag {
	return &api.Tag{
		Name:      raw.Name,
		CreatorID: raw.CreatorID,
	}
}

func (s *Store) UpsertTag(ctx context.Context, upsert *api.TagUpsert) (*api.Tag, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, FormatError(err)
	}
	defer tx.Rollback()

	tagRaw, err := upsertTag(ctx, tx, upsert)
	if err != nil {
		return nil, err
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	tag := tagRaw.toTag()

	return tag, nil
}

func (s *Store) FindTagList(ctx context.Context, find *api.TagFind) ([]*api.Tag, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, FormatError(err)
	}
	defer tx.Rollback()

	tagRawList, err := findTagList(ctx, tx, find)
	if err != nil {
		return nil, err
	}

	list := []*api.Tag{}
	for _, raw := range tagRawList {
		list = append(list, raw.toTag())
	}

	return list, nil
}

func (s *Store) DeleteTag(ctx context.Context, delete *api.TagDelete) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return FormatError(err)
	}
	defer tx.Rollback()

	if err := deleteTag(ctx, tx, delete); err != nil {
		return FormatError(err)
	}

	if err := tx.Commit(); err != nil {
		return FormatError(err)
	}

	return nil
}

func upsertTag(ctx context.Context, tx *sql.Tx, upsert *api.TagUpsert) (*tagRaw, error) {
	query := `
		INSERT INTO tag (
			name, creator_id
		)
		VALUES (?, ?)
		ON CONFLICT(name, creator_id) DO UPDATE 
		SET
			name = EXCLUDED.name
		RETURNING name, creator_id
	`
	var tagRaw tagRaw
	if err := tx.QueryRowContext(ctx, query, upsert.Name, upsert.CreatorID).Scan(
		&tagRaw.Name,
		&tagRaw.CreatorID,
	); err != nil {
		return nil, FormatError(err)
	}

	return &tagRaw, nil
}

func findTagList(ctx context.Context, tx *sql.Tx, find *api.TagFind) ([]*tagRaw, error) {
	where, args := []string{"creator_id = ?"}, []interface{}{find.CreatorID}

	query := `
		SELECT
			name,
			creator_id
		FROM tag
		WHERE ` + strings.Join(where, " AND ")
	rows, err := tx.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, FormatError(err)
	}
	defer rows.Close()

	tagRawList := make([]*tagRaw, 0)
	for rows.Next() {
		var tagRaw tagRaw
		if err := rows.Scan(
			&tagRaw.Name,
			&tagRaw.CreatorID,
		); err != nil {
			return nil, FormatError(err)
		}

		tagRawList = append(tagRawList, &tagRaw)
	}

	if err := rows.Err(); err != nil {
		return nil, FormatError(err)
	}

	return tagRawList, nil
}

func deleteTag(ctx context.Context, tx *sql.Tx, delete *api.TagDelete) error {
	where, args := []string{"name = ?", "creator_id = ?"}, []interface{}{delete.Name, delete.CreatorID}

	stmt := `DELETE FROM tag WHERE ` + strings.Join(where, " AND ")
	result, err := tx.ExecContext(ctx, stmt, args...)
	if err != nil {
		return FormatError(err)
	}

	rows, _ := result.RowsAffected()
	if rows == 0 {
		return &common.Error{Code: common.NotFound, Err: fmt.Errorf("tag not found")}
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
		return FormatError(err)
	}

	return nil
}
