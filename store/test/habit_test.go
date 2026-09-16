package test

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/usememos/memos/store"
)

func TestHabitStoreOwnsHabitsAndReplacesDailyLogs(t *testing.T) {
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	t.Cleanup(func() { _ = ts.Close() })
	owner, err := createTestingHostUser(ctx, ts)
	require.NoError(t, err)
	other, err := ts.CreateUser(ctx, &store.User{Username: "other", Role: store.RoleUser, PasswordHash: "unused"})
	require.NoError(t, err)

	habit, err := ts.CreateHabit(ctx, &store.Habit{
		UID: "reading", CreatorID: owner.ID, Title: "Reading", Identity: "Become a reader", Cue: "After coffee", Environment: "Book on table",
		MinimumValue: 2, TargetValue: 20, StartDate: "2026-09-01",
	})
	require.NoError(t, err)
	require.NotZero(t, habit.ID)

	owned, err := ts.ListHabits(ctx, &store.FindHabit{CreatorID: &owner.ID})
	require.NoError(t, err)
	require.Len(t, owned, 1)
	foreign, err := ts.ListHabits(ctx, &store.FindHabit{CreatorID: &other.ID})
	require.NoError(t, err)
	require.Empty(t, foreign)

	log, err := ts.UpsertHabitLog(ctx, &store.HabitLog{HabitID: habit.ID, LogDate: "2026-09-02", Value: 2})
	require.NoError(t, err)
	require.Equal(t, int32(2), log.Value)
	log, err = ts.UpsertHabitLog(ctx, &store.HabitLog{HabitID: habit.ID, LogDate: "2026-09-02", Value: 25})
	require.NoError(t, err)
	require.Equal(t, int32(25), log.Value)
	logs, err := ts.ListHabitLogs(ctx, &store.FindHabitLog{HabitID: &habit.ID})
	require.NoError(t, err)
	require.Len(t, logs, 1)
	require.Equal(t, int32(25), logs[0].Value)

	_, err = ts.DeleteUser(ctx, &store.DeleteUser{ID: owner.ID})
	require.NoError(t, err)
	habitsAfterDelete, err := ts.ListHabits(ctx, &store.FindHabit{CreatorID: &owner.ID})
	require.NoError(t, err)
	require.Empty(t, habitsAfterDelete)
	logsAfterDelete, err := ts.ListHabitLogs(ctx, &store.FindHabitLog{HabitID: &habit.ID})
	require.NoError(t, err)
	require.Empty(t, logsAfterDelete)

	_, err = ts.CreateHabit(ctx, &store.Habit{
		UID: "orphan", CreatorID: owner.ID, Title: "Orphan", MinimumValue: 1, TargetValue: 1, StartDate: "2026-09-03",
	})
	require.Error(t, err)
}
