package store

import (
	"context"
	"sync"

	"github.com/usememos/memos/server/profile"
)

// Store provides database access to all raw objects.
type Store struct {
	Profile               *profile.Profile
	driver                Driver
	workspaceSettingCache sync.Map // map[string]*storepb.WorkspaceSetting
	userCache             sync.Map // map[int]*User
	userSettingCache      sync.Map // map[string]*storepb.UserSetting
	idpCache              sync.Map // map[int]*storepb.IdentityProvider
}

// New creates a new instance of Store.
func New(driver Driver, profile *profile.Profile) *Store {
	return &Store{
		driver:  driver,
		Profile: profile,
	}
}

func (*Store) MigrateManually(context.Context) error {
	return nil
}

func (s *Store) Close() error {
	return s.driver.Close()
}

func (s *Store) GetCurrentDBSize(ctx context.Context) (int64, error) {
	return s.driver.GetCurrentDBSize(ctx)
}
