# Scheduler Plugin

A production-ready, GitHub Actions-inspired cron job scheduler for Go.

## Features

- **Standard Cron Syntax**: Supports both 5-field and 6-field (with seconds) cron expressions
- **Timezone-Aware**: Explicit timezone handling to avoid DST surprises
- **Middleware Pattern**: Composable job wrappers for logging, metrics, panic recovery, timeouts
- **Graceful Shutdown**: Jobs complete cleanly or cancel when context expires
- **Zero Dependencies**: Core functionality uses only the standard library
- **Type-Safe**: Strong typing with clear error messages
- **Well-Tested**: Comprehensive test coverage

## Installation

This package is included with Memos. No separate installation required.

## Quick Start

```go
package main

import (
    "context"
    "fmt"
    "github.com/usememos/memos/plugin/scheduler"
)

func main() {
    s := scheduler.New()

    s.Register(&scheduler.Job{
        Name:     "daily-cleanup",
        Schedule: "0 2 * * *", // 2 AM daily
        Handler: func(ctx context.Context) error {
            fmt.Println("Running cleanup...")
            return nil
        },
    })

    s.Start()
    defer s.Stop(context.Background())

    // Keep running...
    select {}
}
```

## Cron Expression Format

### 5-Field Format (Standard)
```
┌───────────── minute (0 - 59)
│ ┌───────────── hour (0 - 23)
│ │ ┌───────────── day of month (1 - 31)
│ │ │ ┌───────────── month (1 - 12)
│ │ │ │ ┌───────────── day of week (0 - 7) (Sunday = 0 or 7)
│ │ │ │ │
* * * * *
```

### 6-Field Format (With Seconds)
```
┌───────────── second (0 - 59)
│ ┌───────────── minute (0 - 59)
│ │ ┌───────────── hour (0 - 23)
│ │ │ ┌───────────── day of month (1 - 31)
│ │ │ │ ┌───────────── month (1 - 12)
│ │ │ │ │ ┌───────────── day of week (0 - 7)
│ │ │ │ │ │
* * * * * *
```

### Special Characters

- `*` - Any value (every minute, every hour, etc.)
- `,` - List of values: `1,15,30` (1st, 15th, and 30th)
- `-` - Range: `9-17` (9 AM through 5 PM)
- `/` - Step: `*/15` (every 15 units)

### Common Examples

| Schedule | Description |
|----------|-------------|
| `* * * * *` | Every minute |
| `0 * * * *` | Every hour |
| `0 0 * * *` | Daily at midnight |
| `0 9 * * 1-5` | Weekdays at 9 AM |
| `*/15 * * * *` | Every 15 minutes |
| `0 0 1 * *` | First day of every month |
| `0 0 * * 0` | Every Sunday at midnight |
| `30 14 * * *` | Every day at 2:30 PM |

## Timezone Support

```go
// Global timezone for all jobs
s := scheduler.New(
    scheduler.WithTimezone("America/New_York"),
)

// Per-job timezone (overrides global)
s.Register(&scheduler.Job{
    Name:     "tokyo-report",
    Schedule: "0 9 * * *", // 9 AM Tokyo time
    Timezone: "Asia/Tokyo",
    Handler: func(ctx context.Context) error {
        // Runs at 9 AM in Tokyo
        return nil
    },
})
```

**Important**: Always use IANA timezone names (`America/New_York`, not `EST`).

## Middleware

Middleware wraps job handlers to add cross-cutting behavior. Multiple middleware can be chained together.

### Built-in Middleware

#### Recovery (Panic Handling)

```go
s := scheduler.New(
    scheduler.WithMiddleware(
        scheduler.Recovery(func(jobName string, r interface{}) {
            log.Printf("Job %s panicked: %v", jobName, r)
        }),
    ),
)
```

#### Logging

```go
type Logger interface {
    Info(msg string, args ...interface{})
    Error(msg string, args ...interface{})
}

s := scheduler.New(
    scheduler.WithMiddleware(
        scheduler.Logging(myLogger),
    ),
)
```

#### Timeout

```go
s := scheduler.New(
    scheduler.WithMiddleware(
        scheduler.Timeout(5 * time.Minute),
    ),
)
```

### Combining Middleware

```go
s := scheduler.New(
    scheduler.WithMiddleware(
        scheduler.Recovery(panicHandler),
        scheduler.Logging(logger),
        scheduler.Timeout(10 * time.Minute),
    ),
)
```

**Order matters**: Middleware are applied left-to-right. In the example above:
1. Recovery (outermost) catches panics from everything
2. Logging logs the execution
3. Timeout (innermost) wraps the actual handler

### Custom Middleware

```go
func Metrics(recorder MetricsRecorder) scheduler.Middleware {
    return func(next scheduler.JobHandler) scheduler.JobHandler {
        return func(ctx context.Context) error {
            start := time.Now()
            err := next(ctx)
            duration := time.Since(start)

            jobName := scheduler.GetJobName(ctx)
            recorder.Record(jobName, duration, err)

            return err
        }
    }
}
```

## Graceful Shutdown

Always use `Stop()` with a context to allow jobs to finish cleanly:

```go
// Give jobs up to 30 seconds to complete
ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
defer cancel()

if err := s.Stop(ctx); err != nil {
    log.Printf("Shutdown error: %v", err)
}
```

Jobs should respect context cancellation:

```go
Handler: func(ctx context.Context) error {
    for i := 0; i < 100; i++ {
        select {
        case <-ctx.Done():
            return ctx.Err() // Canceled
        default:
            // Do work
        }
    }
    return nil
}
```

## Best Practices

### 1. Always Name Your Jobs

Names are used for logging, metrics, and debugging:

```go
Name: "user-cleanup-job" // Good
Name: "job1"             // Bad
```

### 2. Add Descriptions and Tags

```go
s.Register(&scheduler.Job{
    Name:        "stale-session-cleanup",
    Description: "Removes user sessions older than 30 days",
    Tags:        []string{"maintenance", "security"},
    Schedule:    "0 3 * * *",
    Handler:     cleanupSessions,
})
```

### 3. Use Appropriate Middleware

Always include Recovery and Logging in production:

```go
scheduler.New(
    scheduler.WithMiddleware(
        scheduler.Recovery(logPanic),
        scheduler.Logging(logger),
    ),
)
```

### 4. Avoid Scheduling Exactly on the Hour

Many systems schedule jobs at `:00`, causing load spikes. Stagger your jobs:

```go
"5 2 * * *"  // 2:05 AM (good)
"0 2 * * *"  // 2:00 AM (often overloaded)
```

### 5. Make Jobs Idempotent

Jobs may run multiple times (crash recovery, etc.). Design them to be safely re-runnable:

```go
Handler: func(ctx context.Context) error {
    // Use unique constraint or check-before-insert
    db.Exec("INSERT IGNORE INTO processed_items ...")
    return nil
}
```

### 6. Handle Timezones Explicitly

Always specify timezone for business-hour jobs:

```go
Timezone: "America/New_York" // Good
// Timezone: ""              // Bad (defaults to UTC)
```

### 7. Test Your Cron Expressions

Use a cron expression calculator before deploying:
- [crontab.guru](https://crontab.guru/)
- Write unit tests with the parser

## Testing Jobs

Test job handlers independently of the scheduler:

```go
func TestCleanupJob(t *testing.T) {
    ctx := context.Background()

    err := cleanupHandler(ctx)
    if err != nil {
        t.Fatalf("cleanup failed: %v", err)
    }

    // Verify cleanup occurred
}
```

Test schedule parsing:

```go
func TestScheduleParsing(t *testing.T) {
    job := &scheduler.Job{
        Name:     "test",
        Schedule: "0 2 * * *",
        Handler:  func(ctx context.Context) error { return nil },
    }

    if err := job.Validate(); err != nil {
        t.Fatalf("invalid job: %v", err)
    }
}
```

## Comparison to Other Solutions

| Feature | scheduler | robfig/cron | github.com/go-co-op/gocron |
|---------|-----------|-------------|----------------------------|
| Standard cron syntax | ✅ | ✅ | ✅ |
| Seconds support | ✅ | ✅ | ✅ |
| Timezone support | ✅ | ✅ | ✅ |
| Middleware pattern | ✅ | ⚠️ (basic) | ❌ |
| Graceful shutdown | ✅ | ⚠️ (basic) | ✅ |
| Zero dependencies | ✅ | ❌ | ❌ |
| Job metadata | ✅ | ❌ | ⚠️ (limited) |

## API Reference

See [example_test.go](./example_test.go) for comprehensive examples.

### Core Types

- `Scheduler` - Manages scheduled jobs
- `Job` - Job definition with schedule and handler
- `Middleware` - Function that wraps job handlers

### Functions

- `New(opts ...Option) *Scheduler` - Create new scheduler
- `WithTimezone(tz string) Option` - Set default timezone
- `WithMiddleware(mw ...Middleware) Option` - Add middleware

### Methods

- `Register(job *Job) error` - Add job to scheduler
- `Start() error` - Begin executing jobs
- `Stop(ctx context.Context) error` - Graceful shutdown

## License

This package is part of the Memos project and shares its license.
