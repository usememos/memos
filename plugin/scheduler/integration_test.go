package scheduler_test

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/usememos/memos/plugin/scheduler"
)

// TestRealWorldScenario tests a realistic multi-job scenario.
func TestRealWorldScenario(t *testing.T) {
	var (
		quickJobCount  atomic.Int32
		hourlyJobCount atomic.Int32
		logEntries     []string
		logMu          sync.Mutex
	)

	logger := &testLogger{
		onInfo: func(msg string, _ ...interface{}) {
			logMu.Lock()
			logEntries = append(logEntries, fmt.Sprintf("INFO: %s", msg))
			logMu.Unlock()
		},
		onError: func(msg string, _ ...interface{}) {
			logMu.Lock()
			logEntries = append(logEntries, fmt.Sprintf("ERROR: %s", msg))
			logMu.Unlock()
		},
	}

	s := scheduler.New(
		scheduler.WithTimezone("UTC"),
		scheduler.WithMiddleware(
			scheduler.Recovery(func(jobName string, r interface{}) {
				t.Logf("Job %s panicked: %v", jobName, r)
			}),
			scheduler.Logging(logger),
			scheduler.Timeout(5*time.Second),
		),
	)

	// Quick job (every second)
	s.Register(&scheduler.Job{
		Name:     "quick-check",
		Schedule: "* * * * * *",
		Handler: func(_ context.Context) error {
			quickJobCount.Add(1)
			time.Sleep(100 * time.Millisecond)
			return nil
		},
	})

	// Slower job (every 2 seconds)
	s.Register(&scheduler.Job{
		Name:     "slow-process",
		Schedule: "*/2 * * * * *",
		Handler: func(_ context.Context) error {
			hourlyJobCount.Add(1)
			time.Sleep(500 * time.Millisecond)
			return nil
		},
	})

	// Start scheduler
	if err := s.Start(); err != nil {
		t.Fatalf("failed to start scheduler: %v", err)
	}

	// Let it run for 5 seconds
	time.Sleep(5 * time.Second)

	// Graceful shutdown
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := s.Stop(ctx); err != nil {
		t.Fatalf("failed to stop scheduler: %v", err)
	}

	// Verify execution counts
	quick := quickJobCount.Load()
	slow := hourlyJobCount.Load()

	t.Logf("Quick job ran %d times", quick)
	t.Logf("Slow job ran %d times", slow)

	if quick < 4 {
		t.Errorf("expected quick job to run at least 4 times, ran %d", quick)
	}

	if slow < 2 {
		t.Errorf("expected slow job to run at least 2 times, ran %d", slow)
	}

	// Verify logging
	logMu.Lock()
	defer logMu.Unlock()

	hasStartLog := false
	hasCompleteLog := false
	for _, entry := range logEntries {
		if contains(entry, "Job started") {
			hasStartLog = true
		}
		if contains(entry, "Job completed") {
			hasCompleteLog = true
		}
	}

	if !hasStartLog {
		t.Error("expected job start logs")
	}
	if !hasCompleteLog {
		t.Error("expected job completion logs")
	}
}

// TestCancellationDuringExecution verifies jobs can be canceled mid-execution.
func TestCancellationDuringExecution(t *testing.T) {
	var canceled atomic.Bool
	var started atomic.Bool

	s := scheduler.New()

	s.Register(&scheduler.Job{
		Name:     "long-job",
		Schedule: "* * * * * *",
		Handler: func(ctx context.Context) error {
			started.Store(true)
			// Simulate long-running work
			for i := 0; i < 100; i++ {
				select {
				case <-ctx.Done():
					canceled.Store(true)
					return ctx.Err()
				case <-time.After(100 * time.Millisecond):
					// Keep working
				}
			}
			return nil
		},
	})

	if err := s.Start(); err != nil {
		t.Fatalf("failed to start: %v", err)
	}

	// Wait until job starts
	for i := 0; i < 30; i++ {
		if started.Load() {
			break
		}
		time.Sleep(100 * time.Millisecond)
	}

	if !started.Load() {
		t.Fatal("job did not start within timeout")
	}

	// Stop with reasonable timeout
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := s.Stop(ctx); err != nil {
		t.Logf("stop returned error (may be expected): %v", err)
	}

	if !canceled.Load() {
		t.Error("expected job to detect cancellation")
	}
}

// TestTimezoneHandling verifies timezone-aware scheduling.
func TestTimezoneHandling(t *testing.T) {
	// Parse a schedule in a specific timezone
	schedule, err := scheduler.ParseCronExpression("0 9 * * *") // 9 AM
	if err != nil {
		t.Fatalf("failed to parse schedule: %v", err)
	}

	// Test in New York timezone
	nyc, err := time.LoadLocation("America/New_York")
	if err != nil {
		t.Fatalf("failed to load timezone: %v", err)
	}

	// Current time: 8:30 AM in New York
	now := time.Date(2025, 1, 15, 8, 30, 0, 0, nyc)

	// Next run should be 9:00 AM same day
	next := schedule.Next(now)
	expected := time.Date(2025, 1, 15, 9, 0, 0, 0, nyc)

	if !next.Equal(expected) {
		t.Errorf("next = %v, expected %v", next, expected)
	}

	// If it's already past 9 AM
	now = time.Date(2025, 1, 15, 9, 30, 0, 0, nyc)
	next = schedule.Next(now)
	expected = time.Date(2025, 1, 16, 9, 0, 0, 0, nyc)

	if !next.Equal(expected) {
		t.Errorf("next = %v, expected %v", next, expected)
	}
}

// TestErrorPropagation verifies error handling.
func TestErrorPropagation(t *testing.T) {
	var errorLogged atomic.Bool

	logger := &testLogger{
		onError: func(msg string, _ ...interface{}) {
			if msg == "Job failed" {
				errorLogged.Store(true)
			}
		},
	}

	s := scheduler.New(
		scheduler.WithMiddleware(
			scheduler.Logging(logger),
		),
	)

	s.Register(&scheduler.Job{
		Name:     "failing-job",
		Schedule: "* * * * * *",
		Handler: func(_ context.Context) error {
			return errors.New("intentional error")
		},
	})

	if err := s.Start(); err != nil {
		t.Fatalf("failed to start: %v", err)
	}

	// Let it run once
	time.Sleep(1500 * time.Millisecond)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := s.Stop(ctx); err != nil {
		t.Fatalf("failed to stop: %v", err)
	}

	if !errorLogged.Load() {
		t.Error("expected error to be logged")
	}
}

// TestPanicRecovery verifies panic recovery middleware.
func TestPanicRecovery(t *testing.T) {
	var panicRecovered atomic.Bool

	s := scheduler.New(
		scheduler.WithMiddleware(
			scheduler.Recovery(func(jobName string, r interface{}) {
				panicRecovered.Store(true)
				t.Logf("Recovered from panic in job %s: %v", jobName, r)
			}),
		),
	)

	s.Register(&scheduler.Job{
		Name:     "panicking-job",
		Schedule: "* * * * * *",
		Handler: func(_ context.Context) error {
			panic("intentional panic for testing")
		},
	})

	if err := s.Start(); err != nil {
		t.Fatalf("failed to start: %v", err)
	}

	// Let it run once
	time.Sleep(1500 * time.Millisecond)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := s.Stop(ctx); err != nil {
		t.Fatalf("failed to stop: %v", err)
	}

	if !panicRecovered.Load() {
		t.Error("expected panic to be recovered")
	}
}

// TestMultipleJobsWithDifferentSchedules verifies concurrent job execution.
func TestMultipleJobsWithDifferentSchedules(t *testing.T) {
	var (
		job1Count atomic.Int32
		job2Count atomic.Int32
		job3Count atomic.Int32
	)

	s := scheduler.New()

	// Job 1: Every second
	s.Register(&scheduler.Job{
		Name:     "job-1sec",
		Schedule: "* * * * * *",
		Handler: func(_ context.Context) error {
			job1Count.Add(1)
			return nil
		},
	})

	// Job 2: Every 2 seconds
	s.Register(&scheduler.Job{
		Name:     "job-2sec",
		Schedule: "*/2 * * * * *",
		Handler: func(_ context.Context) error {
			job2Count.Add(1)
			return nil
		},
	})

	// Job 3: Every 3 seconds
	s.Register(&scheduler.Job{
		Name:     "job-3sec",
		Schedule: "*/3 * * * * *",
		Handler: func(_ context.Context) error {
			job3Count.Add(1)
			return nil
		},
	})

	if err := s.Start(); err != nil {
		t.Fatalf("failed to start: %v", err)
	}

	// Let them run for 6 seconds
	time.Sleep(6 * time.Second)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := s.Stop(ctx); err != nil {
		t.Fatalf("failed to stop: %v", err)
	}

	// Verify counts (allowing for timing variance)
	c1 := job1Count.Load()
	c2 := job2Count.Load()
	c3 := job3Count.Load()

	t.Logf("Job 1 ran %d times, Job 2 ran %d times, Job 3 ran %d times", c1, c2, c3)

	if c1 < 5 {
		t.Errorf("expected job1 to run at least 5 times, ran %d", c1)
	}
	if c2 < 2 {
		t.Errorf("expected job2 to run at least 2 times, ran %d", c2)
	}
	if c3 < 1 {
		t.Errorf("expected job3 to run at least 1 time, ran %d", c3)
	}
}

// Helpers

type testLogger struct {
	onInfo  func(msg string, args ...interface{})
	onError func(msg string, args ...interface{})
}

func (l *testLogger) Info(msg string, args ...interface{}) {
	if l.onInfo != nil {
		l.onInfo(msg, args...)
	}
}

func (l *testLogger) Error(msg string, args ...interface{}) {
	if l.onError != nil {
		l.onError(msg, args...)
	}
}

func contains(s, substr string) bool {
	return strings.Contains(s, substr)
}
