package mysql

import (
	"context"
	"database/sql"
	"strings"

	"github.com/pkg/errors"

	"github.com/usememos/memos/store"
)

func (d *DB) CreateMemoShare(ctx context.Context, create *store.MemoShare) (*store.MemoShare, error) {
	if create.Policy == nil {
		return createMySQLMemoShare(ctx, d.db, create)
	}
	tx, err := d.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback() }()
	if err := validateMySQLMemoWritePolicy(ctx, tx, create.MemoID, create.Policy, nil); err != nil {
		return nil, err
	}
	result, err := createMySQLMemoShare(ctx, tx, create)
	if err != nil {
		return nil, err
	}
	if err := tx.Commit(); err != nil {
		return nil, err
	}
	return result, nil
}

type mysqlMemoShareCreator interface {
	ExecContext(context.Context, string, ...any) (sql.Result, error)
	QueryRowContext(context.Context, string, ...any) *sql.Row
}

func createMySQLMemoShare(ctx context.Context, executor mysqlMemoShareCreator, create *store.MemoShare) (*store.MemoShare, error) {
	fields := []string{"`uid`", "`memo_id`", "`creator_id`"}
	placeholders := []string{"?", "?", "?"}
	args := []any{create.UID, create.MemoID, create.CreatorID}

	if create.ExpiresTs != nil {
		fields = append(fields, "`expires_ts`")
		placeholders = append(placeholders, "?")
		args = append(args, *create.ExpiresTs)
	}

	stmt := "INSERT INTO `memo_share` (" + strings.Join(fields, ", ") + ") VALUES (" + strings.Join(placeholders, ", ") + ")"
	result, err := executor.ExecContext(ctx, stmt, args...)
	if err != nil {
		return nil, err
	}

	rawID, err := result.LastInsertId()
	if err != nil {
		return nil, err
	}
	id := int32(rawID)
	created := &store.MemoShare{Policy: create.Policy}
	if err := executor.QueryRowContext(ctx, `SELECT id, uid, memo_id, creator_id, created_ts, expires_ts FROM memo_share WHERE id = ?`, id).Scan(
		&created.ID, &created.UID, &created.MemoID, &created.CreatorID, &created.CreatedTs, &created.ExpiresTs,
	); err != nil {
		return nil, errors.Wrap(err, "failed to load created memo share")
	}
	return created, nil
}

func (d *DB) ListMemoShares(ctx context.Context, find *store.FindMemoShare) ([]*store.MemoShare, error) {
	where, args := []string{"1 = 1"}, []any{}

	if find.ID != nil {
		where, args = append(where, "`id` = ?"), append(args, *find.ID)
	}
	if find.UID != nil {
		where, args = append(where, "`uid` = ?"), append(args, *find.UID)
	}
	if find.MemoID != nil {
		where, args = append(where, "`memo_id` = ?"), append(args, *find.MemoID)
	}
	if find.CreatorID != nil {
		where, args = append(where, "`creator_id` = ?"), append(args, *find.CreatorID)
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
	list, err := d.ListMemoShares(ctx, find)
	if err != nil {
		return nil, err
	}
	if len(list) == 0 {
		return nil, nil
	}
	return list[0], nil
}

func (d *DB) DeleteMemoShare(ctx context.Context, delete *store.DeleteMemoShare) error {
	if delete.Policy != nil {
		tx, err := d.db.BeginTx(ctx, nil)
		if err != nil {
			return err
		}
		defer func() { _ = tx.Rollback() }()
		if err := validateMySQLMemoWritePolicy(ctx, tx, *delete.MemoID, delete.Policy, nil); err != nil {
			return err
		}
		where, args := mysqlMemoShareDeleteWhere(delete)
		where = append(where, "`memo_id` = ?")
		args = append(args, *delete.MemoID)
		result, err := tx.ExecContext(ctx, "DELETE FROM `memo_share` WHERE "+strings.Join(where, " AND "), args...)
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
	where, args := mysqlMemoShareDeleteWhere(delete)
	_, err := d.db.ExecContext(ctx, "DELETE FROM `memo_share` WHERE "+strings.Join(where, " AND "), args...)
	return err
}

func mysqlMemoShareDeleteWhere(delete *store.DeleteMemoShare) ([]string, []any) {
	where, args := []string{"1 = 1"}, []any{}
	if delete.ID != nil {
		where, args = append(where, "`id` = ?"), append(args, *delete.ID)
	}
	if delete.UID != nil {
		where, args = append(where, "`uid` = ?"), append(args, *delete.UID)
	}
	return where, args
}
