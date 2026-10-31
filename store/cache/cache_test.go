package cache

import (
	"context"
	"fmt"
	"sync"
	"sync/atomic"
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
	for i := range 5 {
		key := fmt.Sprintf("key%d", i)
		cache.Set(ctx, key, i)
	}

	// Verify all 5 items are in the cache
	for i := range 5 {
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
	for i := range 5 {
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

	for id := range goroutines {
		wg.Go(func() {
			baseKey := fmt.Sprintf("worker%d-", id)

			// Set operations
			for j := range operationsPerGoroutine {
				key := fmt.Sprintf("%skey%d", baseKey, j)
				value := fmt.Sprintf("value%d-%d", id, j)
				cache.Set(ctx, key, value)
			}

			// Get operations
			for j := range operationsPerGoroutine {
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
			for j := range operationsPerGoroutine / 2 {
				key := fmt.Sprintf("%skey%d", baseKey, j)
				cache.Delete(ctx, key)
			}
		})
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
	evicted := make(map[string]any)
	evictedMu := sync.Mutex{}

	config := DefaultConfig()
	config.DefaultTTL = 50 * time.Millisecond
	config.CleanupInterval = 25 * time.Millisecond
	config.OnEviction = func(key string, value any) {
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

func TestCacheConcurrentExpiryCountedOnce(t *testing.T) {
	ctx := context.Background()

	config := DefaultConfig()
	config.DefaultTTL = 15 * time.Millisecond
	config.CleanupInterval = time.Hour // disable the background sweeper for determinism
	config.MaxItems = 0
	var evictions atomic.Int64
	config.OnEviction = func(string, any) {
		evictions.Add(1)
	}
	cache := New(config)
	defer cache.Close()

	const rounds = 50
	const readers = 32
	for r := range rounds {
		key := fmt.Sprintf("expiring-%d", r)
		cache.Set(ctx, key, r)
		time.Sleep(20 * time.Millisecond) // let the entry expire

		start := make(chan struct{})
		var wg sync.WaitGroup
		for range readers {
			wg.Go(func() {
				<-start
				cache.Get(ctx, key)
			})
		}
		close(start)
		wg.Wait()

		if got := cache.Size(); got != 0 {
			t.Fatalf("round %d: expired entry removal over-counted (size %d)", r, got)
		}
	}
	if got := evictions.Load(); got != rounds {
		t.Fatalf("expected %d eviction callbacks, got %d", rounds, got)
	}
}

func TestCacheOverwriteAccounting(t *testing.T) {
	ctx := context.Background()
	cache := NewDefault()
	defer cache.Close()

	const workers = 16
	const writes = 200
	var wg sync.WaitGroup
	for id := range workers {
		wg.Go(func() {
			for j := range writes {
				key := fmt.Sprintf("key%d", j%8)
				cache.Set(ctx, key, fmt.Sprintf("worker%d-%d", id, j))
			}
		})
	}
	wg.Wait()

	if got := cache.Size(); got != 8 {
		t.Fatalf("expected 8 entries after overwrites, got %d", got)
	}
	for j := range 8 {
		cache.Delete(ctx, fmt.Sprintf("key%d", j))
	}
	if got := cache.Size(); got != 0 {
		t.Fatalf("expected empty cache after deletes, got %d", got)
	}
}

func TestCacheExpiredGetKeepsFreshValue(t *testing.T) {
	ctx := context.Background()
	config := DefaultConfig()
	config.CleanupInterval = time.Hour
	cache := New(config)
	defer cache.Close()

	for r := range 100 {
		key := fmt.Sprintf("key-%d", r)
		cache.SetWithTTL(ctx, key, "stale", 10*time.Millisecond)
		time.Sleep(12 * time.Millisecond)

		start := make(chan struct{})
		var wg sync.WaitGroup
		wg.Go(func() {
			<-start
			cache.Get(ctx, key) // observes the expired entry and removes it
		})
		wg.Go(func() {
			<-start
			cache.SetWithTTL(ctx, key, "fresh", time.Hour)
		})
		close(start)
		wg.Wait()

		if val, ok := cache.Get(ctx, key); !ok || val != "fresh" {
			t.Fatalf("round %d: fresh value lost to a stale expiry removal (ok=%v)", r, ok)
		}
	}
}

func TestCacheEvictionAfterConcurrentExpiry(t *testing.T) {
	ctx := context.Background()
	config := DefaultConfig()
	config.DefaultTTL = 15 * time.Millisecond
	config.CleanupInterval = time.Hour
	config.MaxItems = 10
	cache := New(config)
	defer cache.Close()

	// Live keys arrive alongside short-lived keys that expire and get read.
	var wg sync.WaitGroup
	for id := range 8 {
		wg.Go(func() {
			for j := range 25 {
				key := fmt.Sprintf("w%d-%d", id, j)
				cache.SetWithTTL(ctx, key, j, time.Hour)
				if j%2 == 0 {
					cache.SetWithTTL(ctx, fmt.Sprintf("tmp%d-%d", id, j), j, 5*time.Millisecond)
				}
			}
		})
	}
	wg.Wait()
	time.Sleep(30 * time.Millisecond)
	for id := range 8 {
		for j := range 12 {
			wg.Go(func() {
				cache.Get(ctx, fmt.Sprintf("tmp%d-%d", id, j))
			})
		}
	}
	wg.Wait()

	if got := cache.Size(); got < 0 {
		t.Fatalf("size drifted negative: %d", got)
	}
	live := 0
	for id := range 8 {
		for j := range 25 {
			if _, ok := cache.Get(ctx, fmt.Sprintf("w%d-%d", id, j)); ok {
				live++
			}
		}
	}
	if live == 0 {
		t.Fatal("all live entries were lost")
	}
}

func TestCacheEvictionGuardIgnoresInflightReservations(t *testing.T) {
	ctx := context.Background()
	config := DefaultConfig()
	config.CleanupInterval = time.Hour
	config.MaxItems = 2
	var evictions atomic.Int64
	config.OnEviction = func(string, any) {
		evictions.Add(1)
	}
	cache := New(config)
	defer cache.Close()

	cache.Set(ctx, "x", 1)

	// Simulate a concurrent writer that reserved a count for a key it has
	// not published yet.
	(&cache.itemCount).Add(1)

	// Publishing another key must not evict live entries: only two entries
	// are actually in the cache, which is within the limit.
	cache.Set(ctx, "k", 2)

	if _, ok := cache.Get(ctx, "x"); !ok {
		t.Fatal("live entry evicted by a guard that counted an in-flight reservation")
	}
	if got := evictions.Load(); got != 0 {
		t.Fatalf("expected no eviction callbacks, got %d", got)
	}

	// Roll the simulated reservation back and verify a real overflow still
	// triggers eviction.
	(&cache.itemCount).Add(-1)
	cache.Set(ctx, "y", 3)
	if cache.Size() > int64(config.MaxItems) {
		t.Fatalf("cache size %d exceeds limit %d after a real overflow", cache.Size(), config.MaxItems)
	}
}

func TestCacheConcurrentClose(t *testing.T) {
	cache := NewDefault()

	var wg sync.WaitGroup
	for range 16 {
		wg.Go(func() {
			if err := cache.Close(); err != nil {
				t.Errorf("Close returned error: %v", err)
			}
		})
	}
	wg.Wait()
}
