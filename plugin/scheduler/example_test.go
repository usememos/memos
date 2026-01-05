package scheduler_test

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"time"

	"github.com/usememos/memos/plugin/scheduler"
)

// Example demonstrates basic scheduler usage.
func Example_basic() {
	s := scheduler.New()

	s.Register(&scheduler.Job{
		Name:        "hello",
		Schedule:    "*/5 * * * *", // Every 5 minutes
		Description: "Say hello",
		Handler: func(_ context.Context) error {
			fmt.Println("Hello from scheduler!")
			return nil
		},
	})

	s.Start()
	defer s.Stop(context.Background())

	// Scheduler runs in background
	time.Sleep(100 * time.Millisecond)
}

// Example demonstrates timezone-aware scheduling.
func Example_timezone() {
	s := scheduler.New(
		scheduler.WithTimezone("America/New_York"),
	)

	s.Register(&scheduler.Job{
		Name:     "daily-report",
		Schedule: "0 9 * * *", // 9 AM in New York
		Handler: func(_ context.Context) error {
			fmt.Println("Generating daily report...")
			return nil
		},
	})

	s.Start()
	defer s.Stop(context.Background())
}

// Example demonstrates middleware usage.
func Example_middleware() {
	logger := slog.New(slog.NewTextHandler(os.Stdout, nil))

	s := scheduler.New(
		scheduler.WithMiddleware(
			scheduler.Recovery(func(jobName string, r interface{}) {
				logger.Error("Job panicked", "job", jobName, "panic", r)
			}),
			scheduler.Logging(&slogAdapter{logger}),
			scheduler.Timeout(5*time.Minute),
		),
	)

	s.Register(&scheduler.Job{
		Name:     "data-sync",
		Schedule: "0 */2 * * *", // Every 2 hours
		Handler: func(_ context.Context) error {
			// Your sync logic here
			return nil
		},
	})

	s.Start()
	defer s.Stop(context.Background())
}

// slogAdapter adapts slog.Logger to scheduler.Logger interface.
type slogAdapter struct {
	logger *slog.Logger
}

func (a *slogAdapter) Info(msg string, args ...interface{}) {
	a.logger.Info(msg, args...)
}

func (a *slogAdapter) Error(msg string, args ...interface{}) {
	a.logger.Error(msg, args...)
}

// Example demonstrates multiple jobs with different schedules.
func Example_multipleJobs() {
	s := scheduler.New()

	// Cleanup old data every night at 2 AM
	s.Register(&scheduler.Job{
		Name:     "cleanup",
		Schedule: "0 2 * * *",
		Tags:     []string{"maintenance"},
		Handler: func(_ context.Context) error {
			fmt.Println("Cleaning up old data...")
			return nil
		},
	})

	// Health check every 5 minutes
	s.Register(&scheduler.Job{
		Name:     "health-check",
		Schedule: "*/5 * * * *",
		Tags:     []string{"monitoring"},
		Handler: func(_ context.Context) error {
			fmt.Println("Running health check...")
			return nil
		},
	})

	// Weekly backup on Sundays at 1 AM
	s.Register(&scheduler.Job{
		Name:     "weekly-backup",
		Schedule: "0 1 * * 0",
		Tags:     []string{"backup"},
		Handler: func(_ context.Context) error {
			fmt.Println("Creating weekly backup...")
			return nil
		},
	})

	s.Start()
	defer s.Stop(context.Background())
}

// Example demonstrates graceful shutdown with timeout.
func Example_gracefulShutdown() {
	s := scheduler.New()

	s.Register(&scheduler.Job{
		Name:     "long-running",
		Schedule: "* * * * *",
		Handler: func(ctx context.Context) error {
			select {
			case <-time.After(30 * time.Second):
				fmt.Println("Job completed")
			case <-ctx.Done():
				fmt.Println("Job canceled, cleaning up...")
				return ctx.Err()
			}
			return nil
		},
	})

	s.Start()

	// Simulate shutdown signal
	time.Sleep(5 * time.Second)

	// Give jobs 10 seconds to finish
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := s.Stop(shutdownCtx); err != nil {
		fmt.Printf("Shutdown error: %v\n", err)
	}
}
