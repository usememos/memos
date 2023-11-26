package postgres

import (
	"context"

	"github.com/pkg/errors"
	"github.com/usememos/memos/store"
)

func (d *DB) CreateActivity(ctx context.Context, create *store.Activity) (*store.Activity, error) {
	//return nil err so it pass compile
	return nil, errors.New("Unimplemented")

}

func (d *DB) ListActivities(ctx context.Context, find *store.FindActivity) ([]*store.Activity, error) {
	return nil, errors.New("Unimplemented")

}
