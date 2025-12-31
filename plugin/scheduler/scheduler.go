package scheduler

import (
	"context"
	"sync"
	"time"

	"github.com/pkg/errors"
)

// Scheduler manages scheduled jobs.
type Scheduler struct {
	jobs       map[string]*registeredJob
	jobsMu     sync.RWMutex
	timezone   *time.Location
	middleware Middleware
	running    bool
	runningMu  sync.RWMutex
	stopCh     chan struct{}
	wg         sync.WaitGroup
}

// registeredJob wraps a Job with runtime state.
type registeredJob struct {
	job      *Job
	cancelFn context.CancelFunc
}

// Option configures a Scheduler.
type Option func(*Scheduler)

// WithTimezone sets the default timezone for all jobs.
func WithTimezone(tz string) Option {
	return func(s *Scheduler) {
		loc, err := time.LoadLocation(tz)
		if err != nil {
			// Default to UTC on invalid timezone
			loc = time.UTC
		}
		s.timezone = loc
	}
}

// WithMiddleware sets middleware to wrap all job handlers.
func WithMiddleware(mw ...Middleware) Option {
	return func(s *Scheduler) {
		if len(mw) > 0 {
			s.middleware = Chain(mw...)
		}
	}
}

// New creates a new Scheduler with optional configuration.
func New(opts ...Option) *Scheduler {
	s := &Scheduler{
		jobs:     make(map[string]*registeredJob),
		timezone: time.UTC,
		stopCh:   make(chan struct{}),
	}

	for _, opt := range opts {
		opt(s)
	}

	return s
}

// Register adds a job to the scheduler.
// Jobs must be registered before calling Start().
func (s *Scheduler) Register(job *Job) error {
	if job == nil {
		return errors.New("job cannot be nil")
	}

	if err := job.Validate(); err != nil {
		return errors.Wrap(err, "invalid job")
	}

	s.jobsMu.Lock()
	defer s.jobsMu.Unlock()

	if _, exists := s.jobs[job.Name]; exists {
		return errors.Errorf("job with name %q already registered", job.Name)
	}

	s.jobs[job.Name] = &registeredJob{job: job}
	return nil
}

// Start begins executing scheduled jobs.
func (s *Scheduler) Start() error {
	s.runningMu.Lock()
	defer s.runningMu.Unlock()

	if s.running {
		return errors.New("scheduler already running")
	}

	s.jobsMu.RLock()
	defer s.jobsMu.RUnlock()

	// Parse and schedule all jobs
	for _, rj := range s.jobs {
		schedule, err := ParseCronExpression(rj.job.Schedule)
		if err != nil {
			return errors.Wrapf(err, "failed to parse schedule for job %q", rj.job.Name)
		}

		ctx, cancel := context.WithCancel(context.Background())
		rj.cancelFn = cancel

		s.wg.Add(1)
		go s.runJobWithSchedule(ctx, rj, schedule)
	}

	s.running = true
	return nil
}

// runJobWithSchedule executes a job according to its cron schedule.
func (s *Scheduler) runJobWithSchedule(ctx context.Context, rj *registeredJob, schedule *Schedule) {
	defer s.wg.Done()

	// Apply middleware to handler
	handler := rj.job.Handler
	if s.middleware != nil {
		handler = s.middleware(handler)
	}

	for {
		// Calculate next run time
		now := time.Now()
		if rj.job.Timezone != "" {
			loc, err := time.LoadLocation(rj.job.Timezone)
			if err == nil {
				now = now.In(loc)
			}
		} else if s.timezone != nil {
			now = now.In(s.timezone)
		}

		next := schedule.Next(now)
		duration := time.Until(next)

		timer := time.NewTimer(duration)

		select {
		case <-timer.C:
			// Add job name to context and execute
			jobCtx := withJobName(ctx, rj.job.Name)
			if err := handler(jobCtx); err != nil {
				// Error already handled by middleware (if any)
				_ = err
			}
		case <-ctx.Done():
			// Stop the timer to prevent it from firing. The timer will be garbage collected.
			timer.Stop()
			return
		case <-s.stopCh:
			// Stop the timer to prevent it from firing. The timer will be garbage collected.
			timer.Stop()
			return
		}
	}
}

// Stop gracefully shuts down the scheduler.
// It waits for all running jobs to complete or until the context is canceled.
func (s *Scheduler) Stop(ctx context.Context) error {
	s.runningMu.Lock()
	if !s.running {
		s.runningMu.Unlock()
		return errors.New("scheduler not running")
	}
	s.running = false
	s.runningMu.Unlock()

	// Cancel all job contexts
	s.jobsMu.RLock()
	for _, rj := range s.jobs {
		if rj.cancelFn != nil {
			rj.cancelFn()
		}
	}
	s.jobsMu.RUnlock()

	// Signal stop and wait for jobs to finish
	close(s.stopCh)

	done := make(chan struct{})
	go func() {
		s.wg.Wait()
		close(done)
	}()

	select {
	case <-done:
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}
