package mysql

import (
	"context"

	"github.com/pkg/errors"

	"github.com/usememos/memos/store"
)

func (d *DB) CreateActivity(ctx context.Context, create *store.Activity) (*store.Activity, error) {
	stmt := "INSERT INTO activity (`creator_id`, `type`, `level`, `payload`) VALUES (?, ?, ?, ?)"
	result, err := d.db.ExecContext(ctx, stmt,
		create.CreatorID,
		create.Type,
		create.Level,
		create.Payload,
	)
	if err != nil {
		return nil, errors.Wrap(err, "failed to execute statement")
	}

	id, err := result.LastInsertId()
	if err != nil {
		return nil, errors.Wrap(err, "failed to get last insert id")
	}

	return d.FindActivity(ctx, id)
}

func (d *DB) FindActivity(ctx context.Context, id int64) (*store.Activity, error) {
	var activity store.Activity
	stmt := "SELECT `id`, `creator_id`, `type`, `level`, `payload`, UNIX_TIMESTAMP(`created_ts`) FROM `activity` WHERE `id` = ?"
	if err := d.db.QueryRowContext(ctx, stmt, id).Scan(
		&activity.ID,
		&activity.CreatorID,
		&activity.Type,
		&activity.Level,
		&activity.Payload,
		&activity.CreatedTs,
	); err != nil {
		return nil, errors.Wrap(err, "failed to db.QueryRow")
	}

	return &activity, nil
}
