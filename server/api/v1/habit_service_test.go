package v1

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	v1pb "github.com/usememos/memos/proto/gen/api/v1"
	"github.com/usememos/memos/store"
)

func TestHabitServiceOwnerIsolationAndIdempotentDailyReward(t *testing.T) {
	ctx := context.Background()
	service := newIntegrationService(t)
	owner := createSpaceTestUser(ctx, t, service, "habit-owner", store.RoleUser)
	other := createSpaceTestUser(ctx, t, service, "habit-other", store.RoleUser)

	habit, err := service.CreateHabit(userCtx(ctx, owner.ID), &v1pb.CreateHabitRequest{
		HabitId: "reading",
		Habit: &v1pb.Habit{
			Title: " Reading ", Identity: "Become a reader", Cue: "After coffee", Environment: "Book on table",
			MinimumValue: 2, TargetValue: 20, StartDate: "2026-09-01",
		},
	})
	require.NoError(t, err)
	require.Equal(t, "Reading", habit.Title)

	_, err = service.GetHabit(userCtx(ctx, other.ID), &v1pb.GetHabitRequest{Name: habit.Name})
	require.Equal(t, codes.NotFound, status.Code(err))
	otherList, err := service.ListHabits(userCtx(ctx, other.ID), &v1pb.ListHabitsRequest{})
	require.NoError(t, err)
	require.Empty(t, otherList.Habits)

	for _, value := range []int32{2, 25} {
		_, err = service.UpsertHabitLog(userCtx(ctx, owner.ID), &v1pb.UpsertHabitLogRequest{
			Parent: habit.Name, Log: &v1pb.HabitLog{LogDate: "2026-09-01", Value: value},
		})
		require.NoError(t, err)
	}
	summary, err := service.GetHabitSummary(userCtx(ctx, owner.ID), &v1pb.GetHabitSummaryRequest{Name: habit.Name, AsOfDate: "2026-09-01"})
	require.NoError(t, err)
	require.Equal(t, int32(10), summary.Xp, "replacing a daily value must not duplicate XP")
	require.Equal(t, int64(25), summary.TotalValue)
	require.Equal(t, int32(100), summary.ConsistencyPercent)
	require.Equal(t, int32(100), summary.TargetPercent)
}

func TestHabitServiceValidatesThresholdsAndDates(t *testing.T) {
	ctx := context.Background()
	service := newIntegrationService(t)
	owner := createSpaceTestUser(ctx, t, service, "habit-validation", store.RoleUser)

	_, err := service.CreateHabit(userCtx(ctx, owner.ID), &v1pb.CreateHabitRequest{Habit: &v1pb.Habit{
		Title: "Read", MinimumValue: 20, TargetValue: 2, StartDate: "16-09-2026",
	}})
	require.Equal(t, codes.InvalidArgument, status.Code(err))
}
