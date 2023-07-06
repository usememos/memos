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

// CreateActivity creates an instance of Activity.
func (s *Store) CreateActivity(ctx context.Context, create *Activity) (*Activity, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	query := `
		INSERT INTO activity (
			creator_id, 
			type, 
			level, 
			payload
		)
		VALUES (?, ?, ?, ?)
		RETURNING id, created_ts
	`
	if err := tx.QueryRowContext(ctx, query, create.CreatorID, create.Type, create.Level, create.Payload).Scan(
		&create.ID,
		&create.CreatedTs,
	); err != nil {
		return nil, err
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	activity := create
	return activity, nil
}
