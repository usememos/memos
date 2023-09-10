package v2

import (
	"context"
	"net/http"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/usememos/memos/common/util"
	apiv2pb "github.com/usememos/memos/proto/gen/api/v2"
	"github.com/usememos/memos/store"
	"golang.org/x/crypto/bcrypt"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/timestamppb"
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
		Username: &request.Username,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get user: %v", err)
	}
	if user == nil {
		return nil, status.Errorf(codes.NotFound, "user not found")
	}

	userMessage := convertUserFromStore(user)
	userIDPtr := ctx.Value(UserIDContextKey)
	if userIDPtr != nil {
		userID := userIDPtr.(int32)
		if userID != userMessage.Id {
			// Data desensitization.
			userMessage.OpenId = ""
		}
	}

	response := &apiv2pb.GetUserResponse{
		User: userMessage,
	}
	return response, nil
}

func (s *UserService) UpdateUser(ctx context.Context, request *apiv2pb.UpdateUserRequest) (*apiv2pb.UpdateUserResponse, error) {
	userID := ctx.Value(UserIDContextKey).(int32)
	currentUser, err := s.Store.GetUser(ctx, &store.FindUser{
		ID: &userID,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get user: %v", err)
	}
	if currentUser == nil || (currentUser.ID != userID && currentUser.Role != store.RoleAdmin) {
		return nil, status.Errorf(codes.PermissionDenied, "permission denied")
	}
	if request.UpdateMask == nil || len(request.UpdateMask.Paths) == 0 {
		return nil, status.Errorf(codes.InvalidArgument, "update mask is empty")
	}

	currentTs := time.Now().Unix()
	update := &store.UpdateUser{
		ID:        userID,
		UpdatedTs: &currentTs,
	}
	for _, path := range request.UpdateMask.Paths {
		if path == "username" {
			update.Username = &request.User.Username
		} else if path == "nickname" {
			update.Nickname = &request.User.Nickname
		} else if path == "email" {
			update.Email = &request.User.Email
		} else if path == "avatar_url" {
			update.AvatarURL = &request.User.AvatarUrl
		} else if path == "role" {
			role := convertUserRoleToStore(request.User.Role)
			update.Role = &role
		} else if path == "reset_open_id" {
			openID := util.GenUUID()
			update.OpenID = &openID
		} else if path == "password" {
			passwordHash, err := bcrypt.GenerateFromPassword([]byte(request.User.Password), bcrypt.DefaultCost)
			if err != nil {
				return nil, echo.NewHTTPError(http.StatusInternalServerError, "failed to generate password hash").SetInternal(err)
			}
			passwordHashStr := string(passwordHash)
			update.PasswordHash = &passwordHashStr
		} else if path == "row_status" {
			rowStatus := convertRowStatusToStore(request.User.RowStatus)
			update.RowStatus = &rowStatus
		} else {
			return nil, status.Errorf(codes.InvalidArgument, "invalid update path: %s", path)
		}
	}

	user, err := s.Store.UpdateUser(ctx, update)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to update user: %v", err)
	}

	response := &apiv2pb.UpdateUserResponse{
		User: convertUserFromStore(user),
	}
	return response, nil
}

func convertUserFromStore(user *store.User) *apiv2pb.User {
	return &apiv2pb.User{
		Id:         int32(user.ID),
		RowStatus:  convertRowStatusFromStore(user.RowStatus),
		CreateTime: timestamppb.New(time.Unix(user.CreatedTs, 0)),
		UpdateTime: timestamppb.New(time.Unix(user.UpdatedTs, 0)),
		Username:   user.Username,
		Role:       convertUserRoleFromStore(user.Role),
		Email:      user.Email,
		Nickname:   user.Nickname,
		OpenId:     user.OpenID,
		AvatarUrl:  user.AvatarURL,
	}
}

func convertUserRoleFromStore(role store.Role) apiv2pb.User_Role {
	switch role {
	case store.RoleHost:
		return apiv2pb.User_HOST
	case store.RoleAdmin:
		return apiv2pb.User_ADMIN
	case store.RoleUser:
		return apiv2pb.User_USER
	default:
		return apiv2pb.User_ROLE_UNSPECIFIED
	}
}

func convertUserRoleToStore(role apiv2pb.User_Role) store.Role {
	switch role {
	case apiv2pb.User_HOST:
		return store.RoleHost
	case apiv2pb.User_ADMIN:
		return store.RoleAdmin
	case apiv2pb.User_USER:
		return store.RoleUser
	default:
		return store.RoleUser
	}
}

// ConvertUserSettingFromStore converts a user setting from store to protobuf.
func ConvertUserSettingFromStore(userSetting *store.UserSetting) *apiv2pb.UserSetting {
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
			VisibilityValue: convertVisibilityFromStore(store.Visibility(userSetting.Value)),
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
