package scheduler

import (
	"context"
	"testing"
)

func TestJobDefinition(t *testing.T) {
	callCount := 0
	job := &Job{
		Name: "test-job",
		Handler: func(_ context.Context) error {
			callCount++
			return nil
		},
	}

	if job.Name != "test-job" {
		t.Errorf("expected name 'test-job', got %s", job.Name)
	}

	// Test handler execution
	if err := job.Handler(context.Background()); err != nil {
		t.Fatalf("handler failed: %v", err)
	}

	if callCount != 1 {
		t.Errorf("expected handler to be called once, called %d times", callCount)
	}
}

func TestJobValidation(t *testing.T) {
	tests := []struct {
		name    string
		job     *Job
		wantErr bool
	}{
		{
			name: "valid job",
			job: &Job{
				Name:     "valid",
				Schedule: "0 * * * *",
				Handler:  func(_ context.Context) error { return nil },
			},
			wantErr: false,
		},
		{
			name: "missing name",
			job: &Job{
				Schedule: "0 * * * *",
				Handler:  func(_ context.Context) error { return nil },
			},
			wantErr: true,
		},
		{
			name: "missing schedule",
			job: &Job{
				Name:    "test",
				Handler: func(_ context.Context) error { return nil },
			},
			wantErr: true,
		},
		{
			name: "invalid cron expression",
			job: &Job{
				Name:     "test",
				Schedule: "invalid cron",
				Handler:  func(_ context.Context) error { return nil },
			},
			wantErr: true,
		},
		{
			name: "missing handler",
			job: &Job{
				Name:     "test",
				Schedule: "0 * * * *",
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.job.Validate()
			if (err != nil) != tt.wantErr {
				t.Errorf("Validate() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}
