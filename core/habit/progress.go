// Package habit contains the business rules for daily habit progress.
package habit

import (
	"errors"
	"time"
)

const xpPerSuccessfulDay = 10

// Config defines the calendar window and thresholds used to calculate progress.
type Config struct {
	StartDate    time.Time
	AsOfDate     time.Time
	MinimumValue int32
	TargetValue  int32
}

// Log is one measured value on a local calendar date.
type Log struct {
	Date  time.Time
	Value int32
}

// Progress is the derived performance and reward state for a habit.
type Progress struct {
	CurrentStreak      int
	BestStreak         int
	SuccessfulDays     int
	TargetDays         int
	TrackedDays        int
	TotalValue         int64
	ConsistencyPercent int
	TargetPercent      int
	XP                 int
	Level              int
	LevelProgressXP    int
	NeedsRecovery      bool
}

// CalculateProgress deterministically derives streaks, performance, and rewards from daily logs.
func CalculateProgress(config Config, logs []Log) (Progress, error) {
	start := calendarDate(config.StartDate)
	asOf := calendarDate(config.AsOfDate)
	if start.IsZero() || asOf.IsZero() || asOf.Before(start) {
		return Progress{}, errors.New("start date and as-of date must define a valid range")
	}
	if config.MinimumValue <= 0 || config.TargetValue < config.MinimumValue {
		return Progress{}, errors.New("thresholds must be positive and target must meet or exceed minimum")
	}

	values := make(map[string]int32, len(logs))
	for _, log := range logs {
		date := calendarDate(log.Date)
		if date.Before(start) || date.After(asOf) || log.Value < 0 {
			continue
		}
		values[date.Format(time.DateOnly)] = log.Value
	}

	lastTracked := asOf
	if _, recordedToday := values[asOf.Format(time.DateOnly)]; !recordedToday {
		lastTracked = asOf.AddDate(0, 0, -1)
	}

	progress := Progress{Level: 1}
	running := 0
	for date := start; !date.After(lastTracked); date = date.AddDate(0, 0, 1) {
		progress.TrackedDays++
		value := values[date.Format(time.DateOnly)]
		progress.TotalValue += int64(value)
		if value >= config.MinimumValue {
			progress.SuccessfulDays++
			running++
			if running > progress.BestStreak {
				progress.BestStreak = running
			}
		} else {
			running = 0
		}
		if value >= config.TargetValue {
			progress.TargetDays++
		}
	}
	progress.CurrentStreak = running
	if progress.TrackedDays > 0 {
		progress.ConsistencyPercent = progress.SuccessfulDays * 100 / progress.TrackedDays
		progress.TargetPercent = progress.TargetDays * 100 / progress.TrackedDays
		progress.NeedsRecovery = values[lastTracked.Format(time.DateOnly)] < config.MinimumValue
	}
	progress.XP = progress.SuccessfulDays * xpPerSuccessfulDay
	progress.Level = 1 + progress.XP/100
	progress.LevelProgressXP = progress.XP % 100
	return progress, nil
}

func calendarDate(value time.Time) time.Time {
	if value.IsZero() {
		return time.Time{}
	}
	return time.Date(value.Year(), value.Month(), value.Day(), 0, 0, 0, 0, time.UTC)
}
