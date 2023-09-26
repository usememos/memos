package store

import "context"

type Database interface {
	CreateActivity(ctx context.Context, create *Activity) (*Activity, error)
}
