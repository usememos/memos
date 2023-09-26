package store

import "context"

type Driver interface {
	CreateActivity(ctx context.Context, create *Activity) (*Activity, error)

	UpsertSystemSetting(ctx context.Context, upsert *SystemSetting) (*SystemSetting, error)
	ListSystemSettings(ctx context.Context, find *FindSystemSetting) ([]*SystemSetting, error)
}
