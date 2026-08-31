package postgres

import (
	"context"
	"database/sql"
	"errors"
	"strings"

	"github.com/usememos/memos/store"
)

func (d *DB) CreateMemoShare(ctx context.Context, create *store.MemoShare) (*store.MemoShare, error) {
	if create.Policy == nil {
		return createPostgresMemoShare(ctx, d.db, create)
	}
	tx, err := d.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback() }()
	if err := validatePostgresMemoWritePolicy(ctx, tx, create.MemoID, create.Policy, nil); err != nil {
		return nil, err
	}
	result, err := createPostgresMemoShare(ctx, tx, create)
	if err != nil {
		return nil, err
	}
	if err := tx.Commit(); err != nil {
		return nil, err
	}
	return result, nil
}

type postgresMemoShareCreator interface {
	QueryRowContext(context.Context, string, ...any) *sql.Row
}

func createPostgresMemoShare(ctx context.Context, executor postgresMemoShareCreator, create *store.MemoShare) (*store.MemoShare, error) {
	fields := []string{"uid", "memo_id", "creator_id"}
	args := []any{create.UID, create.MemoID, create.CreatorID}

	if create.ExpiresTs != nil {
		fields = append(fields, "expires_ts")
		args = append(args, *create.ExpiresTs)
	}

	stmt := "INSERT INTO memo_share (" + strings.Join(fields, ", ") + ") VALUES (" + placeholders(len(args)) + ") RETURNING id, created_ts"
	if err := executor.QueryRowContext(ctx, stmt, args...).Scan(
		&create.ID,
		&create.CreatedTs,
	); err != nil {
		return nil, err
	}
	return create, nil
}

func (d *DB) ListMemoShares(ctx context.Context, find *store.FindMemoShare) ([]*store.MemoShare, error) {
	where, args := []string{"1 = 1"}, []any{}

	if find.ID != nil {
		where, args = append(where, "id = "+placeholder(len(args)+1)), append(args, *find.ID)
	}
	if find.UID != nil {
		where, args = append(where, "uid = "+placeholder(len(args)+1)), append(args, *find.UID)
	}
	if find.MemoID != nil {
		where, args = append(where, "memo_id = "+placeholder(len(args)+1)), append(args, *find.MemoID)
	}
	if find.CreatorID != nil {
		where, args = append(where, "creator_id = "+placeholder(len(args)+1)), append(args, *find.CreatorID)
	}

	rows, err := d.db.QueryContext(ctx, `
		SELECT
			id,
			uid,
			memo_id,
			creator_id,
			created_ts,
			expires_ts
		FROM memo_share
		WHERE `+strings.Join(where, " AND ")+`
		ORDER BY id ASC`,
		args...,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	list := []*store.MemoShare{}
	for rows.Next() {
		ms := &store.MemoShare{}
		if err := rows.Scan(
			&ms.ID,
			&ms.UID,
			&ms.MemoID,
			&ms.CreatorID,
			&ms.CreatedTs,
			&ms.ExpiresTs,
		); err != nil {
			return nil, err
		}
		list = append(list, ms)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}
	return list, nil
}

func (d *DB) GetMemoShare(ctx context.Context, find *store.FindMemoShare) (*store.MemoShare, error) {
	where, args := []string{"1 = 1"}, []any{}

	if find.ID != nil {
		where, args = append(where, "id = "+placeholder(len(args)+1)), append(args, *find.ID)
	}
	if find.UID != nil {
		where, args = append(where, "uid = "+placeholder(len(args)+1)), append(args, *find.UID)
	}
	if find.MemoID != nil {
		where, args = append(where, "memo_id = "+placeholder(len(args)+1)), append(args, *find.MemoID)
	}
	if find.CreatorID != nil {
		where, args = append(where, "creator_id = "+placeholder(len(args)+1)), append(args, *find.CreatorID)
	}

	ms := &store.MemoShare{}
	if err := d.db.QueryRowContext(ctx, `
		SELECT
			id,
			uid,
			memo_id,
			creator_id,
			created_ts,
			expires_ts
		FROM memo_share
		WHERE `+strings.Join(where, " AND ")+`
		LIMIT 1`,
		args...,
	).Scan(
		&ms.ID,
		&ms.UID,
		&ms.MemoID,
		&ms.CreatorID,
		&ms.CreatedTs,
		&ms.ExpiresTs,
	); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	return ms, nil
}

func (d *DB) DeleteMemoShare(ctx context.Context, delete *store.DeleteMemoShare) error {
	if delete.Policy != nil {
		tx, err := d.db.BeginTx(ctx, nil)
		if err != nil {
			return err
		}
		defer func() { _ = tx.Rollback() }()
		if err := validatePostgresMemoWritePolicy(ctx, tx, *delete.MemoID, delete.Policy, nil); err != nil {
			return err
		}
		where, args := postgresMemoShareDeleteWhere(delete)
		where = append(where, "memo_id = "+placeholder(len(args)+1))
		args = append(args, *delete.MemoID)
		result, err := tx.ExecContext(ctx, "DELETE FROM memo_share WHERE "+strings.Join(where, " AND "), args...)
		if err != nil {
			return err
		}
		if rows, err := result.RowsAffected(); err != nil {
			return err
		} else if rows != 1 {
			return store.ErrMemoMutationConflict
		}
		return tx.Commit()
	}
	where, args := postgresMemoShareDeleteWhere(delete)
	_, err := d.db.ExecContext(ctx, "DELETE FROM memo_share WHERE "+strings.Join(where, " AND "), args...)
	return err
}

func postgresMemoShareDeleteWhere(delete *store.DeleteMemoShare) ([]string, []any) {
	where, args := []string{"1 = 1"}, []any{}
	if delete.ID != nil {
		where, args = append(where, "id = "+placeholder(len(args)+1)), append(args, *delete.ID)
	}
	if delete.UID != nil {
		where, args = append(where, "uid = "+placeholder(len(args)+1)), append(args, *delete.UID)
	}
	return where, args
}
