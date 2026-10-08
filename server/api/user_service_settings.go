package api

import (
	"context"
	"fmt"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	apipb "github.com/usememos/memos/proto/gen/api"
	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
)

func (s *APIService) GetUserSetting(ctx context.Context, request *apipb.GetUserSettingRequest) (*apipb.UserSetting, error) {
	// Parse resource name: users/{user}/settings/{setting}
	user, settingKey, err := s.resolveUserAndSettingKeyFromName(ctx, request.Name)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid resource name: %v", err)
	}
	userID := user.ID

	currentUser, err := s.fetchCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get current user: %v", err)
	}
	if currentUser == nil {
		return nil, status.Errorf(codes.Unauthenticated, "user not authenticated")
	}

	// Only allow user to get their own settings
	if currentUser.ID != userID {
		return nil, status.Errorf(codes.PermissionDenied, "permission denied")
	}

	// Convert setting key string to store enum
	storeKey, err := convertSettingKeyToStore(settingKey)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid setting key: %v", err)
	}

	userSetting, err := s.Store.GetUserSetting(ctx, &store.FindUserSetting{
		UserID: &userID,
		Key:    storeKey,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get user setting: %v", err)
	}

	return convertUserSettingFromStore(userSetting, user, storeKey), nil
}

func (s *APIService) UpdateUserSetting(ctx context.Context, request *apipb.UpdateUserSettingRequest) (*apipb.UserSetting, error) {
	// Parse resource name: users/{user}/settings/{setting}
	user, settingKey, err := s.resolveUserAndSettingKeyFromName(ctx, request.UserSetting.Name)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid resource name: %v", err)
	}
	userID := user.ID

	currentUser, err := s.fetchCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get current user: %v", err)
	}
	if currentUser == nil {
		return nil, status.Errorf(codes.Unauthenticated, "user not authenticated")
	}

	// Only allow user to update their own settings
	if currentUser.ID != userID {
		return nil, status.Errorf(codes.PermissionDenied, "permission denied")
	}

	if request.UpdateMask == nil || len(request.UpdateMask.Paths) == 0 {
		return nil, status.Errorf(codes.InvalidArgument, "update mask is empty")
	}

	// Convert setting key string to store enum
	storeKey, err := convertSettingKeyToStore(settingKey)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid setting key: %v", err)
	}

	var updatedSetting *apipb.UserSetting
	switch storeKey {
	case storepb.UserSetting_GENERAL:
		existingUserSetting, err := s.Store.GetUserSetting(ctx, &store.FindUserSetting{
			UserID: &userID,
			Key:    storeKey,
		})
		if err != nil {
			return nil, status.Errorf(codes.Internal, "failed to get existing general setting: %v", err)
		}

		// Seed the merge from the shared store→API converter, which already falls
		// back to defaults when the setting (or its general value) is missing.
		updatedGeneral := convertUserSettingFromStore(existingUserSetting, user, storeKey).GetGeneralSetting()

		incomingGeneral := request.UserSetting.GetGeneralSetting()
		if incomingGeneral == nil {
			return nil, status.Errorf(codes.InvalidArgument, "general setting is required")
		}
		for _, field := range request.UpdateMask.Paths {
			switch field {
			case "memo_visibility":
				switch incomingGeneral.MemoVisibility {
				case store.Private.String(), store.Protected.String(), store.Public.String():
				default:
					return nil, status.Errorf(codes.InvalidArgument, "memo_visibility must be PRIVATE, PROTECTED, or PUBLIC")
				}
				updatedGeneral.MemoVisibility = incomingGeneral.MemoVisibility
			case "theme":
				updatedGeneral.Theme = incomingGeneral.Theme
			case "locale":
				updatedGeneral.Locale = incomingGeneral.Locale
			case "save_media_metadata":
				updatedGeneral.SaveMediaMetadata = incomingGeneral.SaveMediaMetadata
			default:
				// Ignore unsupported fields.
			}
		}

		updatedSetting = &apipb.UserSetting{
			Name: request.UserSetting.Name,
			Value: &apipb.UserSetting_GeneralSetting_{
				GeneralSetting: updatedGeneral,
			},
		}
	case storepb.UserSetting_TAGS:
		var shouldUpdateTags bool
		for _, field := range request.UpdateMask.Paths {
			switch field {
			case "tags":
				shouldUpdateTags = true
			default:
				return nil, status.Errorf(codes.InvalidArgument, "unsupported update mask path for tags setting: %s", field)
			}
		}
		if !shouldUpdateTags {
			return nil, status.Errorf(codes.InvalidArgument, "update mask must include tags")
		}

		incomingTags := request.UserSetting.GetTagsSetting()
		if incomingTags == nil {
			return nil, status.Errorf(codes.InvalidArgument, "tags setting is required")
		}
		if err := validateUserTagsSetting(incomingTags); err != nil {
			return nil, status.Errorf(codes.InvalidArgument, "invalid user tags setting: %v", err)
		}
		updatedSetting = &apipb.UserSetting{
			Name: request.UserSetting.Name,
			Value: &apipb.UserSetting_TagsSetting_{
				TagsSetting: incomingTags,
			},
		}
	default:
		return nil, status.Errorf(codes.InvalidArgument, "setting type %s should not be updated via UpdateUserSetting", storeKey.String())
	}

	// Convert API setting to store setting
	storeSetting, err := convertUserSettingToStore(updatedSetting, userID, storeKey)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "failed to convert setting: %v", err)
	}

	// Upsert the setting
	if _, err := s.Store.UpsertUserSetting(ctx, storeSetting); err != nil {
		return nil, status.Errorf(codes.Internal, "failed to upsert user setting: %v", err)
	}

	return s.GetUserSetting(ctx, &apipb.GetUserSettingRequest{Name: request.UserSetting.Name})
}

func (s *APIService) ListUserSettings(ctx context.Context, request *apipb.ListUserSettingsRequest) (*apipb.ListUserSettingsResponse, error) {
	user, err := s.resolveUserFromName(ctx, request.Parent)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid parent name: %v", err)
	}
	userID := user.ID

	currentUser, err := s.fetchCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get current user: %v", err)
	}
	if currentUser == nil {
		return nil, status.Errorf(codes.Unauthenticated, "user not authenticated")
	}

	// Only allow user to list their own settings
	if currentUser.ID != userID {
		return nil, status.Errorf(codes.PermissionDenied, "permission denied")
	}

	userSettings, err := s.Store.ListUserSettings(ctx, &store.FindUserSetting{
		UserID: &userID,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list user settings: %v", err)
	}

	settings := make([]*apipb.UserSetting, 0, len(userSettings))
	for _, storeSetting := range userSettings {
		apiSetting := convertUserSettingFromStore(storeSetting, user, storeSetting.Key)
		if apiSetting != nil {
			settings = append(settings, apiSetting)
		}
	}

	hasGeneral := false
	for _, setting := range settings {
		if setting.GetGeneralSetting() != nil {
			hasGeneral = true
		}
	}
	if !hasGeneral {
		defaultGeneral := &apipb.UserSetting{
			Name: fmt.Sprintf("%s/settings/%s", BuildUserName(user.Username), convertSettingKeyFromStore(storepb.UserSetting_GENERAL)),
			Value: &apipb.UserSetting_GeneralSetting_{
				GeneralSetting: getDefaultUserGeneralSetting(),
			},
		}
		settings = append([]*apipb.UserSetting{defaultGeneral}, settings...)
	}
	response := &apipb.ListUserSettingsResponse{
		UserSettings: settings,
	}

	return response, nil
}

func (s *APIService) authorizeUserResourceAccess(ctx context.Context, userID int32, allowAdmin bool) (*store.User, error) {
	currentUser, err := s.fetchCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get current user: %v", err)
	}
	if currentUser == nil {
		return nil, status.Errorf(codes.Unauthenticated, "user not authenticated")
	}
	if currentUser.ID == userID || (allowAdmin && currentUser.Role == store.RoleAdmin) {
		return currentUser, nil
	}
	return nil, status.Errorf(codes.PermissionDenied, "permission denied")
}
