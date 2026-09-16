package v1

import (
	"context"
	"database/sql"
	"strings"
	"time"

	"github.com/pkg/errors"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/emptypb"

	corehabit "github.com/usememos/memos/core/habit"
	v1pb "github.com/usememos/memos/proto/gen/api/v1"
	"github.com/usememos/memos/store"
)

func (s *APIV1Service) requireHabitUser(ctx context.Context) (*store.User, error) {
	user, err := s.fetchCurrentUser(ctx)
	if err != nil || user == nil {
		return nil, status.Error(codes.Unauthenticated, "user not authenticated")
	}
	return user, nil
}

func parseHabitDate(value string) (time.Time, error) {
	date, err := time.Parse(time.DateOnly, value)
	if err != nil || date.Format(time.DateOnly) != value {
		return time.Time{}, status.Error(codes.InvalidArgument, "date must use YYYY-MM-DD")
	}
	return date, nil
}

func validateHabit(habit *v1pb.Habit) error {
	if habit == nil {
		return status.Error(codes.InvalidArgument, "habit is required")
	}
	if strings.TrimSpace(habit.Title) == "" {
		return status.Error(codes.InvalidArgument, "title is required")
	}
	if habit.MinimumValue <= 0 {
		return status.Error(codes.InvalidArgument, "minimum value must be positive")
	}
	if habit.TargetValue < habit.MinimumValue {
		return status.Error(codes.InvalidArgument, "target value must meet or exceed minimum value")
	}
	_, err := parseHabitDate(habit.StartDate)
	return err
}

func (s *APIV1Service) ownedHabit(ctx context.Context, name string, userID int32) (*store.Habit, error) {
	uid, err := ExtractHabitUIDFromName(name)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid habit name: %v", err)
	}
	habits, err := s.Store.ListHabits(ctx, &store.FindHabit{UID: &uid, CreatorID: &userID})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get habit: %v", err)
	}
	if len(habits) == 0 {
		return nil, status.Error(codes.NotFound, "habit not found")
	}
	return habits[0], nil
}

// CreateHabit creates a daily habit owned by the caller.
func (s *APIV1Service) CreateHabit(ctx context.Context, request *v1pb.CreateHabitRequest) (*v1pb.Habit, error) {
	user, err := s.requireHabitUser(ctx)
	if err != nil {
		return nil, err
	}
	if err := validateHabit(request.GetHabit()); err != nil {
		return nil, err
	}
	uid, err := ValidateAndGenerateUID(request.HabitId)
	if err != nil {
		return nil, err
	}
	created, err := s.Store.CreateHabit(ctx, &store.Habit{UID: uid, CreatorID: user.ID, Title: strings.TrimSpace(request.Habit.Title), Identity: strings.TrimSpace(request.Habit.Identity), Cue: strings.TrimSpace(request.Habit.Cue), Environment: strings.TrimSpace(request.Habit.Environment), MinimumValue: request.Habit.MinimumValue, TargetValue: request.Habit.TargetValue, StartDate: request.Habit.StartDate})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to create habit: %v", err)
	}
	return convertHabitFromStore(created), nil
}

// ListHabits lists the caller's habits.
func (s *APIV1Service) ListHabits(ctx context.Context, _ *v1pb.ListHabitsRequest) (*v1pb.ListHabitsResponse, error) {
	user, err := s.requireHabitUser(ctx)
	if err != nil {
		return nil, err
	}
	habits, err := s.Store.ListHabits(ctx, &store.FindHabit{CreatorID: &user.ID})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list habits: %v", err)
	}
	response := &v1pb.ListHabitsResponse{Habits: make([]*v1pb.Habit, 0, len(habits))}
	for _, habit := range habits {
		response.Habits = append(response.Habits, convertHabitFromStore(habit))
	}
	return response, nil
}

// GetHabit gets one caller-owned habit.
func (s *APIV1Service) GetHabit(ctx context.Context, request *v1pb.GetHabitRequest) (*v1pb.Habit, error) {
	user, err := s.requireHabitUser(ctx)
	if err != nil {
		return nil, err
	}
	habit, err := s.ownedHabit(ctx, request.Name, user.ID)
	if err != nil {
		return nil, err
	}
	return convertHabitFromStore(habit), nil
}

// UpdateHabit updates caller-owned habit configuration.
func (s *APIV1Service) UpdateHabit(ctx context.Context, request *v1pb.UpdateHabitRequest) (*v1pb.Habit, error) {
	user, err := s.requireHabitUser(ctx)
	if err != nil {
		return nil, err
	}
	if request.Habit == nil || request.UpdateMask == nil || len(request.UpdateMask.Paths) == 0 {
		return nil, status.Error(codes.InvalidArgument, "habit and update mask are required")
	}
	habit, err := s.ownedHabit(ctx, request.Habit.Name, user.ID)
	if err != nil {
		return nil, err
	}
	update := &store.UpdateHabit{ID: habit.ID, CreatorID: user.ID}
	for _, path := range request.UpdateMask.Paths {
		switch path {
		case "title":
			value := strings.TrimSpace(request.Habit.Title)
			if value == "" {
				return nil, status.Error(codes.InvalidArgument, "title is required")
			}
			update.Title = &value
		case "identity":
			value := strings.TrimSpace(request.Habit.Identity)
			update.Identity = &value
		case "cue":
			value := strings.TrimSpace(request.Habit.Cue)
			update.Cue = &value
		case "environment":
			value := strings.TrimSpace(request.Habit.Environment)
			update.Environment = &value
		case "minimum_value":
			value := request.Habit.MinimumValue
			update.MinimumValue = &value
		case "target_value":
			value := request.Habit.TargetValue
			update.TargetValue = &value
		case "start_date":
			if _, err := parseHabitDate(request.Habit.StartDate); err != nil {
				return nil, err
			}
			value := request.Habit.StartDate
			update.StartDate = &value
		default:
			return nil, status.Errorf(codes.InvalidArgument, "unsupported update path %q", path)
		}
	}
	minimum, target := habit.MinimumValue, habit.TargetValue
	if update.MinimumValue != nil {
		minimum = *update.MinimumValue
	}
	if update.TargetValue != nil {
		target = *update.TargetValue
	}
	if minimum <= 0 || target < minimum {
		return nil, status.Error(codes.InvalidArgument, "target value must meet or exceed a positive minimum value")
	}
	updated, err := s.Store.UpdateHabit(ctx, update)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, status.Error(codes.NotFound, "habit not found")
		}
		return nil, status.Errorf(codes.Internal, "failed to update habit: %v", err)
	}
	return convertHabitFromStore(updated), nil
}

// DeleteHabit deletes a caller-owned habit and its logs.
func (s *APIV1Service) DeleteHabit(ctx context.Context, request *v1pb.DeleteHabitRequest) (*emptypb.Empty, error) {
	user, err := s.requireHabitUser(ctx)
	if err != nil {
		return nil, err
	}
	habit, err := s.ownedHabit(ctx, request.Name, user.ID)
	if err != nil {
		return nil, err
	}
	if err := s.Store.DeleteHabit(ctx, &store.DeleteHabit{ID: habit.ID, CreatorID: user.ID}); err != nil {
		return nil, status.Errorf(codes.Internal, "failed to delete habit: %v", err)
	}
	return &emptypb.Empty{}, nil
}

// UpsertHabitLog records or replaces one local calendar day's value.
func (s *APIV1Service) UpsertHabitLog(ctx context.Context, request *v1pb.UpsertHabitLogRequest) (*v1pb.HabitLog, error) {
	user, err := s.requireHabitUser(ctx)
	if err != nil {
		return nil, err
	}
	if request.Log == nil || request.Log.Value < 0 {
		return nil, status.Error(codes.InvalidArgument, "a non-negative habit log is required")
	}
	if _, err := parseHabitDate(request.Log.LogDate); err != nil {
		return nil, err
	}
	habit, err := s.ownedHabit(ctx, request.Parent, user.ID)
	if err != nil {
		return nil, err
	}
	log, err := s.Store.UpsertHabitLog(ctx, &store.HabitLog{HabitID: habit.ID, LogDate: request.Log.LogDate, Value: request.Log.Value})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to save habit log: %v", err)
	}
	return &v1pb.HabitLog{LogDate: log.LogDate, Value: log.Value}, nil
}

// DeleteHabitLog removes one caller-owned daily record.
func (s *APIV1Service) DeleteHabitLog(ctx context.Context, request *v1pb.DeleteHabitLogRequest) (*emptypb.Empty, error) {
	user, err := s.requireHabitUser(ctx)
	if err != nil {
		return nil, err
	}
	if _, err := parseHabitDate(request.LogDate); err != nil {
		return nil, err
	}
	habit, err := s.ownedHabit(ctx, request.Parent, user.ID)
	if err != nil {
		return nil, err
	}
	if err := s.Store.DeleteHabitLog(ctx, &store.DeleteHabitLog{HabitID: habit.ID, LogDate: request.LogDate}); err != nil {
		return nil, status.Errorf(codes.Internal, "failed to delete habit log: %v", err)
	}
	return &emptypb.Empty{}, nil
}

// GetHabitSummary returns computed progress and a recent daily series.
func (s *APIV1Service) GetHabitSummary(ctx context.Context, request *v1pb.GetHabitSummaryRequest) (*v1pb.HabitSummary, error) {
	user, err := s.requireHabitUser(ctx)
	if err != nil {
		return nil, err
	}
	asOf, err := parseHabitDate(request.AsOfDate)
	if err != nil {
		return nil, err
	}
	habit, err := s.ownedHabit(ctx, request.Name, user.ID)
	if err != nil {
		return nil, err
	}
	start, _ := parseHabitDate(habit.StartDate)
	if asOf.Before(start) {
		return nil, status.Error(codes.InvalidArgument, "as-of date cannot precede habit start date")
	}
	logs, err := s.Store.ListHabitLogs(ctx, &store.FindHabitLog{HabitID: &habit.ID, EndDate: &request.AsOfDate})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list habit logs: %v", err)
	}
	coreLogs := make([]corehabit.Log, 0, len(logs))
	values := map[string]int32{}
	for _, log := range logs {
		date, parseErr := time.Parse(time.DateOnly, log.LogDate)
		if parseErr != nil {
			continue
		}
		coreLogs = append(coreLogs, corehabit.Log{Date: date, Value: log.Value})
		values[log.LogDate] = log.Value
	}
	progress, err := corehabit.CalculateProgress(corehabit.Config{StartDate: start, AsOfDate: asOf, MinimumValue: habit.MinimumValue, TargetValue: habit.TargetValue}, coreLogs)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to calculate habit progress: %v", err)
	}
	days := int(request.Days)
	if days <= 0 || days > 90 {
		days = 14
	}
	recent := make([]*v1pb.HabitDay, 0, days)
	first := asOf.AddDate(0, 0, -(days - 1))
	if first.Before(start) {
		first = start
	}
	for date := first; !date.After(asOf); date = date.AddDate(0, 0, 1) {
		key := date.Format(time.DateOnly)
		value, recorded := values[key]
		recent = append(recent, &v1pb.HabitDay{Date: key, Value: value, Recorded: recorded, Successful: recorded && value >= habit.MinimumValue, TargetMet: recorded && value >= habit.TargetValue})
	}
	return &v1pb.HabitSummary{Habit: convertHabitFromStore(habit), CurrentStreak: int32(progress.CurrentStreak), BestStreak: int32(progress.BestStreak), SuccessfulDays: int32(progress.SuccessfulDays), TargetDays: int32(progress.TargetDays), TrackedDays: int32(progress.TrackedDays), TotalValue: progress.TotalValue, ConsistencyPercent: int32(progress.ConsistencyPercent), TargetPercent: int32(progress.TargetPercent), Xp: int32(progress.XP), Level: int32(progress.Level), LevelProgressXp: int32(progress.LevelProgressXP), NeedsRecovery: progress.NeedsRecovery, RecentDays: recent}, nil
}

func convertHabitFromStore(habit *store.Habit) *v1pb.Habit {
	return &v1pb.Habit{Name: HabitNamePrefix + habit.UID, Title: habit.Title, Identity: habit.Identity, Cue: habit.Cue, Environment: habit.Environment, MinimumValue: habit.MinimumValue, TargetValue: habit.TargetValue, StartDate: habit.StartDate, CreateTime: habit.CreatedTs, UpdateTime: habit.UpdatedTs}
}
