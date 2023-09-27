package mysql

import (
	"context"
	"time"

	"github.com/usememos/memos/store"
)

func (d *Driver) CreateActivity(ctx context.Context, create *store.Activity) (*store.Activity, error) {
	create.CreatedTs = time.Now().Unix()
	stmt := `
		INSERT INTO activity (
			creator_id,
			type,
			level,
			payload,
			created_ts
		)
		VALUES (?, ?, ?, ?, ?)
	`
	result, err := d.db.ExecContext(
		ctx,
		stmt,
		create.CreatorID,
		create.Type,
		create.Level,
		create.Payload,
		create.CreatedTs,
	)
	if err != nil {
		return nil, err
	}

	id, err := result.LastInsertId()
	if err != nil {
		return nil, err
	}

	create.ID = int32(id)
	return create, nil
}
