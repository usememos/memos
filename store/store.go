package store

import (
	"github.com/redis/go-redis/v9"
	"sync"

	"github.com/usememos/memos/server/profile"
)

// Store provides database access to all raw objects.
type Store struct {
	Profile               *profile.Profile
	driver                Driver
	workspaceSettingCache sync.Map      // map[string]*storepb.WorkspaceSetting
	userCache             sync.Map      // map[int]*User
	userSettingCache      sync.Map      // map[string]*storepb.UserSetting
	idpCache              sync.Map      // map[int]*storepb.IdentityProvider
	redisClient           *redis.Client // *User add second level cache
}

// New creates a new instance of Store.
func New(driver Driver, profile *profile.Profile, rdb *redis.Client) *Store {
	return &Store{
		driver:      driver,
		Profile:     profile,
		redisClient: rdb,
	}
}

func (s *Store) GetDriver() Driver {
	return s.driver
}

func (s *Store) Close() error {
	return s.driver.Close()
}
