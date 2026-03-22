package cache

import (
	"context"
	"fmt"
	"sync"
	"testing"
	"time"
)

func TestCacheBasicOperations(t *testing.T) {
	ctx := context.Background()
	config := DefaultConfig()
	config.DefaultTTL = 100 * time.Millisecond
	config.CleanupInterval = 50 * time.Millisecond
	cache := New(config)
	defer cache.Close()

	// Test Set and Get
	cache.Set(ctx, "key1", "value1")
	if val, ok := cache.Get(ctx, "key1"); !ok || val != "value1" {
		t.Errorf("Expected 'value1', got %v, exists: %v", val, ok)
	}

	// Test SetWithTTL
	cache.SetWithTTL(ctx, "key2", "value2", 200*time.Millisecond)
	if val, ok := cache.Get(ctx, "key2"); !ok || val != "value2" {
		t.Errorf("Expected 'value2', got %v, exists: %v", val, ok)
	}

	// Test Delete
	cache.Delete(ctx, "key1")
	if _, ok := cache.Get(ctx, "key1"); ok {
		t.Error("Key 'key1' should have been deleted")
	}

	// Test automatic expiration
	time.Sleep(150 * time.Millisecond)
	if _, ok := cache.Get(ctx, "key1"); ok {
		t.Error("Key 'key1' should have expired")
	}
	// key2 should still be valid (200ms TTL)
	if _, ok := cache.Get(ctx, "key2"); !ok {
		t.Error("Key 'key2' should still be valid")
	}

	// Wait for key2 to expire
	time.Sleep(100 * time.Millisecond)
	if _, ok := cache.Get(ctx, "key2"); ok {
		t.Error("Key 'key2' should have expired")
	}

	// Test Clear
	cache.Set(ctx, "key3", "value3")
	cache.Clear(ctx)
	if _, ok := cache.Get(ctx, "key3"); ok {
		t.Error("Cache should be empty after Clear()")
	}
}

func TestCacheEviction(t *testing.T) {
	ctx := context.Background()
	config := DefaultConfig()
	config.MaxItems = 5
	cache := New(config)
	defer cache.Close()

	// Add 5 items (max capacity)
	for i := 0; i < 5; i++ {
		key := fmt.Sprintf("key%d", i)
		cache.Set(ctx, key, i)
	}

	// Verify all 5 items are in the cache
	for i := 0; i < 5; i++ {
		key := fmt.Sprintf("key%d", i)
		if _, ok := cache.Get(ctx, key); !ok {
			t.Errorf("Key '%s' should be in the cache", key)
		}
	}

	// Add 2 more items to trigger eviction
	cache.Set(ctx, "keyA", "valueA")
	cache.Set(ctx, "keyB", "valueB")

	// Verify size is still within limits
	if cache.Size() > int64(config.MaxItems) {
		t.Errorf("Cache size %d exceeds limit %d", cache.Size(), config.MaxItems)
	}

	// Some of the original keys should have been evicted
	evictedCount := 0
	for i := 0; i < 5; i++ {
		key := fmt.Sprintf("key%d", i)
		if _, ok := cache.Get(ctx, key); !ok {
			evictedCount++
		}
	}

	if evictedCount == 0 {
		t.Error("No keys were evicted despite exceeding max items")
	}

	// The newer keys should still be present
	if _, ok := cache.Get(ctx, "keyA"); !ok {
		t.Error("Key 'keyA' should be in the cache")
	}
	if _, ok := cache.Get(ctx, "keyB"); !ok {
		t.Error("Key 'keyB' should be in the cache")
	}
}

func TestCacheConcurrency(t *testing.T) {
	ctx := context.Background()
	cache := NewDefault()
	defer cache.Close()

	const goroutines = 10
	const operationsPerGoroutine = 100

	var wg sync.WaitGroup
	wg.Add(goroutines)

	for i := 0; i < goroutines; i++ {
		go func(id int) {
			defer wg.Done()

			baseKey := fmt.Sprintf("worker%d-", id)

			// Set operations
			for j := 0; j < operationsPerGoroutine; j++ {
				key := fmt.Sprintf("%skey%d", baseKey, j)
				value := fmt.Sprintf("value%d-%d", id, j)
				cache.Set(ctx, key, value)
			}

			// Get operations
			for j := 0; j < operationsPerGoroutine; j++ {
				key := fmt.Sprintf("%skey%d", baseKey, j)
				val, ok := cache.Get(ctx, key)
				if !ok {
					t.Errorf("Key '%s' should exist in cache", key)
					continue
				}
				expected := fmt.Sprintf("value%d-%d", id, j)
				if val != expected {
					t.Errorf("For key '%s', expected '%s', got '%s'", key, expected, val)
				}
			}

			// Delete half the keys
			for j := 0; j < operationsPerGoroutine/2; j++ {
				key := fmt.Sprintf("%skey%d", baseKey, j)
				cache.Delete(ctx, key)
			}
		}(i)
	}

	wg.Wait()

	// Verify size and deletion
	var totalKeysExpected int64 = goroutines * operationsPerGoroutine / 2
	if cache.Size() != totalKeysExpected {
		t.Errorf("Expected cache size to be %d, got %d", totalKeysExpected, cache.Size())
	}
}

func TestEvictionCallback(t *testing.T) {
	ctx := context.Background()
	evicted := make(map[string]interface{})
	evictedMu := sync.Mutex{}

	config := DefaultConfig()
	config.DefaultTTL = 50 * time.Millisecond
	config.CleanupInterval = 25 * time.Millisecond
	config.OnEviction = func(key string, value interface{}) {
		evictedMu.Lock()
		evicted[key] = value
		evictedMu.Unlock()
	}

	cache := New(config)
	defer cache.Close()

	// Add items
	cache.Set(ctx, "key1", "value1")
	cache.Set(ctx, "key2", "value2")

	// Manually delete
	cache.Delete(ctx, "key1")

	// Verify manual deletion triggered callback
	time.Sleep(10 * time.Millisecond) // Small delay to ensure callback processed
	evictedMu.Lock()
	if evicted["key1"] != "value1" {
		t.Error("Eviction callback not triggered for manual deletion")
	}
	evictedMu.Unlock()

	// Wait for automatic expiration
	time.Sleep(60 * time.Millisecond)

	// Verify TTL expiration triggered callback
	evictedMu.Lock()
	if evicted["key2"] != "value2" {
		t.Error("Eviction callback not triggered for TTL expiration")
	}
	evictedMu.Unlock()
}
