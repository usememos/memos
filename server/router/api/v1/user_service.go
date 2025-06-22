package v1

import (
	"context"
	"crypto/md5"
	"encoding/base64"
	"fmt"
	"net/http"
	"regexp"
	"slices"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/labstack/echo/v4"
	"github.com/pkg/errors"
	"golang.org/x/crypto/bcrypt"
	"google.golang.org/genproto/googleapis/api/httpbody"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/emptypb"
	"google.golang.org/protobuf/types/known/timestamppb"

	"github.com/usememos/memos/internal/base"
	v1pb "github.com/usememos/memos/proto/gen/api/v1"
	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
)

func (s *APIV1Service) ListUsers(ctx context.Context, _ *v1pb.ListUsersRequest) (*v1pb.ListUsersResponse, error) {
	currentUser, err := s.GetCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get user: %v", err)
	}
	if currentUser.Role != store.RoleHost && currentUser.Role != store.RoleAdmin {
		return nil, status.Errorf(codes.PermissionDenied, "permission denied")
	}

	users, err := s.Store.ListUsers(ctx, &store.FindUser{})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list users: %v", err)
	}

	// TODO: Implement proper filtering, ordering, and pagination
	// For now, return all users with basic structure
	response := &v1pb.ListUsersResponse{
		Users:     []*v1pb.User{},
		TotalSize: int32(len(users)),
	}
	for _, user := range users {
		response.Users = append(response.Users, convertUserFromStore(user))
	}
	return response, nil
}

func (s *APIV1Service) GetUser(ctx context.Context, request *v1pb.GetUserRequest) (*v1pb.User, error) {
	userID, err := ExtractUserIDFromName(request.Name)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid user name: %v", err)
	}
	user, err := s.Store.GetUser(ctx, &store.FindUser{
		ID: &userID,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get user: %v", err)
	}
	if user == nil {
		return nil, status.Errorf(codes.NotFound, "user not found")
	}
	userPb := convertUserFromStore(user)

	// TODO: Implement read_mask field filtering
	// For now, return all fields

	return userPb, nil
}

func (s *APIV1Service) SearchUsers(ctx context.Context, request *v1pb.SearchUsersRequest) (*v1pb.SearchUsersResponse, error) {
	currentUser, err := s.GetCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get user: %v", err)
	}
	if currentUser.Role != store.RoleHost && currentUser.Role != store.RoleAdmin {
		return nil, status.Errorf(codes.PermissionDenied, "permission denied")
	}

	// Search users by username, email, or display name
	users, err := s.Store.ListUsers(ctx, &store.FindUser{})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list users: %v", err)
	}

	var filteredUsers []*store.User
	query := strings.ToLower(request.Query)
	for _, user := range users {
		if strings.Contains(strings.ToLower(user.Username), query) ||
			strings.Contains(strings.ToLower(user.Email), query) ||
			strings.Contains(strings.ToLower(user.Nickname), query) {
			filteredUsers = append(filteredUsers, user)
		}
	}

	response := &v1pb.SearchUsersResponse{
		Users:     []*v1pb.User{},
		TotalSize: int32(len(filteredUsers)),
	}
	for _, user := range filteredUsers {
		response.Users = append(response.Users, convertUserFromStore(user))
	}
	return response, nil
}

func (s *APIV1Service) GetUserAvatar(ctx context.Context, request *v1pb.GetUserAvatarRequest) (*httpbody.HttpBody, error) {
	userID, err := ExtractUserIDFromName(request.Name)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid user name: %v", err)
	}
	user, err := s.Store.GetUser(ctx, &store.FindUser{
		ID: &userID,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get user: %v", err)
	}
	if user == nil {
		return nil, status.Errorf(codes.NotFound, "user not found")
	}
	if user.AvatarURL == "" {
		return nil, status.Errorf(codes.NotFound, "avatar not found")
	}

	imageType, base64Data, err := extractImageInfo(user.AvatarURL)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to extract image info: %v", err)
	}
	imageData, err := base64.StdEncoding.DecodeString(base64Data)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to decode string: %v", err)
	}
	httpBody := &httpbody.HttpBody{
		ContentType: imageType,
		Data:        imageData,
	}
	return httpBody, nil
}

func (s *APIV1Service) CreateUser(ctx context.Context, request *v1pb.CreateUserRequest) (*v1pb.User, error) {
	currentUser, err := s.GetCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get user: %v", err)
	}
	if currentUser.Role != store.RoleHost {
		return nil, status.Errorf(codes.PermissionDenied, "permission denied")
	}
	// TODO: Handle request_id for idempotency
	// TODO: Handle user_id field if provided

	if !base.UIDMatcher.MatchString(strings.ToLower(request.User.Username)) {
		return nil, status.Errorf(codes.InvalidArgument, "invalid username: %s", request.User.Username)
	}

	// If validate_only is true, just validate without creating
	if request.ValidateOnly {
		// Perform validation checks without actually creating the user
		return &v1pb.User{
			Username:    request.User.Username,
			Email:       request.User.Email,
			DisplayName: request.User.DisplayName,
			Role:        request.User.Role,
		}, nil
	}

	passwordHash, err := bcrypt.GenerateFromPassword([]byte(request.User.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, echo.NewHTTPError(http.StatusInternalServerError, "failed to generate password hash").SetInternal(err)
	}

	user, err := s.Store.CreateUser(ctx, &store.User{
		Username:     request.User.Username,
		Role:         convertUserRoleToStore(request.User.Role),
		Email:        request.User.Email,
		Nickname:     request.User.DisplayName,
		PasswordHash: string(passwordHash),
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to create user: %v", err)
	}

	return convertUserFromStore(user), nil
}

func (s *APIV1Service) UpdateUser(ctx context.Context, request *v1pb.UpdateUserRequest) (*v1pb.User, error) {
	if request.UpdateMask == nil || len(request.UpdateMask.Paths) == 0 {
		return nil, status.Errorf(codes.InvalidArgument, "update mask is empty")
	}
	userID, err := ExtractUserIDFromName(request.User.Name)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid user name: %v", err)
	}
	currentUser, err := s.GetCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get user: %v", err)
	}
	// Check permission.
	// Only allow admin or self to update user.
	if currentUser.ID != userID && currentUser.Role != store.RoleAdmin && currentUser.Role != store.RoleHost {
		return nil, status.Errorf(codes.PermissionDenied, "permission denied")
	}

	user, err := s.Store.GetUser(ctx, &store.FindUser{ID: &userID})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get user: %v", err)
	}
	if user == nil {
		// Handle allow_missing field
		if request.AllowMissing {
			// Could create user if missing, but for now return not found
			return nil, status.Errorf(codes.NotFound, "user not found")
		}
		return nil, status.Errorf(codes.NotFound, "user not found")
	}

	currentTs := time.Now().Unix()
	update := &store.UpdateUser{
		ID:        user.ID,
		UpdatedTs: &currentTs,
	}
	workspaceGeneralSetting, err := s.Store.GetWorkspaceGeneralSetting(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get workspace general setting: %v", err)
	}
	for _, field := range request.UpdateMask.Paths {
		if field == "username" {
			if workspaceGeneralSetting.DisallowChangeUsername {
				return nil, status.Errorf(codes.PermissionDenied, "permission denied: disallow change username")
			}
			if !base.UIDMatcher.MatchString(strings.ToLower(request.User.Username)) {
				return nil, status.Errorf(codes.InvalidArgument, "invalid username: %s", request.User.Username)
			}
			update.Username = &request.User.Username
		} else if field == "display_name" {
			if workspaceGeneralSetting.DisallowChangeNickname {
				return nil, status.Errorf(codes.PermissionDenied, "permission denied: disallow change nickname")
			}
			update.Nickname = &request.User.DisplayName
		} else if field == "email" {
			update.Email = &request.User.Email
		} else if field == "avatar_url" {
			update.AvatarURL = &request.User.AvatarUrl
		} else if field == "description" {
			update.Description = &request.User.Description
		} else if field == "role" {
			// Only allow admin to update role.
			if currentUser.Role != store.RoleAdmin && currentUser.Role != store.RoleHost {
				return nil, status.Errorf(codes.PermissionDenied, "permission denied")
			}
			role := convertUserRoleToStore(request.User.Role)
			update.Role = &role
		} else if field == "password" {
			passwordHash, err := bcrypt.GenerateFromPassword([]byte(request.User.Password), bcrypt.DefaultCost)
			if err != nil {
				return nil, echo.NewHTTPError(http.StatusInternalServerError, "failed to generate password hash").SetInternal(err)
			}
			passwordHashStr := string(passwordHash)
			update.PasswordHash = &passwordHashStr
		} else if field == "state" {
			rowStatus := convertStateToStore(request.User.State)
			update.RowStatus = &rowStatus
		} else {
			return nil, status.Errorf(codes.InvalidArgument, "invalid update path: %s", field)
		}
	}

	updatedUser, err := s.Store.UpdateUser(ctx, update)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to update user: %v", err)
	}

	return convertUserFromStore(updatedUser), nil
}

func (s *APIV1Service) DeleteUser(ctx context.Context, request *v1pb.DeleteUserRequest) (*emptypb.Empty, error) {
	userID, err := ExtractUserIDFromName(request.Name)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid user name: %v", err)
	}
	currentUser, err := s.GetCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get user: %v", err)
	}
	if currentUser.ID != userID && currentUser.Role != store.RoleAdmin && currentUser.Role != store.RoleHost {
		return nil, status.Errorf(codes.PermissionDenied, "permission denied")
	}

	user, err := s.Store.GetUser(ctx, &store.FindUser{ID: &userID})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get user: %v", err)
	}
	if user == nil {
		return nil, status.Errorf(codes.NotFound, "user not found")
	}

	if err := s.Store.DeleteUser(ctx, &store.DeleteUser{
		ID: user.ID,
	}); err != nil {
		return nil, status.Errorf(codes.Internal, "failed to delete user: %v", err)
	}

	return &emptypb.Empty{}, nil
}

func getDefaultUserSetting() *v1pb.UserSetting {
	return &v1pb.UserSetting{
		Name:           "", // Will be set by caller
		Locale:         "en",
		Appearance:     "system",
		MemoVisibility: "PRIVATE",
	}
}

func (s *APIV1Service) GetUserSetting(ctx context.Context, request *v1pb.GetUserSettingRequest) (*v1pb.UserSetting, error) {
	userID, err := ExtractUserIDFromName(request.Name)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid user name: %v", err)
	}

	currentUser, err := s.GetCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get current user: %v", err)
	}

	// Only allow user to get their own settings
	if currentUser.ID != userID {
		return nil, status.Errorf(codes.PermissionDenied, "permission denied")
	}

	userSettings, err := s.Store.ListUserSettings(ctx, &store.FindUserSetting{
		UserID: &userID,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list user settings: %v", err)
	}

	userSettingMessage := getDefaultUserSetting()
	userSettingMessage.Name = fmt.Sprintf("users/%d", userID)

	for _, setting := range userSettings {
		if setting.Key == storepb.UserSettingKey_LOCALE {
			userSettingMessage.Locale = setting.GetLocale()
		} else if setting.Key == storepb.UserSettingKey_APPEARANCE {
			userSettingMessage.Appearance = setting.GetAppearance()
		} else if setting.Key == storepb.UserSettingKey_MEMO_VISIBILITY {
			userSettingMessage.MemoVisibility = setting.GetMemoVisibility()
		}
	}
	return userSettingMessage, nil
}

func (s *APIV1Service) UpdateUserSetting(ctx context.Context, request *v1pb.UpdateUserSettingRequest) (*v1pb.UserSetting, error) {
	// Extract user ID from the setting resource name
	userID, err := ExtractUserIDFromName(request.Setting.Name)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid user name: %v", err)
	}

	currentUser, err := s.GetCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get current user: %v", err)
	}

	// Only allow user to update their own settings
	if currentUser.ID != userID {
		return nil, status.Errorf(codes.PermissionDenied, "permission denied")
	}

	if request.UpdateMask == nil || len(request.UpdateMask.Paths) == 0 {
		return nil, status.Errorf(codes.InvalidArgument, "update mask is empty")
	}

	for _, field := range request.UpdateMask.Paths {
		if field == "locale" {
			if _, err := s.Store.UpsertUserSetting(ctx, &storepb.UserSetting{
				UserId: userID,
				Key:    storepb.UserSettingKey_LOCALE,
				Value: &storepb.UserSetting_Locale{
					Locale: request.Setting.Locale,
				},
			}); err != nil {
				return nil, status.Errorf(codes.Internal, "failed to upsert user setting: %v", err)
			}
		} else if field == "appearance" {
			if _, err := s.Store.UpsertUserSetting(ctx, &storepb.UserSetting{
				UserId: userID,
				Key:    storepb.UserSettingKey_APPEARANCE,
				Value: &storepb.UserSetting_Appearance{
					Appearance: request.Setting.Appearance,
				},
			}); err != nil {
				return nil, status.Errorf(codes.Internal, "failed to upsert user setting: %v", err)
			}
		} else if field == "memo_visibility" {
			if _, err := s.Store.UpsertUserSetting(ctx, &storepb.UserSetting{
				UserId: userID,
				Key:    storepb.UserSettingKey_MEMO_VISIBILITY,
				Value: &storepb.UserSetting_MemoVisibility{
					MemoVisibility: request.Setting.MemoVisibility,
				},
			}); err != nil {
				return nil, status.Errorf(codes.Internal, "failed to upsert user setting: %v", err)
			}
		} else {
			return nil, status.Errorf(codes.InvalidArgument, "invalid update path: %s", field)
		}
	}

	return s.GetUserSetting(ctx, &v1pb.GetUserSettingRequest{Name: request.Setting.Name})
}

func (s *APIV1Service) ListUserAccessTokens(ctx context.Context, request *v1pb.ListUserAccessTokensRequest) (*v1pb.ListUserAccessTokensResponse, error) {
	userID, err := ExtractUserIDFromName(request.Parent)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid user name: %v", err)
	}

	currentUser, err := s.GetCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get current user: %v", err)
	}
	if currentUser == nil {
		return nil, status.Errorf(codes.PermissionDenied, "permission denied")
	}
	if currentUser.ID != userID {
		return nil, status.Errorf(codes.PermissionDenied, "permission denied")
	}

	userAccessTokens, err := s.Store.GetUserAccessTokens(ctx, userID)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list access tokens: %v", err)
	}

	accessTokens := []*v1pb.UserAccessToken{}
	for _, userAccessToken := range userAccessTokens {
		claims := &ClaimsMessage{}
		_, err := jwt.ParseWithClaims(userAccessToken.AccessToken, claims, func(t *jwt.Token) (any, error) {
			if t.Method.Alg() != jwt.SigningMethodHS256.Name {
				return nil, errors.Errorf("unexpected access token signing method=%v, expect %v", t.Header["alg"], jwt.SigningMethodHS256)
			}
			if kid, ok := t.Header["kid"].(string); ok {
				if kid == "v1" {
					return []byte(s.Secret), nil
				}
			}
			return nil, errors.Errorf("unexpected access token kid=%v", t.Header["kid"])
		})
		if err != nil {
			// If the access token is invalid or expired, just ignore it.
			continue
		}

		accessTokenResponse := &v1pb.UserAccessToken{
			Name:        fmt.Sprintf("users/%d/accessTokens/%s", userID, userAccessToken.AccessToken),
			AccessToken: userAccessToken.AccessToken,
			Description: userAccessToken.Description,
			IssuedAt:    timestamppb.New(claims.IssuedAt.Time),
		}
		if claims.ExpiresAt != nil {
			accessTokenResponse.ExpiresAt = timestamppb.New(claims.ExpiresAt.Time)
		}
		accessTokens = append(accessTokens, accessTokenResponse)
	}

	// Sort by issued time in descending order.
	slices.SortFunc(accessTokens, func(i, j *v1pb.UserAccessToken) int {
		return int(i.IssuedAt.Seconds - j.IssuedAt.Seconds)
	})
	response := &v1pb.ListUserAccessTokensResponse{
		AccessTokens: accessTokens,
	}
	return response, nil
}

func (s *APIV1Service) CreateUserAccessToken(ctx context.Context, request *v1pb.CreateUserAccessTokenRequest) (*v1pb.UserAccessToken, error) {
	userID, err := ExtractUserIDFromName(request.Parent)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid user name: %v", err)
	}
	currentUser, err := s.GetCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get current user: %v", err)
	}
	if currentUser == nil {
		return nil, status.Errorf(codes.PermissionDenied, "permission denied")
	}
	if currentUser.ID != userID {
		return nil, status.Errorf(codes.PermissionDenied, "permission denied")
	}

	expiresAt := time.Time{}
	if request.AccessToken.ExpiresAt != nil {
		expiresAt = request.AccessToken.ExpiresAt.AsTime()
	}

	accessToken, err := GenerateAccessToken(currentUser.Username, currentUser.ID, expiresAt, []byte(s.Secret))
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to generate access token: %v", err)
	}

	claims := &ClaimsMessage{}
	_, err = jwt.ParseWithClaims(accessToken, claims, func(t *jwt.Token) (any, error) {
		if t.Method.Alg() != jwt.SigningMethodHS256.Name {
			return nil, errors.Errorf("unexpected access token signing method=%v, expect %v", t.Header["alg"], jwt.SigningMethodHS256)
		}
		if kid, ok := t.Header["kid"].(string); ok {
			if kid == "v1" {
				return []byte(s.Secret), nil
			}
		}
		return nil, errors.Errorf("unexpected access token kid=%v", t.Header["kid"])
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to parse access token: %v", err)
	}

	// Upsert the access token to user setting store.
	if err := s.UpsertAccessTokenToStore(ctx, currentUser, accessToken, request.AccessToken.Description); err != nil {
		return nil, status.Errorf(codes.Internal, "failed to upsert access token to store: %v", err)
	}

	userAccessToken := &v1pb.UserAccessToken{
		Name:        fmt.Sprintf("users/%d/accessTokens/%s", userID, accessToken),
		AccessToken: accessToken,
		Description: request.AccessToken.Description,
		IssuedAt:    timestamppb.New(claims.IssuedAt.Time),
	}
	if claims.ExpiresAt != nil {
		userAccessToken.ExpiresAt = timestamppb.New(claims.ExpiresAt.Time)
	}
	return userAccessToken, nil
}

func (s *APIV1Service) DeleteUserAccessToken(ctx context.Context, request *v1pb.DeleteUserAccessTokenRequest) (*emptypb.Empty, error) {
	// Extract user ID from the access token resource name
	// Format: users/{user}/accessTokens/{access_token}
	parts := strings.Split(request.Name, "/")
	if len(parts) != 4 || parts[0] != "users" || parts[2] != "accessTokens" {
		return nil, status.Errorf(codes.InvalidArgument, "invalid access token name format: %s", request.Name)
	}

	userID, err := ExtractUserIDFromName(fmt.Sprintf("users/%s", parts[1]))
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid user name: %v", err)
	}
	accessTokenToDelete := parts[3]

	currentUser, err := s.GetCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get current user: %v", err)
	}
	if currentUser == nil {
		return nil, status.Errorf(codes.PermissionDenied, "permission denied")
	}
	if currentUser.ID != userID {
		return nil, status.Errorf(codes.PermissionDenied, "permission denied")
	}

	userAccessTokens, err := s.Store.GetUserAccessTokens(ctx, currentUser.ID)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list access tokens: %v", err)
	}
	updatedUserAccessTokens := []*storepb.AccessTokensUserSetting_AccessToken{}
	for _, userAccessToken := range userAccessTokens {
		if userAccessToken.AccessToken == accessTokenToDelete {
			continue
		}
		updatedUserAccessTokens = append(updatedUserAccessTokens, userAccessToken)
	}
	if _, err := s.Store.UpsertUserSetting(ctx, &storepb.UserSetting{
		UserId: currentUser.ID,
		Key:    storepb.UserSettingKey_ACCESS_TOKENS,
		Value: &storepb.UserSetting_AccessTokens{
			AccessTokens: &storepb.AccessTokensUserSetting{
				AccessTokens: updatedUserAccessTokens,
			},
		},
	}); err != nil {
		return nil, status.Errorf(codes.Internal, "failed to upsert user setting: %v", err)
	}

	return &emptypb.Empty{}, nil
}

func (s *APIV1Service) ListUserSessions(ctx context.Context, request *v1pb.ListUserSessionsRequest) (*v1pb.ListUserSessionsResponse, error) {
	userID, err := ExtractUserIDFromName(request.Parent)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid user name: %v", err)
	}

	currentUser, err := s.GetCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get current user: %v", err)
	}
	if currentUser == nil {
		return nil, status.Errorf(codes.PermissionDenied, "permission denied")
	}
	if currentUser.ID != userID {
		return nil, status.Errorf(codes.PermissionDenied, "permission denied")
	}

	userSessions, err := s.Store.GetUserSessions(ctx, userID)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list sessions: %v", err)
	}

	sessions := []*v1pb.UserSession{}
	for _, userSession := range userSessions {
		sessionResponse := &v1pb.UserSession{
			Name:             fmt.Sprintf("users/%d/sessions/%s", userID, userSession.SessionId),
			SessionId:        userSession.SessionId,
			CreateTime:       userSession.CreateTime,
			ExpireTime:       userSession.ExpireTime,
			LastAccessedTime: userSession.LastAccessedTime,
		}

		if userSession.ClientInfo != nil {
			sessionResponse.ClientInfo = &v1pb.UserSession_ClientInfo{
				UserAgent:  userSession.ClientInfo.UserAgent,
				IpAddress:  userSession.ClientInfo.IpAddress,
				DeviceType: userSession.ClientInfo.DeviceType,
				Os:         userSession.ClientInfo.Os,
				Browser:    userSession.ClientInfo.Browser,
				Country:    userSession.ClientInfo.Country,
			}
		}

		sessions = append(sessions, sessionResponse)
	}

	// Sort by last accessed time in descending order.
	slices.SortFunc(sessions, func(i, j *v1pb.UserSession) int {
		return int(j.LastAccessedTime.Seconds - i.LastAccessedTime.Seconds)
	})

	response := &v1pb.ListUserSessionsResponse{
		Sessions: sessions,
	}
	return response, nil
}

func (s *APIV1Service) RevokeUserSession(ctx context.Context, request *v1pb.RevokeUserSessionRequest) (*emptypb.Empty, error) {
	// Extract user ID and session ID from the session resource name
	// Format: users/{user}/sessions/{session}
	parts := strings.Split(request.Name, "/")
	if len(parts) != 4 || parts[0] != "users" || parts[2] != "sessions" {
		return nil, status.Errorf(codes.InvalidArgument, "invalid session name format: %s", request.Name)
	}

	userID, err := ExtractUserIDFromName(fmt.Sprintf("users/%s", parts[1]))
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid user name: %v", err)
	}
	sessionIDToRevoke := parts[3]

	currentUser, err := s.GetCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get current user: %v", err)
	}
	if currentUser == nil {
		return nil, status.Errorf(codes.PermissionDenied, "permission denied")
	}
	if currentUser.ID != userID {
		return nil, status.Errorf(codes.PermissionDenied, "permission denied")
	}

	if err := s.Store.RemoveUserSession(ctx, userID, sessionIDToRevoke); err != nil {
		return nil, status.Errorf(codes.Internal, "failed to revoke session: %v", err)
	}

	return &emptypb.Empty{}, nil
}

// UpsertUserSession adds or updates a user session.
func (s *APIV1Service) UpsertUserSession(ctx context.Context, userID int32, sessionID string, clientInfo *storepb.SessionsUserSetting_ClientInfo) error {
	session := &storepb.SessionsUserSetting_Session{
		SessionId:        sessionID,
		CreateTime:       timestamppb.Now(),
		ExpireTime:       timestamppb.New(time.Now().Add(30 * 24 * time.Hour)), // 30 days default
		LastAccessedTime: timestamppb.Now(),
		ClientInfo:       clientInfo,
	}

	return s.Store.AddUserSession(ctx, userID, session)
}

func (s *APIV1Service) UpsertAccessTokenToStore(ctx context.Context, user *store.User, accessToken, description string) error {
	userAccessTokens, err := s.Store.GetUserAccessTokens(ctx, user.ID)
	if err != nil {
		return errors.Wrap(err, "failed to get user access tokens")
	}
	userAccessToken := storepb.AccessTokensUserSetting_AccessToken{
		AccessToken: accessToken,
		Description: description,
	}
	userAccessTokens = append(userAccessTokens, &userAccessToken)

	if _, err := s.Store.UpsertUserSetting(ctx, &storepb.UserSetting{
		UserId: user.ID,
		Key:    storepb.UserSettingKey_ACCESS_TOKENS,
		Value: &storepb.UserSetting_AccessTokens{
			AccessTokens: &storepb.AccessTokensUserSetting{
				AccessTokens: userAccessTokens,
			},
		},
	}); err != nil {
		return errors.Wrap(err, "failed to upsert user setting")
	}
	return nil
}

func convertUserFromStore(user *store.User) *v1pb.User {
	// Generate etag based on user data
	etagData := fmt.Sprintf("%d-%d-%s-%s-%s", user.ID, user.UpdatedTs, user.Username, user.Email, user.Nickname)
	hash := md5.Sum([]byte(etagData))
	etag := fmt.Sprintf("%x", hash)

	userpb := &v1pb.User{
		Name:        fmt.Sprintf("%s%d", UserNamePrefix, user.ID),
		State:       convertStateFromStore(user.RowStatus),
		CreateTime:  timestamppb.New(time.Unix(user.CreatedTs, 0)),
		UpdateTime:  timestamppb.New(time.Unix(user.UpdatedTs, 0)),
		Role:        convertUserRoleFromStore(user.Role),
		Username:    user.Username,
		Email:       user.Email,
		DisplayName: user.Nickname,
		AvatarUrl:   user.AvatarURL,
		Description: user.Description,
		Etag:        etag,
	}
	// Use the avatar URL instead of raw base64 image data to reduce the response size.
	if user.AvatarURL != "" {
		// Check if avatar url is base64 format.
		_, _, err := extractImageInfo(user.AvatarURL)
		if err == nil {
			userpb.AvatarUrl = fmt.Sprintf("/file/%s/avatar", userpb.Name)
		} else {
			userpb.AvatarUrl = user.AvatarURL
		}
	}
	return userpb
}

func convertUserRoleFromStore(role store.Role) v1pb.User_Role {
	switch role {
	case store.RoleHost:
		return v1pb.User_HOST
	case store.RoleAdmin:
		return v1pb.User_ADMIN
	case store.RoleUser:
		return v1pb.User_USER
	default:
		return v1pb.User_ROLE_UNSPECIFIED
	}
}

func convertUserRoleToStore(role v1pb.User_Role) store.Role {
	switch role {
	case v1pb.User_HOST:
		return store.RoleHost
	case v1pb.User_ADMIN:
		return store.RoleAdmin
	case v1pb.User_USER:
		return store.RoleUser
	default:
		return store.RoleUser
	}
}

func extractImageInfo(dataURI string) (string, string, error) {
	dataURIRegex := regexp.MustCompile(`^data:(?P<type>.+);base64,(?P<base64>.+)`)
	matches := dataURIRegex.FindStringSubmatch(dataURI)
	if len(matches) != 3 {
		return "", "", errors.New("Invalid data URI format")
	}
	imageType := matches[1]
	base64Data := matches[2]
	return imageType, base64Data, nil
}
