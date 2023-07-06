package store

import (
	"context"
	"database/sql"
	"strings"
)

type MemoResource struct {
	MemoID     int
	ResourceID int
	CreatedTs  int64
	UpdatedTs  int64
}

type UpsertMemoResource struct {
	MemoID     int
	ResourceID int
	CreatedTs  int64
	UpdatedTs  *int64
}

type FindMemoResource struct {
	MemoID     *int
	ResourceID *int
}

type DeleteMemoResource struct {
	MemoID     *int
	ResourceID *int
}

func (s *Store) UpsertMemoResource(ctx context.Context, upsert *UpsertMemoResource) (*MemoResource, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, FormatError(err)
	}
	defer tx.Rollback()

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
	if err := tx.QueryRowContext(ctx, query, args...).Scan(
		&memoResource.MemoID,
		&memoResource.ResourceID,
		&memoResource.CreatedTs,
		&memoResource.UpdatedTs,
	); err != nil {
		return nil, FormatError(err)
	}

	if err := tx.Commit(); err != nil {
		return nil, FormatError(err)
	}

	return memoResource, nil
}

func (s *Store) ListMemoResources(ctx context.Context, find *FindMemoResource) ([]*MemoResource, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	list, err := listMemoResources(ctx, tx, find)
	if err != nil {
		return nil, err
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	return list, nil
}

func (s *Store) GetMemoResource(ctx context.Context, find *FindMemoResource) (*MemoResource, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	list, err := listMemoResources(ctx, tx, find)
	if err != nil {
		return nil, err
	}
	if len(list) == 0 {
		return nil, nil
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	memoResource := list[0]
	return memoResource, nil
}

func (s *Store) DeleteMemoResource(ctx context.Context, delete *DeleteMemoResource) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return FormatError(err)
	}
	defer tx.Rollback()

	where, args := []string{}, []any{}

	if v := delete.MemoID; v != nil {
		where, args = append(where, "memo_id = ?"), append(args, *v)
	}
	if v := delete.ResourceID; v != nil {
		where, args = append(where, "resource_id = ?"), append(args, *v)
	}

	stmt := `DELETE FROM memo_resource WHERE ` + strings.Join(where, " AND ")
	_, err = tx.ExecContext(ctx, stmt, args...)
	if err != nil {
		return FormatError(err)
	}

	if err := tx.Commit(); err != nil {
		return FormatError(err)
	}

	return nil
}

func listMemoResources(ctx context.Context, tx *sql.Tx, find *FindMemoResource) ([]*MemoResource, error) {
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
	rows, err := tx.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, FormatError(err)
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
			return nil, FormatError(err)
		}

		list = append(list, &memoResource)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return list, nil
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
		return FormatError(err)
	}

	return nil
}
