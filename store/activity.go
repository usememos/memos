package store

import (
	"context"
)

type Activity struct {
	ID int

	// Standard fields
	CreatorID int
	CreatedTs int64

	// Domain specific fields
	Type    string
	Level   string
	Payload string
}

func (s *Store) CreateActivity(ctx context.Context, create *Activity) (*Activity, error) {
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
	if err := s.db.QueryRowContext(ctx, stmt, create.CreatorID, create.Type, create.Level, create.Payload).Scan(
		&create.ID,
		&create.CreatedTs,
	); err != nil {
		return nil, err
	}

	activity := create
	return activity, nil
}
