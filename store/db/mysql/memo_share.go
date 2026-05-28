package mysql

import (
	"context"
	"strings"

	"github.com/pkg/errors"

	"github.com/usememos/memos/store"
)

func (d *DB) CreateMemoShare(ctx context.Context, create *store.MemoShare) (*store.MemoShare, error) {
	fields := []string{"`uid`", "`memo_id`", "`creator_id`"}
	placeholders := []string{"?", "?", "?"}
	args := []any{create.UID, create.MemoID, create.CreatorID}

	if create.ExpiresTs != nil {
		fields = append(fields, "`expires_ts`")
		placeholders = append(placeholders, "?")
		args = append(args, *create.ExpiresTs)
	}

	stmt := "INSERT INTO `memo_share` (" + strings.Join(fields, ", ") + ") VALUES (" + strings.Join(placeholders, ", ") + ")"
	result, err := d.db.ExecContext(ctx, stmt, args...)
	if err != nil {
		return nil, err
	}

	rawID, err := result.LastInsertId()
	if err != nil {
		return nil, err
	}
	id := int32(rawID)
	ms, err := d.GetMemoShare(ctx, &store.FindMemoShare{ID: &id})
	if err != nil {
		return nil, err
	}
	if ms == nil {
		return nil, errors.Errorf("failed to create memo share")
	}
	return ms, nil
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
	where, args := []string{"1 = 1"}, []any{}
	if delete.ID != nil {
		where, args = append(where, "`id` = ?"), append(args, *delete.ID)
	}
	if delete.UID != nil {
		where, args = append(where, "`uid` = ?"), append(args, *delete.UID)
	}
	_, err := d.db.ExecContext(ctx, "DELETE FROM `memo_share` WHERE "+strings.Join(where, " AND "), args...)
	return err
}
