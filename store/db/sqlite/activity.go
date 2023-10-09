package sqlite

import (
	"context"
	"strings"

	"github.com/usememos/memos/store"
)

func (d *DB) CreateActivity(ctx context.Context, create *store.Activity) (*store.Activity, error) {
	fields := []string{"`creator_id`", "`type`", "`level`", "`payload`"}
	placeholder := []string{"?", "?", "?", "?"}
	args := []any{create.CreatorID, create.Type, create.Level, create.Payload}

	if create.ID != 0 {
		fields = append(fields, "`id`")
		placeholder = append(placeholder, "?")
		args = append(args, create.ID)
	}

	if create.CreatedTs != 0 {
		fields = append(fields, "`created_ts`")
		placeholder = append(placeholder, "?")
		args = append(args, create.CreatedTs)
	}

	stmt := "INSERT INTO activity (" + strings.Join(fields, ", ") + ") VALUES (" + strings.Join(placeholder, ", ") + ") RETURNING `id`, `created_ts`"
	if err := d.db.QueryRowContext(ctx, stmt, args...).Scan(
		&create.ID,
		&create.CreatedTs,
	); err != nil {
		return nil, err
	}

	return create, nil
}

func (d *DB) ListActivity(ctx context.Context, find *store.FindActivity) ([]*store.Activity, error) {
	where, args := []string{"1 = 1"}, []any{}

	if find.ID != nil {
		where, args = append(where, "`id` = ?"), append(args, *find.ID)
	}

	query := "SELECT `id`, `creator_id`, `type`, `level`, `payload`, `created_ts` FROM `activity` WHERE " + strings.Join(where, " AND ")
	rows, err := d.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	list := []*store.Activity{}
	for rows.Next() {
		activity := &store.Activity{}
		if err := rows.Scan(
			&activity.ID,
			&activity.CreatorID,
			&activity.Type,
			&activity.Level,
			&activity.Payload,
			&activity.CreatedTs,
		); err != nil {
			return nil, err
		}

		list = append(list, activity)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return list, nil
}
