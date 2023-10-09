package store

import (
	"context"
)

type Activity struct {
	ID int32

	// Standard fields
	CreatorID int32
	CreatedTs int64

	// Domain specific fields
	Type    string
	Level   string
	Payload string
}

type FindActivity struct {
	ID *int32
}

func (s *Store) CreateActivity(ctx context.Context, create *Activity) (*Activity, error) {
	return s.driver.CreateActivity(ctx, create)
}

func (s *Store) ListActivity(ctx context.Context, find *FindActivity) ([]*Activity, error) {
	return s.driver.ListActivity(ctx, find)
}
