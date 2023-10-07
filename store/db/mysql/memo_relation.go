package mysql

import (
	"context"
	"database/sql"
	"strings"

	"github.com/usememos/memos/store"
)

func (d *DB) UpsertMemoRelation(ctx context.Context, create *store.MemoRelation) (*store.MemoRelation, error) {
	stmt := "INSERT INTO `memo_relation` (`memo_id`, `related_memo_id`, `type`) VALUES (?, ?, ?)"
	_, err := d.db.ExecContext(
		ctx,
		stmt,
		create.MemoID,
		create.RelatedMemoID,
		create.Type,
	)
	if err != nil {
		return nil, err
	}

	memoRelation := store.MemoRelation{
		MemoID:        create.MemoID,
		RelatedMemoID: create.RelatedMemoID,
		Type:          create.Type,
	}

	return &memoRelation, nil
}

func (d *DB) ListMemoRelations(ctx context.Context, find *store.FindMemoRelation) ([]*store.MemoRelation, error) {
	where, args := []string{"TRUE"}, []any{}
	if find.MemoID != nil {
		where, args = append(where, "`memo_id` = ?"), append(args, find.MemoID)
	}
	if find.RelatedMemoID != nil {
		where, args = append(where, "`related_memo_id` = ?"), append(args, find.RelatedMemoID)
	}
	if find.Type != nil {
		where, args = append(where, "`type` = ?"), append(args, find.Type)
	}

	rows, err := d.db.QueryContext(ctx, "SELECT `memo_id`, `related_memo_id`, `type` FROM `memo_relation` WHERE "+strings.Join(where, " AND "), args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	list := []*store.MemoRelation{}
	for rows.Next() {
		memoRelation := &store.MemoRelation{}
		if err := rows.Scan(
			&memoRelation.MemoID,
			&memoRelation.RelatedMemoID,
			&memoRelation.Type,
		); err != nil {
			return nil, err
		}
		list = append(list, memoRelation)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return list, nil
}

func (d *DB) DeleteMemoRelation(ctx context.Context, delete *store.DeleteMemoRelation) error {
	where, args := []string{"TRUE"}, []any{}
	if delete.MemoID != nil {
		where, args = append(where, "`memo_id` = ?"), append(args, delete.MemoID)
	}
	if delete.RelatedMemoID != nil {
		where, args = append(where, "`related_memo_id` = ?"), append(args, delete.RelatedMemoID)
	}
	if delete.Type != nil {
		where, args = append(where, "`type` = ?"), append(args, delete.Type)
	}
	stmt := "DELETE FROM `memo_relation` WHERE " + strings.Join(where, " AND ")
	result, err := d.db.ExecContext(ctx, stmt, args...)
	if err != nil {
		return err
	}
	if _, err = result.RowsAffected(); err != nil {
		return err
	}
	return nil
}

func vacuumMemoRelations(ctx context.Context, tx *sql.Tx) error {
	if _, err := tx.ExecContext(ctx, "DELETE FROM `memo_relation` WHERE `memo_id` NOT IN (SELECT `id` FROM `memo`) OR `related_memo_id` NOT IN (SELECT `id` FROM `memo`)"); err != nil {
		return err
	}
	return nil
}
