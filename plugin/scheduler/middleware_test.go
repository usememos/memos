package scheduler

import (
	"context"
	"errors"
	"sync/atomic"
	"testing"
)

func TestMiddlewareChaining(t *testing.T) {
	var order []string

	mw1 := func(next JobHandler) JobHandler {
		return func(ctx context.Context) error {
			order = append(order, "before-1")
			err := next(ctx)
			order = append(order, "after-1")
			return err
		}
	}

	mw2 := func(next JobHandler) JobHandler {
		return func(ctx context.Context) error {
			order = append(order, "before-2")
			err := next(ctx)
			order = append(order, "after-2")
			return err
		}
	}

	handler := func(_ context.Context) error {
		order = append(order, "handler")
		return nil
	}

	chain := Chain(mw1, mw2)
	wrapped := chain(handler)

	if err := wrapped(context.Background()); err != nil {
		t.Fatalf("wrapped handler failed: %v", err)
	}

	expected := []string{"before-1", "before-2", "handler", "after-2", "after-1"}
	if len(order) != len(expected) {
		t.Fatalf("expected %d calls, got %d", len(expected), len(order))
	}

	for i, want := range expected {
		if order[i] != want {
			t.Errorf("order[%d] = %q, want %q", i, order[i], want)
		}
	}
}

func TestRecoveryMiddleware(t *testing.T) {
	var panicRecovered atomic.Bool

	onPanic := func(_ string, _ interface{}) {
		panicRecovered.Store(true)
	}

	handler := func(_ context.Context) error {
		panic("simulated panic")
	}

	recovery := Recovery(onPanic)
	wrapped := recovery(handler)

	// Should not panic, error should be returned
	err := wrapped(withJobName(context.Background(), "test-job"))
	if err == nil {
		t.Error("expected error from recovered panic")
	}

	if !panicRecovered.Load() {
		t.Error("panic handler was not called")
	}
}

func TestLoggingMiddleware(t *testing.T) {
	var loggedStart, loggedEnd atomic.Bool
	var loggedError atomic.Bool

	logger := &testLogger{
		onInfo: func(msg string, _ ...interface{}) {
			if msg == "Job started" {
				loggedStart.Store(true)
			} else if msg == "Job completed" {
				loggedEnd.Store(true)
			}
		},
		onError: func(msg string, _ ...interface{}) {
			if msg == "Job failed" {
				loggedError.Store(true)
			}
		},
	}

	// Test successful execution
	handler := func(_ context.Context) error {
		return nil
	}

	logging := Logging(logger)
	wrapped := logging(handler)

	if err := wrapped(withJobName(context.Background(), "test-job")); err != nil {
		t.Fatalf("handler failed: %v", err)
	}

	if !loggedStart.Load() {
		t.Error("start was not logged")
	}
	if !loggedEnd.Load() {
		t.Error("end was not logged")
	}

	// Test error handling
	handlerErr := func(_ context.Context) error {
		return errors.New("job error")
	}

	wrappedErr := logging(handlerErr)
	_ = wrappedErr(withJobName(context.Background(), "test-job-error"))

	if !loggedError.Load() {
		t.Error("error was not logged")
	}
}

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
