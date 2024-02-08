package store

import (
	"context"
	"sync"

	"github.com/usememos/memos/ent"
	"github.com/usememos/memos/server/profile"
)

// Store provides database access to all raw objects.
type Store struct {
	Profile            *profile.Profile
	driver             Driver
	systemSettingCache sync.Map // map[string]*SystemSetting
	userCache          sync.Map // map[int]*User
	userSettingCache   sync.Map // map[string]*UserSetting
	idpCache           sync.Map // map[int]*IdentityProvider

	V2 *ent.Client
}

// New creates a new instance of Store.
func New(driver Driver, dbv2 *ent.Client, profile *profile.Profile) *Store {
	return &Store{
		driver:  driver,
		V2:      dbv2,
		Profile: profile,
	}
}

func (s *Store) Vacuum(ctx context.Context) error {
	return s.driver.Vacuum(ctx)
}

func (s *Store) Close() error {
	return s.driver.Close()
}

func (s *Store) GetCurrentDBSize(ctx context.Context) (int64, error) {
	return s.driver.GetCurrentDBSize(ctx)
}
