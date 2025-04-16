package teststore

import (
	"context"
	"runtime"
	"testing"
	"time"

	"github.com/lithammer/shortuuid/v4"
	"github.com/usememos/memos/store"
)

// BenchmarkDB groups all database benchmarks
func BenchmarkDB(b *testing.B) {
	b.Run("BenchmarkDBConnPool", BenchmarkDBConnPool)
}

// benchmarkConfig defines the configuration for benchmark testing
type benchmarkConfig struct {
	maxOpenConns    int
	maxIdleConns    int
	connMaxLifetime *time.Duration
}

// benchmarkConnectionPool tests the performance of sql.DB connection pooling.
func BenchmarkDBConnPool(b *testing.B) {
	cores := runtime.NumCPU()
	lifeTime := time.Hour
	cases := []struct {
		name   string
		config benchmarkConfig
	}{
		{
			name: "default_unlimited",
			config: benchmarkConfig{
				maxOpenConns:    0,   // Use default value 0 (unlimited)
				maxIdleConns:    2,   // Use default value 2
				connMaxLifetime: nil, // Use default value 0 (unlimited)
			},
		},
		{
			name: "max_conns_equals_cores",
			config: benchmarkConfig{
				maxOpenConns:    cores,
				maxIdleConns:    cores / 2,
				connMaxLifetime: &lifeTime,
			},
		},
		{
			name: "max_conns_double_cores",
			config: benchmarkConfig{
				maxOpenConns:    cores * 2,
				maxIdleConns:    cores,
				connMaxLifetime: &lifeTime,
			},
		},
		{
			name: "max_conns_25",
			config: benchmarkConfig{
				maxOpenConns:    25,
				maxIdleConns:    10,
				connMaxLifetime: &lifeTime,
			},
		},
		{
			name: "max_conns_50",
			config: benchmarkConfig{
				maxOpenConns:    50,
				maxIdleConns:    25,
				connMaxLifetime: &lifeTime,
			},
		},
		{
			name: "max_conns_100",
			config: benchmarkConfig{
				maxOpenConns:    100,
				maxIdleConns:    50,
				connMaxLifetime: &lifeTime,
			},
		},
	}

	for _, tc := range cases {
		b.Run(tc.name, func(b *testing.B) {
			ctx := context.Background()
			ts := NewTestingStore(ctx, &testing.T{})
			db := ts.GetDriver().GetDB()

			db.SetMaxOpenConns(tc.config.maxOpenConns)
			db.SetMaxIdleConns(tc.config.maxIdleConns)

			if tc.config.connMaxLifetime != nil {
				db.SetConnMaxLifetime(*tc.config.connMaxLifetime)
			}

			user, err := createTestingHostUser(ctx, ts)
			if err != nil {
				b.Logf("failed to create testing host user: %v", err)
			}

			// Set concurrency level
			b.SetParallelism(100)
			b.ResetTimer()

			// Record initial stats
			startStats := db.Stats()

			b.RunParallel(func(pb *testing.PB) {
				for pb.Next() {
					// Execute database operation
					memoCreate := &store.Memo{
						UID:        shortuuid.New(),
						CreatorID:  user.ID,
						Content:    "test_content",
						Visibility: store.Public,
					}
					_, err := ts.CreateMemo(ctx, memoCreate)
					if err != nil {
						b.Fatal("failed to create memo:", err)
					}
				}
			})

			// Collect and report connection pool statistics
			endStats := db.Stats()
			// b.ReportMetric(float64(endStats.MaxOpenConnections), "max_open_conns")
			// b.ReportMetric(float64(endStats.InUse), "conns_in_use")
			// b.ReportMetric(float64(endStats.Idle), "idle_conns")
			b.ReportMetric(float64(endStats.WaitCount-startStats.WaitCount), "wait_count")
			b.ReportMetric(float64((endStats.WaitDuration - startStats.WaitDuration).Milliseconds()), "wait_duration_ms")
		})
	}
}
