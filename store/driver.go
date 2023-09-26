package store

import "context"

type Driver interface {
	CreateActivity(ctx context.Context, create *Activity) (*Activity, error)
}
