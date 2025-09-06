package cache

import (
	"context"
	"log/slog"
	"sync"
	"time"

	"github.com/google/uuid"
)

// HybridCache provides a Redis-backed cache with in-memory fallback.
// It automatically handles Redis failures by falling back to local cache.
type HybridCache struct {
	redis  *RedisCache
	local  *Cache
	config Config
	podID  string

	// Event handling
	mu           sync.RWMutex
	subscription context.CancelFunc
	eventCh      chan CacheEvent
}

// NewHybridCache creates a new hybrid cache with Redis primary and local fallback.
func NewHybridCache(redisConfig RedisConfig, cacheConfig Config) (*HybridCache, error) {
	// Create Redis cache
	redisCache, err := NewRedisCache(redisConfig, cacheConfig)
	if err != nil {
		slog.Warn("failed to create Redis cache, falling back to local cache only", "error", err)
		return &HybridCache{
			local:   New(cacheConfig),
			config:  cacheConfig,
			podID:   generatePodID(),
			eventCh: make(chan CacheEvent, 100),
		}, nil
	}

	// Create local cache for fallback
	localCache := New(cacheConfig)

	hybrid := &HybridCache{
		redis:   redisCache,
		local:   localCache,
		config:  cacheConfig,
		podID:   generatePodID(),
		eventCh: make(chan CacheEvent, 100),
	}

	// Start event subscription if Redis is available
	if redisCache != nil {
		hybrid.startEventSubscription()
	}

	return hybrid, nil
}

// generatePodID creates a unique identifier for this pod instance.
func generatePodID() string {
	return uuid.New().String()[:8]
}

// startEventSubscription begins listening for cache events from other pods.
func (h *HybridCache) startEventSubscription() {
	ctx, cancel := context.WithCancel(context.Background())
	h.subscription = cancel

	go func() {
		defer func() {
			if r := recover(); r != nil {
				slog.Error("cache event subscription panicked", "panic", r)
			}
		}()

		err := h.redis.Subscribe(ctx, h.handleCacheEvent)
		if err != nil && err != context.Canceled {
			slog.Error("Redis subscription failed", "error", err)
		}
	}()

	// Start event processor
	go h.processEvents(ctx)
}

// handleCacheEvent processes cache events from other pods.
func (h *HybridCache) handleCacheEvent(event CacheEvent) {
	// Ignore events from this pod
	if event.Source == h.podID {
		return
	}

	select {
	case h.eventCh <- event:
		// Event queued successfully
	default:
		// Channel full, drop event
		slog.Warn("cache event channel full, dropping event", "event", event)
	}
}

// processEvents processes queued cache events.
func (h *HybridCache) processEvents(ctx context.Context) {
	for {
		select {
		case event := <-h.eventCh:
			h.processEvent(event)
		case <-ctx.Done():
			return
		}
	}
}

// processEvent handles a single cache event.
func (h *HybridCache) processEvent(event CacheEvent) {
	switch event.Type {
	case "delete":
		h.local.Delete(context.Background(), event.Key)
	case "clear":
		h.local.Clear(context.Background())
	}
}

// Set adds a value to both Redis and local cache.
func (h *HybridCache) Set(ctx context.Context, key string, value any) {
	h.SetWithTTL(ctx, key, value, h.config.DefaultTTL)
}

// SetWithTTL adds a value to both Redis and local cache with custom TTL.
func (h *HybridCache) SetWithTTL(ctx context.Context, key string, value any, ttl time.Duration) {
	// Always set in local cache first
	h.local.SetWithTTL(ctx, key, value, ttl)

	// Try to set in Redis (no event needed - other pods will get it on demand)
	if h.redis != nil {
		h.redis.SetWithTTL(ctx, key, value, ttl)
	}
}

// Get retrieves a value from cache, trying local first for speed, then Redis.
func (h *HybridCache) Get(ctx context.Context, key string) (any, bool) {
	// Try local cache first for speed
	if value, ok := h.local.Get(ctx, key); ok {
		return value, true
	}

	// Try Redis if local cache miss and Redis is available
	if h.redis != nil {
		if value, ok := h.redis.Get(ctx, key); ok {
			// Populate local cache for faster subsequent access
			h.local.SetWithTTL(ctx, key, value, h.config.DefaultTTL)
			return value, true
		}
	}

	return nil, false
}

// Delete removes a value from both Redis and local cache.
func (h *HybridCache) Delete(ctx context.Context, key string) {
	// Delete from local cache immediately
	h.local.Delete(ctx, key)

	// Try to delete from Redis and notify other pods
	if h.redis != nil {
		h.redis.Delete(ctx, key)

		// Publish delete event to other pods
		event := CacheEvent{
			Type:      "delete",
			Key:       key,
			Timestamp: time.Now(),
			Source:    h.podID,
		}

		if err := h.redis.Publish(ctx, event); err != nil {
			slog.Debug("failed to publish cache delete event", "key", key, "error", err)
		}
	}
}

// Clear removes all values from both Redis and local cache.
func (h *HybridCache) Clear(ctx context.Context) {
	// Clear local cache immediately
	h.local.Clear(ctx)

	// Try to clear Redis and notify other pods
	if h.redis != nil {
		h.redis.Clear(ctx)

		// Publish clear event to other pods
		event := CacheEvent{
			Type:      "clear",
			Key:       "",
			Timestamp: time.Now(),
			Source:    h.podID,
		}

		if err := h.redis.Publish(ctx, event); err != nil {
			slog.Debug("failed to publish cache clear event", "error", err)
		}
	}
}

// Size returns the size of the local cache (Redis size is expensive to compute).
func (h *HybridCache) Size() int64 {
	return h.local.Size()
}

// Close stops all background processes and closes connections.
func (h *HybridCache) Close() error {
	h.mu.Lock()
	defer h.mu.Unlock()

	// Stop event subscription
	if h.subscription != nil {
		h.subscription()
		h.subscription = nil
	}

	// Close local cache
	if err := h.local.Close(); err != nil {
		slog.Error("failed to close local cache", "error", err)
	}

	// Close Redis cache
	if h.redis != nil {
		if err := h.redis.Close(); err != nil {
			slog.Error("failed to close Redis cache", "error", err)
			return err
		}
	}

	return nil
}

// IsRedisAvailable returns true if Redis cache is available.
func (h *HybridCache) IsRedisAvailable() bool {
	return h.redis != nil
}

// GetStats returns cache statistics.
func (h *HybridCache) GetStats() CacheStats {
	stats := CacheStats{
		LocalSize:      h.local.Size(),
		RedisAvailable: h.redis != nil,
		PodID:          h.podID,
		EventQueueSize: int64(len(h.eventCh)),
	}

	if h.redis != nil {
		// Note: Redis size is expensive, only call when needed
		stats.RedisSize = h.redis.Size()
	}

	return stats
}

// CacheStats provides information about cache state.
type CacheStats struct {
	LocalSize      int64  `json:"local_size"`
	RedisSize      int64  `json:"redis_size"`
	RedisAvailable bool   `json:"redis_available"`
	PodID          string `json:"pod_id"`
	EventQueueSize int64  `json:"event_queue_size"`
}
