package store

import (
	"context"

	storepb "github.com/usememos/memos/proto/gen/store"
)

type Driver interface {
	Close() error

	Migrate(ctx context.Context) error
	Vacuum(ctx context.Context) error
	BackupTo(ctx context.Context, filename string) error

	CreateActivity(ctx context.Context, create *Activity) (*Activity, error)

	CreateResource(ctx context.Context, create *Resource) (*Resource, error)
	ListResources(ctx context.Context, find *FindResource) ([]*Resource, error)
	UpdateResource(ctx context.Context, update *UpdateResource) (*Resource, error)
	DeleteResource(ctx context.Context, delete *DeleteResource) error

	CreateMemo(ctx context.Context, create *Memo) (*Memo, error)
	ListMemos(ctx context.Context, find *FindMemo) ([]*Memo, error)
	UpdateMemo(ctx context.Context, update *UpdateMemo) error
	DeleteMemo(ctx context.Context, delete *DeleteMemo) error
	FindMemosVisibilityList(ctx context.Context, memoIDs []int32) ([]Visibility, error)

	UpsertMemoRelation(ctx context.Context, create *MemoRelation) (*MemoRelation, error)
	ListMemoRelations(ctx context.Context, find *FindMemoRelation) ([]*MemoRelation, error)
	DeleteMemoRelation(ctx context.Context, delete *DeleteMemoRelation) error

	UpsertMemoOrganizer(ctx context.Context, upsert *MemoOrganizer) (*MemoOrganizer, error)
	GetMemoOrganizer(ctx context.Context, find *FindMemoOrganizer) (*MemoOrganizer, error)
	DeleteMemoOrganizer(ctx context.Context, delete *DeleteMemoOrganizer) error

	UpsertSystemSetting(ctx context.Context, upsert *SystemSetting) (*SystemSetting, error)
	ListSystemSettings(ctx context.Context, find *FindSystemSetting) ([]*SystemSetting, error)

	CreateUser(ctx context.Context, create *User) (*User, error)
	UpdateUser(ctx context.Context, update *UpdateUser) (*User, error)
	ListUsers(ctx context.Context, find *FindUser) ([]*User, error)
	DeleteUser(ctx context.Context, delete *DeleteUser) error

	UpsertUserSetting(ctx context.Context, upsert *UserSetting) (*UserSetting, error)
	ListUserSettings(ctx context.Context, find *FindUserSetting) ([]*UserSetting, error)
	UpsertUserSettingV1(ctx context.Context, upsert *storepb.UserSetting) (*storepb.UserSetting, error)
	ListUserSettingsV1(ctx context.Context, find *FindUserSettingV1) ([]*storepb.UserSetting, error)

	CreateIdentityProvider(ctx context.Context, create *IdentityProvider) (*IdentityProvider, error)
	ListIdentityProviders(ctx context.Context, find *FindIdentityProvider) ([]*IdentityProvider, error)
	GetIdentityProvider(ctx context.Context, find *FindIdentityProvider) (*IdentityProvider, error)
	UpdateIdentityProvider(ctx context.Context, update *UpdateIdentityProvider) (*IdentityProvider, error)
	DeleteIdentityProvider(ctx context.Context, delete *DeleteIdentityProvider) error

	UpsertTag(ctx context.Context, upsert *Tag) (*Tag, error)
	ListTags(ctx context.Context, find *FindTag) ([]*Tag, error)
	DeleteTag(ctx context.Context, delete *DeleteTag) error

	CreateStorage(ctx context.Context, create *Storage) (*Storage, error)
	ListStorages(ctx context.Context, find *FindStorage) ([]*Storage, error)
	GetStorage(ctx context.Context, find *FindStorage) (*Storage, error)
	UpdateStorage(ctx context.Context, update *UpdateStorage) (*Storage, error)
	DeleteStorage(ctx context.Context, delete *DeleteStorage) error
}
