package cache

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"time"

	"github.com/redis/go-redis/v9"
)

// RedisCache implements the Interface using Redis as the backend.
type RedisCache struct {
	client *redis.Client
	config Config
	prefix string
}

// RedisConfig contains Redis-specific configuration.
type RedisConfig struct {
	// Redis connection URL (redis://localhost:6379)
	URL string
	// Connection pool size
	PoolSize int
	// Connection timeout
	DialTimeout time.Duration
	// Read timeout
	ReadTimeout time.Duration
	// Write timeout
	WriteTimeout time.Duration
	// Key prefix for all cache keys
	KeyPrefix string
}

// NewRedisCache creates a new Redis-backed cache with the given configuration.
func NewRedisCache(redisConfig RedisConfig, cacheConfig Config) (*RedisCache, error) {
	// Parse Redis URL
	opts, err := redis.ParseURL(redisConfig.URL)
	if err != nil {
		return nil, fmt.Errorf("failed to parse Redis URL: %w", err)
	}

	// Override with provided configuration
	if redisConfig.PoolSize > 0 {
		opts.PoolSize = redisConfig.PoolSize
	}
	if redisConfig.DialTimeout > 0 {
		opts.DialTimeout = redisConfig.DialTimeout
	}
	if redisConfig.ReadTimeout > 0 {
		opts.ReadTimeout = redisConfig.ReadTimeout
	}
	if redisConfig.WriteTimeout > 0 {
		opts.WriteTimeout = redisConfig.WriteTimeout
	}

	client := redis.NewClient(opts)

	// Test connection
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	
	if err := client.Ping(ctx).Err(); err != nil {
		return nil, fmt.Errorf("failed to connect to Redis: %w", err)
	}

	prefix := redisConfig.KeyPrefix
	if prefix == "" {
		prefix = "memos:cache"
	}

	return &RedisCache{
		client: client,
		config: cacheConfig,
		prefix: prefix,
	}, nil
}

// buildKey creates a prefixed cache key.
func (r *RedisCache) buildKey(key string) string {
	return fmt.Sprintf("%s:%s", r.prefix, key)
}

// Set adds a value to the cache with the default TTL.
func (r *RedisCache) Set(ctx context.Context, key string, value any) {
	r.SetWithTTL(ctx, key, value, r.config.DefaultTTL)
}

// SetWithTTL adds a value to the cache with a custom TTL.
func (r *RedisCache) SetWithTTL(ctx context.Context, key string, value any, ttl time.Duration) {
	// Serialize the value to JSON
	data, err := json.Marshal(value)
	if err != nil {
		slog.Error("failed to marshal cache value", "key", key, "error", err)
		return
	}

	redisKey := r.buildKey(key)
	if err := r.client.Set(ctx, redisKey, data, ttl).Err(); err != nil {
		slog.Error("failed to set cache value in Redis", "key", redisKey, "error", err)
		return
	}

	slog.Debug("cache value set in Redis", "key", redisKey, "ttl", ttl)
}

// Get retrieves a value from the cache.
func (r *RedisCache) Get(ctx context.Context, key string) (any, bool) {
	redisKey := r.buildKey(key)
	data, err := r.client.Get(ctx, redisKey).Bytes()
	if err != nil {
		if err == redis.Nil {
			// Key not found
			return nil, false
		}
		slog.Error("failed to get cache value from Redis", "key", redisKey, "error", err)
		return nil, false
	}

	// We need to unmarshal to interface{} since we don't know the original type
	// The caller should know what type to expect and can cast accordingly
	var value any
	if err := json.Unmarshal(data, &value); err != nil {
		slog.Error("failed to unmarshal cache value", "key", redisKey, "error", err)
		return nil, false
	}

	slog.Debug("cache value retrieved from Redis", "key", redisKey)
	return value, true
}

// Delete removes a value from the cache.
func (r *RedisCache) Delete(ctx context.Context, key string) {
	redisKey := r.buildKey(key)
	if err := r.client.Del(ctx, redisKey).Err(); err != nil {
		slog.Error("failed to delete cache value from Redis", "key", redisKey, "error", err)
		return
	}

	slog.Debug("cache value deleted from Redis", "key", redisKey)
}

// Clear removes all values from the cache with the configured prefix.
func (r *RedisCache) Clear(ctx context.Context) {
	// Use SCAN to find all keys with our prefix
	pattern := fmt.Sprintf("%s:*", r.prefix)
	
	iter := r.client.Scan(ctx, 0, pattern, 0).Iterator()
	keys := make([]string, 0)
	
	for iter.Next(ctx) {
		keys = append(keys, iter.Val())
	}
	
	if err := iter.Err(); err != nil {
		slog.Error("failed to scan Redis keys", "pattern", pattern, "error", err)
		return
	}

	if len(keys) > 0 {
		if err := r.client.Del(ctx, keys...).Err(); err != nil {
			slog.Error("failed to delete Redis keys", "pattern", pattern, "error", err)
			return
		}
		slog.Debug("cleared cache keys from Redis", "pattern", pattern, "count", len(keys))
	}
}

// Size returns the number of items in the cache with our prefix.
// Note: This is an expensive operation in Redis and should be used sparingly.
func (r *RedisCache) Size() int64 {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	pattern := fmt.Sprintf("%s:*", r.prefix)
	
	iter := r.client.Scan(ctx, 0, pattern, 0).Iterator()
	count := int64(0)
	
	for iter.Next(ctx) {
		count++
	}
	
	if err := iter.Err(); err != nil {
		slog.Error("failed to count Redis keys", "pattern", pattern, "error", err)
		return 0
	}

	return count
}

// Close closes the Redis connection.
func (r *RedisCache) Close() error {
	return r.client.Close()
}

// Publish publishes a cache invalidation event to other instances.
func (r *RedisCache) Publish(ctx context.Context, event CacheEvent) error {
	data, err := json.Marshal(event)
	if err != nil {
		return fmt.Errorf("failed to marshal cache event: %w", err)
	}

	channel := fmt.Sprintf("%s:events", r.prefix)
	if err := r.client.Publish(ctx, channel, data).Err(); err != nil {
		return fmt.Errorf("failed to publish cache event: %w", err)
	}

	return nil
}

// Subscribe subscribes to cache invalidation events from other instances.
func (r *RedisCache) Subscribe(ctx context.Context, handler func(CacheEvent)) error {
	channel := fmt.Sprintf("%s:events", r.prefix)
	
	pubsub := r.client.Subscribe(ctx, channel)
	defer pubsub.Close()

	// Start receiving messages
	ch := pubsub.Channel()
	
	slog.Info("subscribed to Redis cache events", "channel", channel)
	
	for {
		select {
		case msg := <-ch:
			var event CacheEvent
			if err := json.Unmarshal([]byte(msg.Payload), &event); err != nil {
				slog.Error("failed to unmarshal cache event", "error", err)
				continue
			}
			
			slog.Debug("received cache event", "event", event)
			handler(event)
			
		case <-ctx.Done():
			slog.Info("cache event subscription cancelled")
			return ctx.Err()
		}
	}
}

// CacheEvent represents a cache invalidation event.
type CacheEvent struct {
	Type      string    `json:"type"`      // "set", "delete", "clear"
	Key       string    `json:"key"`       // cache key (without prefix)
	Timestamp time.Time `json:"timestamp"` // when the event occurred
	Source    string    `json:"source"`    // identifier of the pod that generated the event
}

