package store

import (
	"context"
	"database/sql"
	"fmt"
	"strings"

	"github.com/usememos/memos/api"
	"github.com/usememos/memos/common"
)

// memoResourceRaw is the store model for an MemoResource.
// Fields have exactly the same meanings as MemoResource.
type memoResourceRaw struct {
	MemoID     int
	ResourceID int
	CreatedTs  int64
	UpdatedTs  int64
}

func (raw *memoResourceRaw) toMemoResource() *api.MemoResource {
	return &api.MemoResource{
		MemoID:     raw.MemoID,
		ResourceID: raw.ResourceID,
		CreatedTs:  raw.CreatedTs,
		UpdatedTs:  raw.UpdatedTs,
	}
}

func (s *Store) FindMemoResourceList(ctx context.Context, find *api.MemoResourceFind) ([]*api.MemoResource, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, FormatError(err)
	}
	defer tx.Rollback()

	memoResourceRawList, err := findMemoResourceList(ctx, tx, find)
	if err != nil {
		return nil, err
	}

	list := []*api.MemoResource{}
	for _, raw := range memoResourceRawList {
		memoResource := raw.toMemoResource()
		list = append(list, memoResource)
	}

	return list, nil
}

func (s *Store) FindMemoResource(ctx context.Context, find *api.MemoResourceFind) (*api.MemoResource, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, FormatError(err)
	}
	defer tx.Rollback()

	list, err := findMemoResourceList(ctx, tx, find)
	if err != nil {
		return nil, err
	}

	if len(list) == 0 {
		return nil, &common.Error{Code: common.NotFound, Err: fmt.Errorf("not found")}
	}

	memoResourceRaw := list[0]

	return memoResourceRaw.toMemoResource(), nil
}

func (s *Store) UpsertMemoResource(ctx context.Context, upsert *api.MemoResourceUpsert) (*api.MemoResource, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, FormatError(err)
	}
	defer tx.Rollback()

	memoResourceRaw, err := upsertMemoResource(ctx, tx, upsert)
	if err != nil {
		return nil, err
	}

	if err := tx.Commit(); err != nil {
		return nil, FormatError(err)
	}

	return memoResourceRaw.toMemoResource(), nil
}

func (s *Store) DeleteMemoResource(ctx context.Context, delete *api.MemoResourceDelete) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return FormatError(err)
	}
	defer tx.Rollback()

	if err := deleteMemoResource(ctx, tx, delete); err != nil {
		return FormatError(err)
	}

	if err := tx.Commit(); err != nil {
		return FormatError(err)
	}

	return nil
}

func findMemoResourceList(ctx context.Context, tx *sql.Tx, find *api.MemoResourceFind) ([]*memoResourceRaw, error) {
	where, args := []string{"1 = 1"}, []interface{}{}

	if v := find.MemoID; v != nil {
		where, args = append(where, "memo_id = ?"), append(args, *v)
	}
	if v := find.ResourceID; v != nil {
		where, args = append(where, "resource_id = ?"), append(args, *v)
	}

	query := `
		SELECT
			memo_id,
			resource_id,
			created_ts,
			updated_ts
		FROM memo_resource
		WHERE ` + strings.Join(where, " AND ") + `
		ORDER BY updated_ts DESC
	`
	rows, err := tx.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, FormatError(err)
	}
	defer rows.Close()

	memoResourceRawList := make([]*memoResourceRaw, 0)
	for rows.Next() {
		var memoResourceRaw memoResourceRaw
		if err := rows.Scan(
			&memoResourceRaw.MemoID,
			&memoResourceRaw.ResourceID,
			&memoResourceRaw.CreatedTs,
			&memoResourceRaw.UpdatedTs,
		); err != nil {
			return nil, FormatError(err)
		}

		memoResourceRawList = append(memoResourceRawList, &memoResourceRaw)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return memoResourceRawList, nil
}

func upsertMemoResource(ctx context.Context, tx *sql.Tx, upsert *api.MemoResourceUpsert) (*memoResourceRaw, error) {
	set := []string{"memo_id", "resource_id"}
	args := []interface{}{upsert.MemoID, upsert.ResourceID}
	placeholder := []string{"?", "?"}

	if v := upsert.UpdatedTs; v != nil {
		set, args, placeholder = append(set, "updated_ts"), append(args, v), append(placeholder, "?")
	}

	query := `
		INSERT INTO memo_resource (
			` + strings.Join(set, ", ") + `
		)
		VALUES (` + strings.Join(placeholder, ",") + `)
		ON CONFLICT(memo_id, resource_id) DO UPDATE 
		SET
			updated_ts = EXCLUDED.updated_ts
		RETURNING memo_id, resource_id, created_ts, updated_ts
	`
	var memoResourceRaw memoResourceRaw
	if err := tx.QueryRowContext(ctx, query, args...).Scan(
		&memoResourceRaw.MemoID,
		&memoResourceRaw.ResourceID,
		&memoResourceRaw.CreatedTs,
		&memoResourceRaw.UpdatedTs,
	); err != nil {
		return nil, FormatError(err)
	}

	return &memoResourceRaw, nil
}

func deleteMemoResource(ctx context.Context, tx *sql.Tx, delete *api.MemoResourceDelete) error {
	where, args := []string{"memo_id = ?"}, []interface{}{delete.MemoID}

	if v := delete.ResourceID; v != nil {
		where, args = append(where, "resource_id = ?"), append(args, *v)
	}

	result, err := tx.ExecContext(ctx, `
		DELETE FROM memo_resource WHERE `+strings.Join(where, " AND "), args...)
	if err != nil {
		return FormatError(err)
	}

	rows, _ := result.RowsAffected()
	if rows == 0 {
		return &common.Error{Code: common.NotFound, Err: fmt.Errorf("memo resource not found")}
	}

	return nil
}
