package v2

import (
	"context"

	apiv2pb "github.com/usememos/memos/proto/gen/api/v2"
	"github.com/usememos/memos/store"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

type UserService struct {
	apiv2pb.UnimplementedUserServiceServer

	Store *store.Store
}

// NewUserService creates a new UserService.
func NewUserService(store *store.Store) *UserService {
	return &UserService{
		Store: store,
	}
}

func (s *UserService) GetUser(ctx context.Context, request *apiv2pb.GetUserRequest) (*apiv2pb.GetUserResponse, error) {
	user, err := s.Store.GetUser(ctx, &store.FindUser{
		Username: &request.Name,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list tags: %v", err)
	}
	if user == nil {
		return nil, status.Errorf(codes.NotFound, "user not found")
	}

	userMessage := convertUserFromStore(user)
	// Data desensitization.
	userMessage.OpenId = ""

	userUID := int(userMessage.Id)
	userSettings, err := s.Store.ListUserSettings(ctx, &store.FindUserSetting{
		UserID: &userUID,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list user settings: %v", err)
	}
	// TODO: check the access permission for user settings.
	for _, userSetting := range userSettings {
		userMessage.Settings = append(userMessage.Settings, convertUserSettingFromStore(userSetting))
	}

	response := &apiv2pb.GetUserResponse{
		User: userMessage,
	}
	return response, nil
}

func convertUserFromStore(user *store.User) *apiv2pb.User {
	return &apiv2pb.User{
		Id:        int32(user.ID),
		RowStatus: convertRowStatusFromStore(user.RowStatus),
		CreatedTs: user.CreatedTs,
		UpdatedTs: user.UpdatedTs,
		Username:  user.Username,
		Role:      convertUserRoleFromStore(user.Role),
		Email:     user.Email,
		Nickname:  user.Nickname,
		OpenId:    user.OpenID,
		AvatarUrl: user.AvatarURL,
		Settings:  []*apiv2pb.UserSetting{},
	}
}

func convertUserRoleFromStore(role store.Role) apiv2pb.Role {
	switch role {
	case store.RoleHost:
		return apiv2pb.Role_HOST
	case store.RoleAdmin:
		return apiv2pb.Role_ADMIN
	case store.RoleUser:
		return apiv2pb.Role_USER
	default:
		return apiv2pb.Role_ROLE_UNSPECIFIED
	}
}

func convertUserSettingFromStore(userSetting *store.UserSetting) *apiv2pb.UserSetting {
	userSettingKey := apiv2pb.UserSetting_KEY_UNSPECIFIED
	userSettingValue := &apiv2pb.UserSettingValue{}
	switch userSetting.Key {
	case "locale":
		userSettingKey = apiv2pb.UserSetting_LOCALE
		userSettingValue.Value = &apiv2pb.UserSettingValue_StringValue{
			StringValue: userSetting.Value,
		}
	case "appearance":
		userSettingKey = apiv2pb.UserSetting_APPEARANCE
		userSettingValue.Value = &apiv2pb.UserSettingValue_StringValue{
			StringValue: userSetting.Value,
		}
	case "memo-visibility":
		userSettingKey = apiv2pb.UserSetting_MEMO_VISIBILITY
		userSettingValue.Value = &apiv2pb.UserSettingValue_VisibilityValue{
			VisibilityValue: convertVisibilityFromString(userSetting.Value),
		}
	case "telegram-user-id":
		userSettingKey = apiv2pb.UserSetting_TELEGRAM_USER_ID
		userSettingValue.Value = &apiv2pb.UserSettingValue_StringValue{
			StringValue: userSetting.Value,
		}
	}
	return &apiv2pb.UserSetting{
		UserId: int32(userSetting.UserID),
		Key:    userSettingKey,
		Value:  userSettingValue,
	}
}

func convertVisibilityFromString(visibility string) apiv2pb.Visibility {
	switch visibility {
	case "public":
		return apiv2pb.Visibility_PUBLIC
	case "private":
		return apiv2pb.Visibility_PRIVATE
	default:
		return apiv2pb.Visibility_VISIBILITY_UNSPECIFIED
	}
}
