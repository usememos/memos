package postgres

import (
	"context"
	"fmt"
	"strings"

	"github.com/pkg/errors"

	"github.com/usememos/memos/store"
)

func (d *DB) CreateNest(ctx context.Context, create *store.Nest) (*store.Nest, error) {
	fields := []string{"name", "creator_id"}
	args := []any{create.Name, create.CreatorID}

	stmt := "INSERT INTO nest (" + strings.Join(fields, ", ") + ") VALUES (" + placeholders(len(args)) + ") RETURNING id, created_ts, updated_ts, row_status"
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
		where, args = append(where, "nest.id = "+placeholder(len(args)+1)), append(args, *v)
	}
	if v := find.Name; v != nil {
		where, args = append(where, "nest.name = "+placeholder(len(args)+1)), append(args, *v)
	}
	if v := find.CreatorID; v != nil {
		where, args = append(where, "nest.creator_id = "+placeholder(len(args)+1)), append(args, *v)
	}
	if v := find.RowStatus; v != nil {
		where, args = append(where, "nest.row_status = "+placeholder(len(args)+1)), append(args, *v)
	}
	if v := find.CreatedTsBefore; v != nil {
		where, args = append(where, "nest.created_ts < "+placeholder(len(args)+1)), append(args, *v)
	}
	if v := find.CreatedTsAfter; v != nil {
		where, args = append(where, "nest.created_ts > "+placeholder(len(args)+1)), append(args, *v)
	}
	if v := find.UpdatedTsBefore; v != nil {
		where, args = append(where, "nest.updated_ts < "+placeholder(len(args)+1)), append(args, *v)
	}
	if v := find.UpdatedTsAfter; v != nil {
		where, args = append(where, "nest.updated_ts > "+placeholder(len(args)+1)), append(args, *v)
	}

	orders := []string{}
	if find.OrderByPinned {
		orders = append(orders, "pinned DESC")
	}
	order := "DESC"
	if find.OrderByTimeAsc {
		order = "ASC"
	}
	if find.OrderByUpdatedTs {
		orders = append(orders, "updated_ts "+order)
	} else {
		orders = append(orders, "created_ts "+order)
	}
	orders = append(orders, "id "+order)

	fields := []string{
		`nest.id AS id`,
		`nest.name AS name`,
		`nest.creator_id AS creator_id`,
		`nest.created_ts AS created_ts`,
		`nest.updated_ts AS updated_ts`,
		`nest.row_status AS row_status`,
	}

	query := `SELECT ` + strings.Join(fields, ", ") + `
		FROM nest
		WHERE ` + strings.Join(where, " AND ") + `
		ORDER BY ` + strings.Join(orders, ", ")
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
		set, args = append(set, "name = "+placeholder(len(args)+1)), append(args, *v)
	}
	if v := update.CreatedTs; v != nil {
		set, args = append(set, "created_ts = "+placeholder(len(args)+1)), append(args, *v)
	}
	if v := update.UpdatedTs; v != nil {
		set, args = append(set, "updated_ts = "+placeholder(len(args)+1)), append(args, *v)
	}
	if v := update.RowStatus; v != nil {
		set, args = append(set, "row_status = "+placeholder(len(args)+1)), append(args, *v)
	}

	stmt := `UPDATE nest SET ` + strings.Join(set, ", ") + ` WHERE id = ` + placeholder(len(args)+1)
	args = append(args, update.ID)
	if _, err := d.db.ExecContext(ctx, stmt, args...); err != nil {
		return err
	}
	return nil
}

func (d *DB) DeleteNest(ctx context.Context, delete *store.DeleteNest) error {
	where, args := []string{"id = " + placeholder(1)}, []any{delete.ID}
	stmt := `DELETE FROM nest WHERE ` + strings.Join(where, " AND ")
	result, err := d.db.ExecContext(ctx, stmt, args...)
	if err != nil {
		return errors.Wrap(err, "failed to delete nest")
	}
	if _, err := result.RowsAffected(); err != nil {
		return err
	}
	return nil
}
