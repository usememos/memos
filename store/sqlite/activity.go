package sqlite

import (
	"context"

	"github.com/usememos/memos/store"
)

func (d *Driver) CreateActivity(ctx context.Context, create *store.Activity) (*store.Activity, error) {
	stmt := `
		INSERT INTO activity (
			creator_id,
			type,
			level,
			payload
		)
		VALUES (?, ?, ?, ?)
		RETURNING id, created_ts
	`
	if err := d.db.QueryRowContext(ctx, stmt, create.CreatorID, create.Type, create.Level, create.Payload).Scan(
		&create.ID,
		&create.CreatedTs,
	); err != nil {
		return nil, err
	}

	return create, nil
}
