package sqlite

import (
	"context"
	"strings"

	"github.com/usememos/memos/store"
)

func (d *DB) CreateNest(ctx context.Context, create *store.Nest) (*store.Nest, error) {
	fields := []string{"`name`", "`creator_id`"}
	placeholder := []string{"?", "?"}
	args := []any{create.Name, create.CreatorID}

	stmt := "INSERT INTO `nest` (" + strings.Join(fields, ", ") + ") VALUES (" + strings.Join(placeholder, ", ") + ") RETURNING `id`, `created_ts`, `row_status`"
	if err := d.db.QueryRowContext(ctx, stmt, args...).Scan(
		&create.ID,
		&create.CreatedTs,
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
	if v := find.Name; v != nil {
		where, args = append(where, "`nest`.`name` = ?"), append(args, *v)
	}
	if v := find.CreatorID; v != nil {
		where, args = append(where, "`nest`.`creator_id` = ?"), append(args, *v)
	}
	if v := find.RowStatus; v != nil {
		where, args = append(where, "`nest`.`row_status` = ?"), append(args, *v)
	}

	orderBy := []string{}
	order := "DESC"
	orderBy = append(orderBy, "`created_ts` "+order)
	orderBy = append(orderBy, "`id` "+order)

	fields := []string{
		"`nest`.`id` AS `id`",
		"`nest`.`name` AS `name`",
		"`nest`.`creator_id` AS `creator_id`",
		"`nest`.`created_ts` AS `created_ts`",
		"`nest`.`row_status` AS `row_status`",
	}

	query := "SELECT " + strings.Join(fields, ", ") + "FROM `nest` " +
		"WHERE " + strings.Join(where, " AND ") + " " +
		"ORDER BY " + strings.Join(orderBy, ", ")

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
	if v := update.Name; v != nil {
		set, args = append(set, "`name` = ?"), append(args, *v)
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
