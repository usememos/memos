package store

import (
	"os"
	"strconv"
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

	// Caches - using Interface to support both local and distributed caching
	workspaceSettingCache cache.Interface // cache for workspace settings
	userCache             cache.Interface // cache for users
	userSettingCache      cache.Interface // cache for user settings
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

	// Create appropriate cache instances based on configuration
	workspaceCache := createCacheInstance(cacheConfig, "workspace")
	userCache := createCacheInstance(cacheConfig, "user")
	userSettingCache := createCacheInstance(cacheConfig, "user_setting")

	store := &Store{
		driver:                driver,
		profile:               profile,
		cacheConfig:           cacheConfig,
		workspaceSettingCache: workspaceCache,
		userCache:             userCache,
		userSettingCache:      userSettingCache,
	}

	return store
}

// createCacheInstance creates either a hybrid distributed cache or local cache
// based on environment configuration.
func createCacheInstance(config cache.Config, cacheType string) cache.Interface {
	// Check if Redis is configured
	redisURL := os.Getenv("MEMOS_REDIS_URL")
	if redisURL == "" {
		// No Redis configured, use local cache
		return cache.New(config)
	}

	// Parse Redis configuration from environment
	redisConfig := cache.RedisConfig{
		URL:          redisURL,
		PoolSize:     getEnvInt("MEMOS_REDIS_POOL_SIZE", 10),
		DialTimeout:  getEnvDuration("MEMOS_REDIS_DIAL_TIMEOUT", 5*time.Second),
		ReadTimeout:  getEnvDuration("MEMOS_REDIS_READ_TIMEOUT", 3*time.Second),
		WriteTimeout: getEnvDuration("MEMOS_REDIS_WRITE_TIMEOUT", 3*time.Second),
		KeyPrefix:    getEnvString("MEMOS_REDIS_KEY_PREFIX", "memos") + ":" + cacheType,
	}

	// Try to create hybrid cache with Redis
	hybridCache, err := cache.NewHybridCache(redisConfig, config)
	if err != nil {
		// Failed to create hybrid cache, fallback to local cache
		return cache.New(config)
	}

	return hybridCache
}

// getEnvInt gets an integer from environment with default fallback.
func getEnvInt(key string, defaultValue int) int {
	if str := os.Getenv(key); str != "" {
		if val, err := strconv.Atoi(str); err == nil {
			return val
		}
	}
	return defaultValue
}

// getEnvDuration gets a duration from environment with default fallback.
func getEnvDuration(key string, defaultValue time.Duration) time.Duration {
	if str := os.Getenv(key); str != "" {
		if val, err := time.ParseDuration(str); err == nil {
			return val
		}
	}
	return defaultValue
}

// getEnvString gets a string from environment with default fallback.
func getEnvString(key string, defaultValue string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return defaultValue
}

func (s *Store) GetDriver() Driver {
	return s.driver
}

// GetUserCache returns the user cache instance.
func (s *Store) GetUserCache() cache.Interface {
	return s.userCache
}

// GetUserSettingCache returns the user setting cache instance.
func (s *Store) GetUserSettingCache() cache.Interface {
	return s.userSettingCache
}

// SetUserSettingCache sets the user setting cache instance (for testing).
func (s *Store) SetUserSettingCache(c cache.Interface) {
	s.userSettingCache = c
}

// GetWorkspaceSettingCache returns the workspace setting cache instance.
func (s *Store) GetWorkspaceSettingCache() cache.Interface {
	return s.workspaceSettingCache
}

func (s *Store) Close() error {
	// Stop all cache cleanup goroutines
	if err := s.workspaceSettingCache.Close(); err != nil {
		return err
	}
	if err := s.userCache.Close(); err != nil {
		return err
	}
	if err := s.userSettingCache.Close(); err != nil {
		return err
	}

	return s.driver.Close()
}
