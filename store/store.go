package store

import (
	"context"
	"time"

	"github.com/usememos/memos/internal/profile"
	"github.com/usememos/memos/store/cache"
)

// Store provides database access to all raw objects.
type Store struct {
	profile *profile.Profile
	driver  Driver

	// Cache settings
	cacheConfig cache.Config

	// Caches
	instanceSettingCache *cache.Cache // cache for instance settings
	userCache            *cache.Cache // cache for users
	userSettingCache     *cache.Cache // cache for user settings
	linkMetadataCache    *cache.Cache // cache for link metadata (OpenGraph)
}

// New creates a new instance of Store.
func New(driver Driver, profile *profile.Profile) *Store {
	// Default cache settings
	cacheConfig := cache.Config{
		DefaultTTL:      10 * time.Minute,
		CleanupInterval: 5 * time.Minute,
		MaxItems:        1000,
		OnEviction:      nil,
	}

	// Link metadata cache with 7 day TTL
	linkMetadataCacheConfig := cache.Config{
		DefaultTTL:      7 * 24 * time.Hour, // 7 days
		CleanupInterval: 5 * time.Minute,
		MaxItems:        1000,
		OnEviction:      nil,
	}

	store := &Store{
		driver:               driver,
		profile:              profile,
		cacheConfig:          cacheConfig,
		instanceSettingCache: cache.New(cacheConfig),
		userCache:            cache.New(cacheConfig),
		userSettingCache:     cache.New(cacheConfig),
		linkMetadataCache:    cache.New(linkMetadataCacheConfig),
	}

	return store
}

func (s *Store) GetDriver() Driver {
	return s.driver
}

// GetLinkMetadataFromCache retrieves link metadata from cache if available.
func (s *Store) GetLinkMetadataFromCache(ctx context.Context, url string) (interface{}, bool) {
	return s.linkMetadataCache.Get(ctx, url)
}

// SetLinkMetadataInCache stores link metadata in cache with the default TTL (7 days).
func (s *Store) SetLinkMetadataInCache(ctx context.Context, url string, metadata interface{}) {
	s.linkMetadataCache.Set(ctx, url, metadata)
}

func (s *Store) Close() error {
	// Stop all cache cleanup goroutines
	s.instanceSettingCache.Close()
	s.userCache.Close()
	s.userSettingCache.Close()
	s.linkMetadataCache.Close()

	return s.driver.Close()
}
