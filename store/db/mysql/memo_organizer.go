package mysql

import (
	"context"
	"database/sql"
	"strings"

	"github.com/usememos/memos/store"
)

func (d *DB) UpsertMemoOrganizer(ctx context.Context, upsert *store.MemoOrganizer) (*store.MemoOrganizer, error) {
	stmt := "INSERT INTO `memo_organizer` (`memo_id`, `user_id`, `pinned`) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE `pinned` = ?"
	if _, err := d.db.ExecContext(ctx, stmt, upsert.MemoID, upsert.UserID, upsert.Pinned, upsert.Pinned); err != nil {
		return nil, err
	}
	return upsert, nil
}

func (d *DB) ListMemoOrganizer(ctx context.Context, find *store.FindMemoOrganizer) ([]*store.MemoOrganizer, error) {
	where, args := []string{"1 = 1"}, []any{}
	if find.MemoID != 0 {
		where = append(where, "`memo_id` = ?")
		args = append(args, find.MemoID)
	}
	if find.UserID != 0 {
		where = append(where, "`user_id` = ?")
		args = append(args, find.UserID)
	}

	query := "SELECT `memo_id`, `user_id`, `pinned` FROM `memo_organizer` WHERE " + strings.Join(where, " AND ")
	rows, err := d.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	list := []*store.MemoOrganizer{}
	for rows.Next() {
		memoOrganizer := &store.MemoOrganizer{}
		if err := rows.Scan(
			&memoOrganizer.MemoID,
			&memoOrganizer.UserID,
			&memoOrganizer.Pinned,
		); err != nil {
			return nil, err
		}

		list = append(list, memoOrganizer)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return list, nil
}

func (d *DB) DeleteMemoOrganizer(ctx context.Context, delete *store.DeleteMemoOrganizer) error {
	where, args := []string{}, []any{}
	if v := delete.MemoID; v != nil {
		where, args = append(where, "`memo_id` = ?"), append(args, *v)
	}
	if v := delete.UserID; v != nil {
		where, args = append(where, "`user_id` = ?"), append(args, *v)
	}
	stmt := "DELETE FROM `memo_organizer` WHERE " + strings.Join(where, " AND ")
	if _, err := d.db.ExecContext(ctx, stmt, args...); err != nil {
		return err
	}
	return nil
}

func vacuumMemoOrganizer(ctx context.Context, tx *sql.Tx) error {
	stmt := "DELETE FROM `memo_organizer` WHERE `memo_id` NOT IN (SELECT `id` FROM `memo`) OR `user_id` NOT IN (SELECT `id` FROM `user`)"
	_, err := tx.ExecContext(ctx, stmt)
	if err != nil {
		return err
	}
	return nil
}
