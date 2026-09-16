package store

import "context"

// Habit is an account-owned daily practice with minimum and target thresholds.
type Habit struct {
	ID           int32
	UID          string
	CreatorID    int32
	CreatedTs    int64
	UpdatedTs    int64
	Title        string
	Identity     string
	Cue          string
	Environment  string
	MinimumValue int32
	TargetValue  int32
	StartDate    string
}

// FindHabit filters habits.
type FindHabit struct {
	ID        *int32
	UID       *string
	CreatorID *int32
}

// UpdateHabit contains mutable habit fields.
type UpdateHabit struct {
	ID           int32
	CreatorID    int32
	Title        *string
	Identity     *string
	Cue          *string
	Environment  *string
	MinimumValue *int32
	TargetValue  *int32
	StartDate    *string
}

// DeleteHabit identifies an owner-scoped habit deletion.
type DeleteHabit struct {
	ID        int32
	CreatorID int32
}

// HabitLog is one measured value on a habit's local calendar date.
type HabitLog struct {
	HabitID   int32
	LogDate   string
	Value     int32
	CreatedTs int64
	UpdatedTs int64
}

// FindHabitLog filters daily logs.
type FindHabitLog struct {
	HabitID   *int32
	StartDate *string
	EndDate   *string
}

// DeleteHabitLog identifies one daily record.
type DeleteHabitLog struct {
	HabitID int32
	LogDate string
}

func (s *Store) CreateHabit(ctx context.Context, create *Habit) (*Habit, error) {
	return s.driver.CreateHabit(ctx, create)
}

func (s *Store) ListHabits(ctx context.Context, find *FindHabit) ([]*Habit, error) {
	return s.driver.ListHabits(ctx, find)
}

func (s *Store) UpdateHabit(ctx context.Context, update *UpdateHabit) (*Habit, error) {
	return s.driver.UpdateHabit(ctx, update)
}

func (s *Store) DeleteHabit(ctx context.Context, delete *DeleteHabit) error {
	return s.driver.DeleteHabit(ctx, delete)
}

func (s *Store) UpsertHabitLog(ctx context.Context, upsert *HabitLog) (*HabitLog, error) {
	return s.driver.UpsertHabitLog(ctx, upsert)
}

func (s *Store) ListHabitLogs(ctx context.Context, find *FindHabitLog) ([]*HabitLog, error) {
	return s.driver.ListHabitLogs(ctx, find)
}

func (s *Store) DeleteHabitLog(ctx context.Context, delete *DeleteHabitLog) error {
	return s.driver.DeleteHabitLog(ctx, delete)
}
