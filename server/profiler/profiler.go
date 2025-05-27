package profiler

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"net/http/pprof"
	"runtime"
	"time"

	"github.com/labstack/echo/v4"
)

// Profiler provides HTTP endpoints for memory profiling.
type Profiler struct {
	memStatsLogInterval time.Duration
}

// NewProfiler creates a new profiler.
func NewProfiler() *Profiler {
	return &Profiler{
		memStatsLogInterval: 1 * time.Minute,
	}
}

// RegisterRoutes adds profiling endpoints to the Echo server.
func (*Profiler) RegisterRoutes(e *echo.Echo) {
	// Register pprof handlers
	g := e.Group("/debug/pprof")
	g.GET("", echo.WrapHandler(http.HandlerFunc(pprof.Index)))
	g.GET("/cmdline", echo.WrapHandler(http.HandlerFunc(pprof.Cmdline)))
	g.GET("/profile", echo.WrapHandler(http.HandlerFunc(pprof.Profile)))
	g.POST("/symbol", echo.WrapHandler(http.HandlerFunc(pprof.Symbol)))
	g.GET("/symbol", echo.WrapHandler(http.HandlerFunc(pprof.Symbol)))
	g.GET("/trace", echo.WrapHandler(http.HandlerFunc(pprof.Trace)))
	g.GET("/allocs", echo.WrapHandler(http.HandlerFunc(pprof.Handler("allocs").ServeHTTP)))
	g.GET("/block", echo.WrapHandler(http.HandlerFunc(pprof.Handler("block").ServeHTTP)))
	g.GET("/goroutine", echo.WrapHandler(http.HandlerFunc(pprof.Handler("goroutine").ServeHTTP)))
	g.GET("/heap", echo.WrapHandler(http.HandlerFunc(pprof.Handler("heap").ServeHTTP)))
	g.GET("/mutex", echo.WrapHandler(http.HandlerFunc(pprof.Handler("mutex").ServeHTTP)))
	g.GET("/threadcreate", echo.WrapHandler(http.HandlerFunc(pprof.Handler("threadcreate").ServeHTTP)))

	// Add a custom memory stats endpoint.
	g.GET("/memstats", func(c echo.Context) error {
		var m runtime.MemStats
		runtime.ReadMemStats(&m)
		return c.JSON(http.StatusOK, map[string]interface{}{
			"alloc":       m.Alloc,
			"totalAlloc":  m.TotalAlloc,
			"sys":         m.Sys,
			"numGC":       m.NumGC,
			"heapAlloc":   m.HeapAlloc,
			"heapSys":     m.HeapSys,
			"heapInuse":   m.HeapInuse,
			"heapObjects": m.HeapObjects,
		})
	})
}

// StartMemoryMonitor starts a goroutine that periodically logs memory stats.
func (p *Profiler) StartMemoryMonitor(ctx context.Context) {
	go func() {
		ticker := time.NewTicker(p.memStatsLogInterval)
		defer ticker.Stop()

		// Store previous heap allocation to track growth.
		var lastHeapAlloc uint64
		var lastNumGC uint32

		for {
			select {
			case <-ticker.C:
				var m runtime.MemStats
				runtime.ReadMemStats(&m)

				// Calculate heap growth since last check.
				heapGrowth := int64(m.HeapAlloc) - int64(lastHeapAlloc)
				gcCount := m.NumGC - lastNumGC

				slog.Info("memory stats",
					"heapAlloc", byteCountIEC(m.HeapAlloc),
					"heapSys", byteCountIEC(m.HeapSys),
					"heapObjects", m.HeapObjects,
					"heapGrowth", byteCountIEC(uint64(heapGrowth)),
					"numGoroutine", runtime.NumGoroutine(),
					"numGC", m.NumGC,
					"gcSince", gcCount,
					"nextGC", byteCountIEC(m.NextGC),
					"gcPause", time.Duration(m.PauseNs[(m.NumGC+255)%256]).String(),
				)

				// Track values for next iteration.
				lastHeapAlloc = m.HeapAlloc
				lastNumGC = m.NumGC

				// Force GC if memory usage is high to see if objects can be reclaimed.
				if m.HeapAlloc > 500*1024*1024 { // 500 MB threshold
					slog.Info("forcing garbage collection due to high memory usage")
				}
			case <-ctx.Done():
				return
			}
		}
	}()
}

// byteCountIEC converts bytes to a human-readable string (MiB, GiB).
func byteCountIEC(b uint64) string {
	const unit = 1024
	if b < unit {
		return fmt.Sprintf("%d B", b)
	}
	div, exp := uint64(unit), 0
	for n := b / unit; n >= unit; n /= unit {
		div *= unit
		exp++
	}
	return fmt.Sprintf("%.1f %ciB", float64(b)/float64(div), "KMGTPE"[exp])
}
