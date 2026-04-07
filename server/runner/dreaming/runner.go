package dreaming

import (
	"context"
	"log/slog"
	"time"

	"github.com/usememos/memos/internal/dreaming"
	"github.com/usememos/memos/store"
)

// Runner manages the dreaming pipeline as a background process.
// It runs micro dreaming at a high frequency and major dreaming once per day.
type Runner struct {
	Store    *store.Store
	Pipeline *dreaming.Pipeline
}

// NewRunner creates a new dreaming runner.
func NewRunner(s *store.Store) *Runner {
	cfg := dreaming.DefaultConfig()
	return &Runner{
		Store:    s,
		Pipeline: dreaming.NewPipeline(s, cfg),
	}
}

// Micro interval: every 2 hours.
const microInterval = 2 * time.Hour

// Major interval: every 24 hours.
const majorInterval = 24 * time.Hour

// Run starts the continuous dreaming runner with both micro and major schedules.
func (r *Runner) Run(ctx context.Context) {
	microTicker := time.NewTicker(microInterval)
	majorTicker := time.NewTicker(majorInterval)
	defer microTicker.Stop()
	defer majorTicker.Stop()

	for {
		select {
		case <-microTicker.C:
			r.RunMicro(ctx)
		case <-majorTicker.C:
			r.RunMajor(ctx)
		case <-ctx.Done():
			slog.Info("dreaming runner stopped")
			return
		}
	}
}

// RunOnce runs a single micro dreaming cycle immediately.
func (r *Runner) RunOnce(ctx context.Context) {
	r.RunMicro(ctx)
}

// RunMicro executes a micro dreaming run (replay queue refresh, spindle tagging, light sleep, forgetting).
func (r *Runner) RunMicro(ctx context.Context) {
	slog.Info("dreaming: starting micro run")
	output, err := r.Pipeline.Run(ctx, store.DreamingRunTypeMicro)
	if err != nil {
		slog.Error("dreaming: micro run failed", "error", err)
		return
	}
	slog.Info("dreaming: micro run completed",
		"insights_created", output.Stats.InsightsCreated,
		"insights_archived", output.Stats.InsightsArchived,
		"duration_ms", output.Stats.DurationMs,
	)
}

// RunMajor executes a major dreaming run (full pipeline including deep sleep and REM).
func (r *Runner) RunMajor(ctx context.Context) {
	slog.Info("dreaming: starting major run")
	output, err := r.Pipeline.Run(ctx, store.DreamingRunTypeMajor)
	if err != nil {
		slog.Error("dreaming: major run failed", "error", err)
		return
	}
	slog.Info("dreaming: major run completed",
		"insights_created", output.Stats.InsightsCreated,
		"insights_archived", output.Stats.InsightsArchived,
		"duration_ms", output.Stats.DurationMs,
	)
}
