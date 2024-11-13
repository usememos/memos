package mysql

import (
	"context"
	"fmt"
	"strings"

	"github.com/pkg/errors"

	"github.com/usememos/memos/store"
)

func (d *DB) CreateNest(ctx context.Context, create *store.Nest) (*store.Nest, error) {
	fields := []string{"`name`", "`creator_id`"}
	placeholder := []string{"?", "?"}
	args := []any{create.Name, create.CreatorID}

	stmt := "INSERT INTO `nest` (" + strings.Join(fields, ", ") + ") VALUES (" + strings.Join(placeholder, ", ") + ")"
	result, err := d.db.ExecContext(ctx, stmt, args...)
	if err != nil {
		return nil, err
	}

	rawID, err := result.LastInsertId()
	if err != nil {
		return nil, err
	}
	id := int32(rawID)
	nest, err := d.GetNest(ctx, &store.FindNest{ID: &id})
	if err != nil {
		return nil, err
	}
	if nest == nil {
		return nil, errors.Errorf("failed to create nest")
	}
	return nest, nil
}

func (d *DB) ListNests(ctx context.Context, find *store.FindNest) ([]*store.Nest, error) {
	where, having, args := []string{"1 = 1"}, []string{"1 = 1"}, []any{}

	if v := find.ID; v != nil {
		where, args = append(where, "`nest`.`id` = ?"), append(args, *v)
	}
	if v := find.Name; v != nil {
		where, args = append(where, "`nest`.`name` = ?"), append(args, *v)
	}
	if v := find.CreatorID; v != nil {
		where, args = append(where, "`nest`.`creator_id` = ?"), append(args, *v)
	}
	if v := find.RowStatus; v != nil {
		where, args = append(where, "`nest`.`row_status` = ?"), append(args, *v)
	}
	if v := find.CreatedTsBefore; v != nil {
		where, args = append(where, "UNIX_TIMESTAMP(`nest`.`created_ts`) < ?"), append(args, *v)
	}
	if v := find.CreatedTsAfter; v != nil {
		where, args = append(where, "UNIX_TIMESTAMP(`nest`.`created_ts`) > ?"), append(args, *v)
	}
	if v := find.UpdatedTsBefore; v != nil {
		where, args = append(where, "UNIX_TIMESTAMP(`nest`.`updated_ts`) < ?"), append(args, *v)
	}
	if v := find.UpdatedTsAfter; v != nil {
		where, args = append(where, "UNIX_TIMESTAMP(`nest`.`updated_ts`) > ?"), append(args, *v)
	}

	orders := []string{}
	if find.OrderByPinned {
		orders = append(orders, "`pinned` DESC")
	}
	order := "DESC"
	if find.OrderByTimeAsc {
		order = "ASC"
	}
	if find.OrderByUpdatedTs {
		orders = append(orders, "`updated_ts` "+order)
	} else {
		orders = append(orders, "`created_ts` "+order)
	}
	orders = append(orders, "`id` "+order)

	fields := []string{
		"`nest`.`id` AS `id`",
		"`nest`.`name` AS `name`",
		"`nest`.`creator_id` AS `creator_id`",
		"UNIX_TIMESTAMP(`nest`.`created_ts`) AS `created_ts`",
		"UNIX_TIMESTAMP(`nest`.`updated_ts`) AS `updated_ts`",
		"`nest`.`row_status` AS `row_status`",
	}

	query := "SELECT " + strings.Join(fields, ", ") + " FROM `nest`" + " " +
		"WHERE " + strings.Join(where, " AND ") + " " +
		"HAVING " + strings.Join(having, " AND ") + " " +
		"ORDER BY " + strings.Join(orders, ", ")
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
			&nest.Name,
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

func (d *DB) GetNest(ctx context.Context, find *store.FindNest) (*store.Nest, error) {
	list, err := d.ListNests(ctx, find)
	if err != nil {
		return nil, err
	}
	if len(list) == 0 {
		return nil, nil
	}

	nest := list[0]
	return nest, nil
}

func (d *DB) UpdateNest(ctx context.Context, update *store.UpdateNest) error {
	set, args := []string{}, []any{}
	if v := update.Name; v != nil {
		set, args = append(set, "`name` = ?"), append(args, *v)
	}
	if v := update.CreatedTs; v != nil {
		set, args = append(set, "`created_ts` = FROM_UNIXTIME(?)"), append(args, *v)
	}
	if v := update.UpdatedTs; v != nil {
		set, args = append(set, "`updated_ts` = FROM_UNIXTIME(?)"), append(args, *v)
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
