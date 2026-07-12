package v1

import (
	"context"
	"fmt"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	v1pb "github.com/usememos/memos/proto/gen/api/v1"
	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
)

func (s *APIV1Service) GetUserSetting(ctx context.Context, request *v1pb.GetUserSettingRequest) (*v1pb.UserSetting, error) {
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

func (s *APIV1Service) UpdateUserSetting(ctx context.Context, request *v1pb.UpdateUserSettingRequest) (*v1pb.UserSetting, error) {
	// Parse resource name: users/{user}/settings/{setting}
	user, settingKey, err := s.resolveUserAndSettingKeyFromName(ctx, request.Setting.Name)
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

	var updatedSetting *v1pb.UserSetting
	switch storeKey {
	case storepb.UserSetting_GENERAL:
		existingUserSetting, _ := s.Store.GetUserSetting(ctx, &store.FindUserSetting{
			UserID: &userID,
			Key:    storeKey,
		})

		generalSetting := &storepb.GeneralUserSetting{}
		if existingUserSetting != nil {
			// Start with existing general setting values.
			generalSetting = existingUserSetting.GetGeneral()
		}

		updatedGeneral := &v1pb.UserSetting_GeneralSetting{
			MemoVisibility: generalSetting.GetMemoVisibility(),
			Locale:         generalSetting.GetLocale(),
			Theme:          generalSetting.GetTheme(),
		}

		incomingGeneral := request.Setting.GetGeneralSetting()
		if incomingGeneral == nil {
			return nil, status.Errorf(codes.InvalidArgument, "general setting is required")
		}
		for _, field := range request.UpdateMask.Paths {
			switch field {
			case "memo_visibility":
				updatedGeneral.MemoVisibility = incomingGeneral.MemoVisibility
			case "theme":
				updatedGeneral.Theme = incomingGeneral.Theme
			case "locale":
				updatedGeneral.Locale = incomingGeneral.Locale
			default:
				// Ignore unsupported fields.
			}
		}

		updatedSetting = &v1pb.UserSetting{
			Name: request.Setting.Name,
			Value: &v1pb.UserSetting_GeneralSetting_{
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

		incomingTags := request.Setting.GetTagsSetting()
		if incomingTags == nil {
			return nil, status.Errorf(codes.InvalidArgument, "tags setting is required")
		}
		if err := validateUserTagsSetting(incomingTags); err != nil {
			return nil, status.Errorf(codes.InvalidArgument, "invalid user tags setting: %v", err)
		}
		updatedSetting = &v1pb.UserSetting{
			Name: request.Setting.Name,
			Value: &v1pb.UserSetting_TagsSetting_{
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

	return s.GetUserSetting(ctx, &v1pb.GetUserSettingRequest{Name: request.Setting.Name})
}

func (s *APIV1Service) ListUserSettings(ctx context.Context, request *v1pb.ListUserSettingsRequest) (*v1pb.ListUserSettingsResponse, error) {
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

	settings := make([]*v1pb.UserSetting, 0, len(userSettings))
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
		defaultGeneral := &v1pb.UserSetting{
			Name: fmt.Sprintf("%s/settings/%s", BuildUserName(user.Username), convertSettingKeyFromStore(storepb.UserSetting_GENERAL)),
			Value: &v1pb.UserSetting_GeneralSetting_{
				GeneralSetting: getDefaultUserGeneralSetting(),
			},
		}
		settings = append([]*v1pb.UserSetting{defaultGeneral}, settings...)
	}
	response := &v1pb.ListUserSettingsResponse{
		Settings:  settings,
		TotalSize: int32(len(settings)),
	}

	return response, nil
}

func (s *APIV1Service) authorizeUserResourceAccess(ctx context.Context, userID int32, allowAdmin bool) (*store.User, error) {
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
