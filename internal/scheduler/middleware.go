package scheduler

import (
	"context"
	"time"

	"github.com/pkg/errors"
)

// Middleware wraps a JobHandler to add cross-cutting behavior.
type Middleware func(JobHandler) JobHandler

// Chain combines multiple middleware into a single middleware.
// Middleware are applied in the order they're provided (left to right).
func Chain(middlewares ...Middleware) Middleware {
	return func(handler JobHandler) JobHandler {
		// Apply middleware in reverse order so first middleware wraps outermost
		for i := len(middlewares) - 1; i >= 0; i-- {
			handler = middlewares[i](handler)
		}
		return handler
	}
}

// Recovery recovers from panics in job handlers and converts them to errors.
func Recovery(onPanic func(jobName string, recovered interface{})) Middleware {
	return func(next JobHandler) JobHandler {
		return func(ctx context.Context) (err error) {
			defer func() {
				if r := recover(); r != nil {
					jobName := getJobName(ctx)
					if onPanic != nil {
						onPanic(jobName, r)
					}
					err = errors.Errorf("job %q panicked: %v", jobName, r)
				}
			}()
			return next(ctx)
		}
	}
}

// Logger is a minimal logging interface.
type Logger interface {
	Info(msg string, args ...interface{})
	Error(msg string, args ...interface{})
}

// Logging adds execution logging to jobs.
func Logging(logger Logger) Middleware {
	return func(next JobHandler) JobHandler {
		return func(ctx context.Context) error {
			jobName := getJobName(ctx)
			start := time.Now()

			logger.Info("Job started", "job", jobName)

			err := next(ctx)
			duration := time.Since(start)

			if err != nil {
				logger.Error("Job failed", "job", jobName, "duration", duration, "error", err)
			} else {
				logger.Info("Job completed", "job", jobName, "duration", duration)
			}

			return err
		}
	}
}

// Timeout wraps a job handler with a timeout.
func Timeout(duration time.Duration) Middleware {
	return func(next JobHandler) JobHandler {
		return func(ctx context.Context) error {
			ctx, cancel := context.WithTimeout(ctx, duration)
			defer cancel()

			done := make(chan error, 1)
			go func() {
				done <- next(ctx)
			}()

			select {
			case err := <-done:
				return err
			case <-ctx.Done():
				return errors.Errorf("job %q timed out after %v", getJobName(ctx), duration)
			}
		}
	}
}

// Context keys for job metadata.
type contextKey int

const (
	jobNameKey contextKey = iota
)

// withJobName adds the job name to the context.
func withJobName(ctx context.Context, name string) context.Context {
	return context.WithValue(ctx, jobNameKey, name)
}

// getJobName retrieves the job name from the context.
func getJobName(ctx context.Context) string {
	if name, ok := ctx.Value(jobNameKey).(string); ok {
		return name
	}
	return "unknown"
}

// GetJobName retrieves the job name from the context (public API).
// Returns empty string if not found.
//
//nolint:revive // GetJobName is the public API, getJobName is internal
func GetJobName(ctx context.Context) string {
	return getJobName(ctx)
}
