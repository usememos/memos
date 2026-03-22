package cache

import (
	"context"
	"sync"
	"sync/atomic"
	"time"
)

// Interface defines the operations a cache must support.
type Interface interface {
	// Set adds a value to the cache with the default TTL.
	Set(ctx context.Context, key string, value any)

	// SetWithTTL adds a value to the cache with a custom TTL.
	SetWithTTL(ctx context.Context, key string, value any, ttl time.Duration)

	// Get retrieves a value from the cache.
	Get(ctx context.Context, key string) (any, bool)

	// Delete removes a value from the cache.
	Delete(ctx context.Context, key string)

	// Clear removes all values from the cache.
	Clear(ctx context.Context)

	// Size returns the number of items in the cache.
	Size() int64

	// Close stops all background tasks and releases resources.
	Close() error
}

// item represents a cached value with metadata.
type item struct {
	value      any
	expiration time.Time
	size       int // Approximate size in bytes
}

// Config contains options for configuring a cache.
type Config struct {
	// DefaultTTL is the default time-to-live for cache entries.
	DefaultTTL time.Duration

	// CleanupInterval is how often the cache runs cleanup.
	CleanupInterval time.Duration

	// MaxItems is the maximum number of items allowed in the cache.
	MaxItems int

	// OnEviction is called when an item is evicted from the cache.
	OnEviction func(key string, value any)
}

// DefaultConfig returns a default configuration for the cache.
func DefaultConfig() Config {
	return Config{
		DefaultTTL:      10 * time.Minute,
		CleanupInterval: 5 * time.Minute,
		MaxItems:        1000,
		OnEviction:      nil,
	}
}

// Cache is a thread-safe in-memory cache with TTL and memory management.
type Cache struct {
	itemCount  atomic.Int64 // Use atomic operations to track item count
	data       sync.Map
	config     Config
	stopChan   chan struct{}
	closedChan chan struct{}
}

// New creates a new memory cache with the given configuration.
func New(config Config) *Cache {
	c := &Cache{
		config:     config,
		stopChan:   make(chan struct{}),
		closedChan: make(chan struct{}),
	}

	go c.cleanupLoop()
	return c
}

// NewDefault creates a new memory cache with default configuration.
func NewDefault() *Cache {
	return New(DefaultConfig())
}

// Set adds a value to the cache with the default TTL.
func (c *Cache) Set(ctx context.Context, key string, value any) {
	c.SetWithTTL(ctx, key, value, c.config.DefaultTTL)
}

// SetWithTTL adds a value to the cache with a custom TTL.
func (c *Cache) SetWithTTL(_ context.Context, key string, value any, ttl time.Duration) {
	// Estimate size of the item (very rough approximation).
	size := estimateSize(value)

	// Check if item already exists to avoid double counting.
	if _, exists := c.data.Load(key); exists {
		c.data.Delete(key)
	} else {
		// Only increment if this is a new key.
		(&c.itemCount).Add(1)
	}

	c.data.Store(key, item{
		value:      value,
		expiration: time.Now().Add(ttl),
		size:       size,
	})

	// If we're over the max items, clean up old items.
	if c.config.MaxItems > 0 && (&c.itemCount).Load() > int64(c.config.MaxItems) {
		c.cleanupOldest()
	}
}

// Get retrieves a value from the cache.
func (c *Cache) Get(_ context.Context, key string) (any, bool) {
	value, ok := c.data.Load(key)
	if !ok {
		return nil, false
	}

	itm, ok := value.(item)
	if !ok {
		// If the value is not of type item, it means it was corrupted or not set correctly.
		c.data.Delete(key)
		return nil, false
	}
	if time.Now().After(itm.expiration) {
		c.data.Delete(key)
		(&c.itemCount).Add(-1)

		if c.config.OnEviction != nil {
			c.config.OnEviction(key, itm.value)
		}

		return nil, false
	}

	return itm.value, true
}

// Delete removes a value from the cache.
func (c *Cache) Delete(_ context.Context, key string) {
	if value, loaded := c.data.LoadAndDelete(key); loaded {
		(&c.itemCount).Add(-1)

		if c.config.OnEviction != nil {
			if itm, ok := value.(item); ok {
				c.config.OnEviction(key, itm.value)
			}
		}
	}
}

// Clear removes all values from the cache.
func (c *Cache) Clear(_ context.Context) {
	count := 0
	c.data.Range(func(key, value any) bool {
		if c.config.OnEviction != nil {
			itm, ok := value.(item)
			if ok {
				if keyStr, ok := key.(string); ok {
					c.config.OnEviction(keyStr, itm.value)
				}
			}
		}
		c.data.Delete(key)
		count++
		return true
	})
	(&c.itemCount).Store(0)
}

// Size returns the number of items in the cache.
func (c *Cache) Size() int64 {
	return (&c.itemCount).Load()
}

// Close stops the cache cleanup goroutine.
func (c *Cache) Close() error {
	select {
	case <-c.stopChan:
		// Already closed
		return nil
	default:
		close(c.stopChan)
		<-c.closedChan // Wait for cleanup goroutine to exit
		return nil
	}
}

// cleanupLoop periodically cleans up expired items.
func (c *Cache) cleanupLoop() {
	ticker := time.NewTicker(c.config.CleanupInterval)
	defer func() {
		ticker.Stop()
		close(c.closedChan)
	}()

	for {
		select {
		case <-ticker.C:
			c.cleanup()
		case <-c.stopChan:
			return
		}
	}
}

// cleanup removes expired items.
func (c *Cache) cleanup() {
	evicted := make(map[string]any)
	count := 0

	c.data.Range(func(key, value any) bool {
		itm, ok := value.(item)
		if !ok {
			return true
		}
		if time.Now().After(itm.expiration) {
			c.data.Delete(key)
			count++

			if c.config.OnEviction != nil {
				if keyStr, ok := key.(string); ok {
					evicted[keyStr] = itm.value
				}
			}
		}
		return true
	})

	if count > 0 {
		(&c.itemCount).Add(-int64(count))

		// Call eviction callbacks outside the loop to avoid blocking the range
		if c.config.OnEviction != nil {
			for k, v := range evicted {
				c.config.OnEviction(k, v)
			}
		}
	}
}

// cleanupOldest removes the oldest items if we're over the max items.
func (c *Cache) cleanupOldest() {
	// Remove 20% of max items at once
	threshold := max(c.config.MaxItems/5, 1)

	currentCount := (&c.itemCount).Load()

	// If we're not over the threshold, don't do anything
	if currentCount <= int64(c.config.MaxItems) {
		return
	}

	// Find the oldest items
	type keyExpPair struct {
		key        string
		value      any
		expiration time.Time
	}
	candidates := make([]keyExpPair, 0, threshold)

	c.data.Range(func(key, value any) bool {
		itm, ok := value.(item)
		if !ok {
			return true
		}
		if keyStr, ok := key.(string); ok && len(candidates) < threshold {
			candidates = append(candidates, keyExpPair{keyStr, itm.value, itm.expiration})
			return true
		}

		// Find the newest item in candidates
		newestIdx := 0
		for i := 1; i < len(candidates); i++ {
			if candidates[i].expiration.After(candidates[newestIdx].expiration) {
				newestIdx = i
			}
		}

		// Replace it if this item is older
		if itm.expiration.Before(candidates[newestIdx].expiration) {
			candidates[newestIdx] = keyExpPair{key.(string), itm.value, itm.expiration}
		}

		return true
	})

	// Delete the oldest items
	deletedCount := 0
	for _, candidate := range candidates {
		c.data.Delete(candidate.key)
		deletedCount++

		if c.config.OnEviction != nil {
			c.config.OnEviction(candidate.key, candidate.value)
		}
	}

	// Update count
	if deletedCount > 0 {
		(&c.itemCount).Add(-int64(deletedCount))
	}
}

// estimateSize attempts to estimate the memory footprint of a value.
func estimateSize(value any) int {
	switch v := value.(type) {
	case string:
		return len(v) + 24 // base size + string overhead
	case []byte:
		return len(v) + 24 // base size + slice overhead
	case map[string]any:
		return len(v) * 64 // rough estimate
	default:
		return 64 // default conservative estimate
	}
}
