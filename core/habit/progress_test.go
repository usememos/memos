package habit

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestCalculateProgressSeparatesShowingUpFromTarget(t *testing.T) {
	progress, err := CalculateProgress(Config{
		StartDate:    mustDate(t, "2026-09-01"),
		AsOfDate:     mustDate(t, "2026-09-05"),
		MinimumValue: 2,
		TargetValue:  20,
	}, []Log{
		{Date: mustDate(t, "2026-09-01"), Value: 20},
		{Date: mustDate(t, "2026-09-02"), Value: 2},
		{Date: mustDate(t, "2026-09-03"), Value: 0},
		{Date: mustDate(t, "2026-09-04"), Value: 30},
		{Date: mustDate(t, "2026-09-05"), Value: 2},
	})
	require.NoError(t, err)
	require.Equal(t, 2, progress.CurrentStreak)
	require.Equal(t, 2, progress.BestStreak)
	require.Equal(t, 4, progress.SuccessfulDays)
	require.Equal(t, 2, progress.TargetDays)
	require.Equal(t, 5, progress.TrackedDays)
	require.Equal(t, int64(54), progress.TotalValue)
	require.Equal(t, 80, progress.ConsistencyPercent)
	require.Equal(t, 40, progress.TargetPercent)
	require.Equal(t, 40, progress.XP)
	require.Equal(t, 1, progress.Level)
	require.Equal(t, 40, progress.LevelProgressXP)
	require.False(t, progress.NeedsRecovery)
}

func TestCalculateProgressLeavesAnUnloggedTodayOpen(t *testing.T) {
	progress, err := CalculateProgress(Config{
		StartDate:    mustDate(t, "2026-09-01"),
		AsOfDate:     mustDate(t, "2026-09-04"),
		MinimumValue: 2,
		TargetValue:  20,
	}, []Log{
		{Date: mustDate(t, "2026-09-01"), Value: 2},
		{Date: mustDate(t, "2026-09-02"), Value: 20},
		{Date: mustDate(t, "2026-09-03"), Value: 2},
	})
	require.NoError(t, err)
	require.Equal(t, 3, progress.CurrentStreak)
	require.Equal(t, 3, progress.TrackedDays)
	require.Equal(t, 100, progress.ConsistencyPercent)
	require.False(t, progress.NeedsRecovery)
}

func TestCalculateProgressFlagsNeverMissTwiceRecovery(t *testing.T) {
	progress, err := CalculateProgress(Config{
		StartDate:    mustDate(t, "2026-09-01"),
		AsOfDate:     mustDate(t, "2026-09-05"),
		MinimumValue: 2,
		TargetValue:  20,
	}, []Log{
		{Date: mustDate(t, "2026-09-01"), Value: 20},
		{Date: mustDate(t, "2026-09-02"), Value: 20},
		{Date: mustDate(t, "2026-09-03"), Value: 20},
	})
	require.NoError(t, err)
	require.Equal(t, 0, progress.CurrentStreak)
	require.Equal(t, 3, progress.BestStreak)
	require.Equal(t, 4, progress.TrackedDays)
	require.True(t, progress.NeedsRecovery)
}

func TestCalculateProgressLevelsEveryHundredXP(t *testing.T) {
	logs := make([]Log, 0, 12)
	start := mustDate(t, "2026-09-01")
	for day := 0; day < 12; day++ {
		logs = append(logs, Log{Date: start.AddDate(0, 0, day), Value: 2})
	}
	progress, err := CalculateProgress(Config{
		StartDate: start, AsOfDate: start.AddDate(0, 0, 11), MinimumValue: 2, TargetValue: 20,
	}, logs)
	require.NoError(t, err)
	require.Equal(t, 120, progress.XP)
	require.Equal(t, 2, progress.Level)
	require.Equal(t, 20, progress.LevelProgressXP)
}

func TestCalculateProgressRejectsInvalidConfiguration(t *testing.T) {
	_, err := CalculateProgress(Config{MinimumValue: 20, TargetValue: 2}, nil)
	require.Error(t, err)
}

func mustDate(t *testing.T, value string) time.Time {
	t.Helper()
	parsed, err := time.Parse(time.DateOnly, value)
	require.NoError(t, err)
	return parsed
}
