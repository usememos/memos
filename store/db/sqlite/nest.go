package sqlite

import (
	"context"
	"fmt"
	"strings"

	"github.com/usememos/memos/store"
)

func (d *DB) CreateNest(ctx context.Context, create *store.Nest) (*store.Nest, error) {
	fields := []string{"`uid`", "`creator_id`"}
	placeholder := []string{"?", "?"}
	args := []any{create.UID, create.CreatorID}

	stmt := "INSERT INTO `nest` (" + strings.Join(fields, ", ") + ") VALUES (" + strings.Join(placeholder, ", ") + ") RETURNING `id`, `created_ts`, `updated_ts`, `row_status`"
	if err := d.db.QueryRowContext(ctx, stmt, args...).Scan(
		&create.ID,
		&create.CreatedTs,
		&create.UpdatedTs,
		&create.RowStatus,
	); err != nil {
		return nil, err
	}

	return create, nil
}

func (d *DB) ListNests(ctx context.Context, find *store.FindNest) ([]*store.Nest, error) {
	where, args := []string{"1 = 1"}, []any{}

	if v := find.ID; v != nil {
		where, args = append(where, "`nest`.`id` = ?"), append(args, *v)
	}
	if v := find.UID; v != nil {
		where, args = append(where, "`nest`.`uid` = ?"), append(args, *v)
	}
	if v := find.CreatorID; v != nil {
		where, args = append(where, "`nest`.`creator_id` = ?"), append(args, *v)
	}
	if v := find.RowStatus; v != nil {
		where, args = append(where, "`nest`.`row_status` = ?"), append(args, *v)
	}
	if v := find.CreatedTsBefore; v != nil {
		where, args = append(where, "`nest`.`created_ts` < ?"), append(args, *v)
	}
	if v := find.CreatedTsAfter; v != nil {
		where, args = append(where, "`nest`.`created_ts` > ?"), append(args, *v)
	}
	if v := find.UpdatedTsBefore; v != nil {
		where, args = append(where, "`nest`.`updated_ts` < ?"), append(args, *v)
	}
	if v := find.UpdatedTsAfter; v != nil {
		where, args = append(where, "`nest`.`updated_ts` > ?"), append(args, *v)
	}

	orderBy := []string{}
	if find.OrderByPinned {
		orderBy = append(orderBy, "`pinned` DESC")
	}
	order := "DESC"
	if find.OrderByTimeAsc {
		order = "ASC"
	}
	if find.OrderByUpdatedTs {
		orderBy = append(orderBy, "`updated_ts` "+order)
	} else {
		orderBy = append(orderBy, "`created_ts` "+order)
	}
	orderBy = append(orderBy, "`id` "+order)

	fields := []string{
		"`nest`.`id` AS `id`",
		"`nest`.`uid` AS `uid`",
		"`nest`.`creator_id` AS `creator_id`",
		"`nest`.`created_ts` AS `created_ts`",
		"`nest`.`updated_ts` AS `updated_ts`",
		"`nest`.`row_status` AS `row_status`",
	}

	query := "SELECT " + strings.Join(fields, ", ") + "FROM `nest` " +
		"WHERE " + strings.Join(where, " AND ") + " " +
		"ORDER BY " + strings.Join(orderBy, ", ")
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

	list := make([]*store.Nest, 0)
	for rows.Next() {
		var nest store.Nest
		dests := []any{
			&nest.ID,
			&nest.UID,
			&nest.CreatorID,
			&nest.CreatedTs,
			&nest.UpdatedTs,
			&nest.RowStatus,
		}
		if err := rows.Scan(dests...); err != nil {
			return nil, err
		}
		list = append(list, &nest)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return list, nil
}

func (d *DB) UpdateNest(ctx context.Context, update *store.UpdateNest) error {
	set, args := []string{}, []any{}
	if v := update.UID; v != nil {
		set, args = append(set, "`uid` = ?"), append(args, *v)
	}
	if v := update.CreatedTs; v != nil {
		set, args = append(set, "`created_ts` = ?"), append(args, *v)
	}
	if v := update.UpdatedTs; v != nil {
		set, args = append(set, "`updated_ts` = ?"), append(args, *v)
	}
	if v := update.RowStatus; v != nil {
		set, args = append(set, "`row_status` = ?"), append(args, *v)
	}
	args = append(args, update.ID)

	stmt := "UPDATE `nest` SET " + strings.Join(set, ", ") + " WHERE `id` = ?"
	if _, err := d.db.ExecContext(ctx, stmt, args...); err != nil {
		return err
	}
	return nil
}

func (d *DB) DeleteNest(ctx context.Context, delete *store.DeleteNest) error {
	where, args := []string{"`id` = ?"}, []any{delete.ID}
	stmt := "DELETE FROM `nest` WHERE " + strings.Join(where, " AND ")
	result, err := d.db.ExecContext(ctx, stmt, args...)
	if err != nil {
		return err
	}
	if _, err := result.RowsAffected(); err != nil {
		return err
	}
	return nil
}
