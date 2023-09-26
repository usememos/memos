package store

import "context"

type Driver interface {
	CreateActivity(ctx context.Context, create *Activity) (*Activity, error)

	CreateResource(ctx context.Context, create *Resource) (*Resource, error)
	ListResources(ctx context.Context, find *FindResource) ([]*Resource, error)
	UpdateResource(ctx context.Context, update *UpdateResource) (*Resource, error)
	DeleteResource(ctx context.Context, delete *DeleteResource) error

	UpsertSystemSetting(ctx context.Context, upsert *SystemSetting) (*SystemSetting, error)
	ListSystemSettings(ctx context.Context, find *FindSystemSetting) ([]*SystemSetting, error)

	CreateUser(ctx context.Context, create *User) (*User, error)
	UpdateUser(ctx context.Context, update *UpdateUser) (*User, error)
	ListUsers(ctx context.Context, find *FindUser) ([]*User, error)
	DeleteUser(ctx context.Context, delete *DeleteUser) error
}
