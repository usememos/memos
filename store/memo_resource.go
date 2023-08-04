package store

import (
	"context"
	"database/sql"
	"strings"
)

type MemoResource struct {
	MemoID     int32
	ResourceID int32
	CreatedTs  int64
	UpdatedTs  int64
}

type UpsertMemoResource struct {
	MemoID     int32
	ResourceID int32
	CreatedTs  int64
	UpdatedTs  *int64
}

type FindMemoResource struct {
	MemoID     *int32
	ResourceID *int32
}

type DeleteMemoResource struct {
	MemoID     *int32
	ResourceID *int32
}

func (s *Store) UpsertMemoResource(ctx context.Context, upsert *UpsertMemoResource) (*MemoResource, error) {
	set := []string{"memo_id", "resource_id"}
	args := []any{upsert.MemoID, upsert.ResourceID}
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
	memoResource := &MemoResource{}
	if err := s.db.QueryRowContext(ctx, query, args...).Scan(
		&memoResource.MemoID,
		&memoResource.ResourceID,
		&memoResource.CreatedTs,
		&memoResource.UpdatedTs,
	); err != nil {
		return nil, err
	}

	return memoResource, nil
}

func (s *Store) ListMemoResources(ctx context.Context, find *FindMemoResource) ([]*MemoResource, error) {
	where, args := []string{"1 = 1"}, []any{}

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
	rows, err := s.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	list := make([]*MemoResource, 0)
	for rows.Next() {
		var memoResource MemoResource
		if err := rows.Scan(
			&memoResource.MemoID,
			&memoResource.ResourceID,
			&memoResource.CreatedTs,
			&memoResource.UpdatedTs,
		); err != nil {
			return nil, err
		}

		list = append(list, &memoResource)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return list, nil
}

func (s *Store) GetMemoResource(ctx context.Context, find *FindMemoResource) (*MemoResource, error) {
	list, err := s.ListMemoResources(ctx, find)
	if err != nil {
		return nil, err
	}
	if len(list) == 0 {
		return nil, nil
	}

	memoResource := list[0]
	return memoResource, nil
}

func (s *Store) DeleteMemoResource(ctx context.Context, delete *DeleteMemoResource) error {
	where, args := []string{}, []any{}
	if v := delete.MemoID; v != nil {
		where, args = append(where, "memo_id = ?"), append(args, *v)
	}
	if v := delete.ResourceID; v != nil {
		where, args = append(where, "resource_id = ?"), append(args, *v)
	}
	stmt := `DELETE FROM memo_resource WHERE ` + strings.Join(where, " AND ")
	result, err := s.db.ExecContext(ctx, stmt, args...)
	if err != nil {
		return err
	}
	if _, err = result.RowsAffected(); err != nil {
		return err
	}
	return nil
}

func vacuumMemoResource(ctx context.Context, tx *sql.Tx) error {
	stmt := `
	DELETE FROM 
		memo_resource 
	WHERE 
		memo_id NOT IN (
			SELECT 
				id 
			FROM 
				memo
		) 
		OR resource_id NOT IN (
			SELECT 
				id 
			FROM 
				resource
		)`
	_, err := tx.ExecContext(ctx, stmt)
	if err != nil {
		return err
	}

	return nil
}
