// Package scheduler provides a GitHub Actions-inspired cron job scheduler.
//
// Features:
//   - Standard cron expression syntax (5-field and 6-field formats)
//   - Timezone-aware scheduling
//   - Middleware pattern for cross-cutting concerns (logging, metrics, recovery)
//   - Graceful shutdown with context cancellation
//   - Zero external dependencies
//
// Basic usage:
//
//	s := scheduler.New()
//
//	s.Register(&scheduler.Job{
//		Name:     "daily-cleanup",
//		Schedule: "0 2 * * *", // 2 AM daily
//		Handler: func(ctx context.Context) error {
//			// Your cleanup logic here
//			return nil
//		},
//	})
//
//	s.Start()
//	defer s.Stop(context.Background())
//
// With middleware:
//
//	s := scheduler.New(
//		scheduler.WithTimezone("America/New_York"),
//		scheduler.WithMiddleware(
//			scheduler.Recovery(),
//			scheduler.Logging(),
//		),
//	)
package scheduler
