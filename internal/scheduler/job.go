package scheduler

import (
	"context"

	"github.com/pkg/errors"
)

// JobHandler is the function signature for scheduled job handlers.
// The context passed to the handler will be canceled if the scheduler is shutting down.
type JobHandler func(ctx context.Context) error

// Job represents a scheduled task.
type Job struct {
	// Name is a unique identifier for this job (required).
	// Used for logging and metrics.
	Name string

	// Schedule is a cron expression defining when this job runs (required).
	// Supports standard 5-field format: "minute hour day month weekday"
	// Examples: "0 * * * *" (hourly), "0 0 * * *" (daily at midnight)
	Schedule string

	// Timezone for schedule evaluation (optional, defaults to UTC).
	// Use IANA timezone names: "America/New_York", "Europe/London", etc.
	Timezone string

	// Handler is the function to execute when the job triggers (required).
	Handler JobHandler

	// Description provides human-readable context about what this job does (optional).
	Description string

	// Tags allow categorizing jobs for filtering/monitoring (optional).
	Tags []string
}

// Validate checks if the job definition is valid.
func (j *Job) Validate() error {
	if j.Name == "" {
		return errors.New("job name is required")
	}

	if j.Schedule == "" {
		return errors.New("job schedule is required")
	}

	// Validate cron expression using parser
	if _, err := ParseCronExpression(j.Schedule); err != nil {
		return errors.Wrap(err, "invalid cron expression")
	}

	if j.Handler == nil {
		return errors.New("job handler is required")
	}

	return nil
}
