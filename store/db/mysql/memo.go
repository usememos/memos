package mysql

import (
	"context"
	"database/sql"
	"fmt"
	"strings"

	"github.com/pkg/errors"

	"github.com/usememos/memos/store"
)

func (d *DB) CreateMemo(ctx context.Context, create *store.Memo) (*store.Memo, error) {
	fields := []string{"`creator_id`", "`content`", "`visibility`"}
	placeholder := []string{"?", "?", "?"}
	args := []any{create.CreatorID, create.Content, create.Visibility}

	stmt := "INSERT INTO `memo` (" + strings.Join(fields, ", ") + ") VALUES (" + strings.Join(placeholder, ", ") + ")"
	result, err := d.db.ExecContext(ctx, stmt, args...)
	if err != nil {
		return nil, err
	}

	rawID, err := result.LastInsertId()
	if err != nil {
		return nil, err
	}
	id := int32(rawID)
	memo, err := d.GetMemo(ctx, &store.FindMemo{ID: &id})
	if err != nil {
		return nil, err
	}
	if memo == nil {
		return nil, errors.Errorf("failed to create memo")
	}
	return memo, nil
}

func (d *DB) ListMemos(ctx context.Context, find *store.FindMemo) ([]*store.Memo, error) {
	where, having, args := []string{"1 = 1"}, []string{"1 = 1"}, []any{}

	if v := find.ID; v != nil {
		where, args = append(where, "`memo`.`id` = ?"), append(args, *v)
	}
	if v := find.CreatorID; v != nil {
		where, args = append(where, "`memo`.`creator_id` = ?"), append(args, *v)
	}
	if v := find.RowStatus; v != nil {
		where, args = append(where, "`memo`.`row_status` = ?"), append(args, *v)
	}
	if v := find.CreatedTsBefore; v != nil {
		where, args = append(where, "UNIX_TIMESTAMP(`memo`.`created_ts`) < ?"), append(args, *v)
	}
	if v := find.CreatedTsAfter; v != nil {
		where, args = append(where, "UNIX_TIMESTAMP(`memo`.`created_ts`) > ?"), append(args, *v)
	}
	if v := find.UpdatedTsBefore; v != nil {
		where, args = append(where, "UNIX_TIMESTAMP(`memo`.`updated_ts`) < ?"), append(args, *v)
	}
	if v := find.UpdatedTsAfter; v != nil {
		where, args = append(where, "UNIX_TIMESTAMP(`memo`.`updated_ts`) > ?"), append(args, *v)
	}
	if v := find.ContentSearch; len(v) != 0 {
		for _, s := range v {
			where, args = append(where, "`memo`.`content` LIKE ?"), append(args, "%"+s+"%")
		}
	}
	if v := find.VisibilityList; len(v) != 0 {
		placeholder := []string{}
		for _, visibility := range v {
			placeholder = append(placeholder, "?")
			args = append(args, visibility.String())
		}
		where = append(where, fmt.Sprintf("`memo`.`visibility` in (%s)", strings.Join(placeholder, ",")))
	}
	if find.ExcludeComments {
		having = append(having, "`parent_id` IS NULL")
	}

	orders := []string{}
	if find.OrderByPinned {
		orders = append(orders, "`pinned` DESC")
	}
	if find.OrderByUpdatedTs {
		orders = append(orders, "`updated_ts` DESC")
	} else {
		orders = append(orders, "`created_ts` DESC")
	}
	orders = append(orders, "`id` DESC")

	fields := []string{
		"`memo`.`id` AS `id`",
		"`memo`.`creator_id` AS `creator_id`",
		"UNIX_TIMESTAMP(`memo`.`created_ts`) AS `created_ts`",
		"UNIX_TIMESTAMP(`memo`.`updated_ts`) AS `updated_ts`",
		"`memo`.`row_status` AS `row_status`",
		"`memo`.`visibility` AS `visibility`",
		"IFNULL(`memo_organizer`.`pinned`, 0) AS `pinned`",
		"`memo_relation`.`related_memo_id` AS `parent_id`",
	}
	if !find.ExcludeContent {
		fields = append(fields, "`memo`.`content` AS `content`")
	}

	query := "SELECT " + strings.Join(fields, ", ") + " FROM `memo` LEFT JOIN `memo_organizer` ON `memo`.`id` = `memo_organizer`.`memo_id` AND `memo`.`creator_id` = `memo_organizer`.`user_id` LEFT JOIN `memo_relation` ON `memo`.`id` = `memo_relation`.`memo_id` AND `memo_relation`.`type` = \"COMMENT\" WHERE " + strings.Join(where, " AND ") + " HAVING " + strings.Join(having, " AND ") + " ORDER BY " + strings.Join(orders, ", ")
	if find.Limit != nil {
		query = fmt.Sprintf("%s LIMIT %d", query, *find.Limit)
		if find.Offset != nil {
			query = fmt.Sprintf("%s OFFSET %d", query, *find.Offset)
		}
	}

	rows, err := d.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	list := make([]*store.Memo, 0)
	for rows.Next() {
		var memo store.Memo
		dests := []any{
			&memo.ID,
			&memo.CreatorID,
			&memo.CreatedTs,
			&memo.UpdatedTs,
			&memo.RowStatus,
			&memo.Visibility,
			&memo.Pinned,
			&memo.ParentID,
		}
		if !find.ExcludeContent {
			dests = append(dests, &memo.Content)
		}
		if err := rows.Scan(dests...); err != nil {
			return nil, err
		}
		list = append(list, &memo)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return list, nil
}

func (d *DB) GetMemo(ctx context.Context, find *store.FindMemo) (*store.Memo, error) {
	list, err := d.ListMemos(ctx, find)
	if err != nil {
		return nil, err
	}
	if len(list) == 0 {
		return nil, nil
	}

	memo := list[0]
	return memo, nil
}

func (d *DB) UpdateMemo(ctx context.Context, update *store.UpdateMemo) error {
	set, args := []string{}, []any{}
	if v := update.CreatedTs; v != nil {
		set, args = append(set, "`created_ts` = FROM_UNIXTIME(?)"), append(args, *v)
	}
	if v := update.UpdatedTs; v != nil {
		set, args = append(set, "`updated_ts` = FROM_UNIXTIME(?)"), append(args, *v)
	}
	if v := update.RowStatus; v != nil {
		set, args = append(set, "`row_status` = ?"), append(args, *v)
	}
	if v := update.Content; v != nil {
		set, args = append(set, "`content` = ?"), append(args, *v)
	}
	if v := update.Visibility; v != nil {
		set, args = append(set, "`visibility` = ?"), append(args, *v)
	}
	args = append(args, update.ID)

	stmt := "UPDATE `memo` SET " + strings.Join(set, ", ") + " WHERE `id` = ?"
	if _, err := d.db.ExecContext(ctx, stmt, args...); err != nil {
		return err
	}
	return nil
}

func (d *DB) DeleteMemo(ctx context.Context, delete *store.DeleteMemo) error {
	where, args := []string{"`id` = ?"}, []any{delete.ID}
	stmt := "DELETE FROM `memo` WHERE " + strings.Join(where, " AND ")
	result, err := d.db.ExecContext(ctx, stmt, args...)
	if err != nil {
		return err
	}
	if _, err := result.RowsAffected(); err != nil {
		return err
	}

	if err := d.Vacuum(ctx); err != nil {
		// Prevent linter warning.
		return err
	}
	return nil
}

func vacuumMemo(ctx context.Context, tx *sql.Tx) error {
	stmt := "DELETE FROM `memo` WHERE `creator_id` NOT IN (SELECT `id` FROM `user`)"
	_, err := tx.ExecContext(ctx, stmt)
	if err != nil {
		return err
	}

	return nil
}
