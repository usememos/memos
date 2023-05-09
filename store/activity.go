package store

import (
	"context"
	"database/sql"

	"github.com/usememos/memos/api"
)

// activityRaw is the store model for an Activity.
// Fields have exactly the same meanings as Activity.
type activityRaw struct {
	ID int

	// Standard fields
	CreatorID int
	CreatedTs int64

	// Domain specific fields
	Type    api.ActivityType
	Level   api.ActivityLevel
	Payload string
}

// toActivity creates an instance of Activity based on the ActivityRaw.
func (raw *activityRaw) toActivity() *api.Activity {
	return &api.Activity{
		ID: raw.ID,

		CreatorID: raw.CreatorID,
		CreatedTs: raw.CreatedTs,

		Type:    raw.Type,
		Level:   raw.Level,
		Payload: raw.Payload,
	}
}

// CreateActivity creates an instance of Activity.
func (s *Store) CreateActivity(ctx context.Context, create *api.ActivityCreate) (*api.Activity, error) {
	if s.Profile.Mode == "prod" {
		return nil, nil
	}

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, FormatError(err)
	}
	defer tx.Rollback()

	activityRaw, err := createActivity(ctx, tx, create)
	if err != nil {
		return nil, err
	}

	if err := tx.Commit(); err != nil {
		return nil, FormatError(err)
	}

	activity := activityRaw.toActivity()
	return activity, nil
}

// createActivity creates a new activity.
func createActivity(ctx context.Context, tx *sql.Tx, create *api.ActivityCreate) (*activityRaw, error) {
	query := `
		INSERT INTO activity (
			creator_id, 
			type, 
			level, 
			payload
		)
		VALUES (?, ?, ?, ?)
		RETURNING id, type, level, payload, creator_id, created_ts
	`
	var activityRaw activityRaw
	if err := tx.QueryRowContext(ctx, query, create.CreatorID, create.Type, create.Level, create.Payload).Scan(
		&activityRaw.ID,
		&activityRaw.Type,
		&activityRaw.Level,
		&activityRaw.Payload,
		&activityRaw.CreatorID,
		&activityRaw.CreatedTs,
	); err != nil {
		return nil, FormatError(err)
	}

	return &activityRaw, nil
}
