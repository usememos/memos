package api

import (
	"context"
	"maps"
	"slices"

	"github.com/pkg/errors"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	apipb "github.com/usememos/memos/proto/gen/api"
	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
)

// convertInstanceSettingResponse converts a stored setting for the API. Usage
// limits name users, so they need the store to turn IDs into user names.
func (s *APIService) convertInstanceSettingResponse(ctx context.Context, setting *storepb.InstanceSetting) (*apipb.InstanceSetting, error) {
	result := convertInstanceSettingFromStore(setting)
	if setting.Key == storepb.InstanceSettingKey_USAGE_LIMITS {
		usageLimits, err := s.convertUsageLimitsSettingFromStore(ctx, setting.GetUsageLimitsSetting())
		if err != nil {
			return nil, status.Errorf(codes.Internal, "failed to convert usage limits: %v", err)
		}
		result.Value = &apipb.InstanceSetting_UsageLimitsSetting_{UsageLimitsSetting: usageLimits}
	}
	return result, nil
}

// convertUsageLimitsSettingFromStore converts the stored usage limits for the
// API, naming users by username. Users that no longer exist are left out,
// because an entry naming only missing users never matches anyone.
func (s *APIService) convertUsageLimitsSettingFromStore(ctx context.Context, setting *storepb.InstanceUsageLimitsSetting) (*apipb.InstanceSetting_UsageLimitsSetting, error) {
	userIDs := []int32{}
	for _, limit := range setting.GetLimits() {
		userIDs = append(userIDs, limit.GetUserIds()...)
	}
	usernames, err := s.listUsernamesByID(ctx, userIDs)
	if err != nil {
		return nil, errors.Wrap(err, "failed to list users")
	}
	result := &apipb.InstanceSetting_UsageLimitsSetting{}
	for _, limit := range setting.GetLimits() {
		entry := &apipb.InstanceSetting_UsageLimitsSetting_UsageLimit{
			AllUsers:         limit.GetAllUsers(),
			MemoCount:        limit.MemoCount,
			MemoContentBytes: limit.MemoContentBytes,
			StorageBytes:     limit.StorageBytes,
			UploadBytes:      limit.UploadBytes,
		}
		for _, userID := range limit.GetUserIds() {
			if username, ok := usernames[userID]; ok {
				entry.Users = append(entry.Users, BuildUserName(username))
			}
		}
		result.Limits = append(result.Limits, entry)
	}
	return result, nil
}

// convertUsageLimitsSettingToStore converts usage limits from the API for the
// store, resolving usernames to IDs. It returns an InvalidArgument status for
// a malformed user name and a NotFound status for a user that does not exist.
// The store validates the list when it is written.
func (s *APIService) convertUsageLimitsSettingToStore(ctx context.Context, setting *apipb.InstanceSetting_UsageLimitsSetting) (*storepb.InstanceUsageLimitsSetting, error) {
	if setting == nil {
		return nil, status.Errorf(codes.InvalidArgument, "usage limits setting is required")
	}
	// Request user name to username, parsed once.
	usernameOf := map[string]string{}
	for _, limit := range setting.GetLimits() {
		for _, name := range limit.GetUsers() {
			username, err := parseUsernameFromName(name)
			if err != nil {
				return nil, status.Errorf(codes.InvalidArgument, "invalid user name %q: %v", name, err)
			}
			usernameOf[name] = username
		}
	}
	userIDs := map[string]int32{}
	if len(usernameOf) > 0 {
		users, err := s.Store.ListUsers(ctx, &store.FindUser{UsernameList: slices.Collect(maps.Values(usernameOf))})
		if err != nil {
			return nil, status.Errorf(codes.Internal, "failed to list users: %v", err)
		}
		for _, user := range users {
			userIDs[user.Username] = user.ID
		}
	}
	result := &storepb.InstanceUsageLimitsSetting{}
	for _, limit := range setting.GetLimits() {
		entry := &storepb.InstanceUsageLimitsSetting_UsageLimit{
			AllUsers:         limit.GetAllUsers(),
			MemoCount:        limit.MemoCount,
			MemoContentBytes: limit.MemoContentBytes,
			StorageBytes:     limit.StorageBytes,
			UploadBytes:      limit.UploadBytes,
		}
		for _, name := range limit.GetUsers() {
			userID, ok := userIDs[usernameOf[name]]
			if !ok {
				return nil, status.Errorf(codes.NotFound, "user %q not found", name)
			}
			entry.UserIds = append(entry.UserIds, userID)
		}
		result.Limits = append(result.Limits, entry)
	}
	return result, nil
}
