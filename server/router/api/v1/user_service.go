package v1

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"net/http"
	"regexp"
	"slices"
	"strconv"
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
	"github.com/usememos/memos/internal/util"
	"github.com/usememos/memos/plugin/filter"
	v1pb "github.com/usememos/memos/proto/gen/api/v1"
	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
)

func (s *APIV1Service) ListUsers(ctx context.Context, request *v1pb.ListUsersRequest) (*v1pb.ListUsersResponse, error) {
	currentUser, err := s.GetCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get user: %v", err)
	}
	if currentUser.Role != store.RoleHost && currentUser.Role != store.RoleAdmin {
		return nil, status.Errorf(codes.PermissionDenied, "permission denied")
	}

	userFind := &store.FindUser{}

	if request.Filter != "" {
		if err := s.validateUserFilter(ctx, request.Filter); err != nil {
			return nil, status.Errorf(codes.InvalidArgument, "invalid filter: %v", err)
		}
		userFind.Filters = append(userFind.Filters, request.Filter)
	}

	users, err := s.Store.ListUsers(ctx, userFind)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list users: %v", err)
	}

	// TODO: Implement proper ordering, and pagination
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
	return convertUserFromStore(user), nil
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
	// Check if there are any existing host users (for first-time setup detection)
	hostUserType := store.RoleHost
	existedHostUsers, err := s.Store.ListUsers(ctx, &store.FindUser{
		Role: &hostUserType,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list host users: %v", err)
	}

	// Determine the role to assign and check permissions
	var roleToAssign store.Role
	if len(existedHostUsers) == 0 {
		// First-time setup: create the first user as HOST (no authentication required)
		roleToAssign = store.RoleHost
	} else {
		// Regular user creation: allow unauthenticated creation of normal users
		// But if authenticated, check if user has HOST permission for any role
		currentUser, err := s.GetCurrentUser(ctx)
		if err == nil && currentUser != nil && currentUser.Role == store.RoleHost {
			// Authenticated HOST user can create users with any role specified in request
			if request.User.Role != v1pb.User_ROLE_UNSPECIFIED {
				roleToAssign = convertUserRoleToStore(request.User.Role)
			} else {
				roleToAssign = store.RoleUser
			}
		} else {
			// Unauthenticated or non-HOST users can only create normal users
			roleToAssign = store.RoleUser
		}
	}

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
			Role:        convertUserRoleFromStore(roleToAssign),
		}, nil
	}

	passwordHash, err := bcrypt.GenerateFromPassword([]byte(request.User.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, echo.NewHTTPError(http.StatusInternalServerError, "failed to generate password hash").SetInternal(err)
	}

	user, err := s.Store.CreateUser(ctx, &store.User{
		Username:     request.User.Username,
		Role:         roleToAssign,
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
		switch field {
		case "username":
			if workspaceGeneralSetting.DisallowChangeUsername {
				return nil, status.Errorf(codes.PermissionDenied, "permission denied: disallow change username")
			}
			if !base.UIDMatcher.MatchString(strings.ToLower(request.User.Username)) {
				return nil, status.Errorf(codes.InvalidArgument, "invalid username: %s", request.User.Username)
			}
			update.Username = &request.User.Username
		case "display_name":
			if workspaceGeneralSetting.DisallowChangeNickname {
				return nil, status.Errorf(codes.PermissionDenied, "permission denied: disallow change nickname")
			}
			update.Nickname = &request.User.DisplayName
		case "email":
			update.Email = &request.User.Email
		case "avatar_url":
			update.AvatarURL = &request.User.AvatarUrl
		case "description":
			update.Description = &request.User.Description
		case "role":
			// Only allow admin to update role.
			if currentUser.Role != store.RoleAdmin && currentUser.Role != store.RoleHost {
				return nil, status.Errorf(codes.PermissionDenied, "permission denied")
			}
			role := convertUserRoleToStore(request.User.Role)
			update.Role = &role
		case "password":
			passwordHash, err := bcrypt.GenerateFromPassword([]byte(request.User.Password), bcrypt.DefaultCost)
			if err != nil {
				return nil, echo.NewHTTPError(http.StatusInternalServerError, "failed to generate password hash").SetInternal(err)
			}
			passwordHashStr := string(passwordHash)
			update.PasswordHash = &passwordHashStr
		case "state":
			rowStatus := convertStateToStore(request.User.State)
			update.RowStatus = &rowStatus
		default:
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

func getDefaultUserGeneralSetting() *v1pb.UserSetting_GeneralSetting {
	return &v1pb.UserSetting_GeneralSetting{
		Locale:         "en",
		MemoVisibility: "PRIVATE",
		Theme:          "",
	}
}

func (s *APIV1Service) GetUserSetting(ctx context.Context, request *v1pb.GetUserSettingRequest) (*v1pb.UserSetting, error) {
	// Parse resource name: users/{user}/settings/{setting}
	userID, settingKey, err := ExtractUserIDAndSettingKeyFromName(request.Name)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid resource name: %v", err)
	}

	currentUser, err := s.GetCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get current user: %v", err)
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

	return convertUserSettingFromStore(userSetting, userID, storeKey), nil
}

func (s *APIV1Service) UpdateUserSetting(ctx context.Context, request *v1pb.UpdateUserSettingRequest) (*v1pb.UserSetting, error) {
	// Parse resource name: users/{user}/settings/{setting}
	userID, settingKey, err := ExtractUserIDAndSettingKeyFromName(request.Setting.Name)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid resource name: %v", err)
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

	// Convert setting key string to store enum
	storeKey, err := convertSettingKeyToStore(settingKey)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid setting key: %v", err)
	}

	// Only GENERAL settings are supported via UpdateUserSetting
	// Other setting types have dedicated service methods
	if storeKey != storepb.UserSetting_GENERAL {
		return nil, status.Errorf(codes.InvalidArgument, "setting type %s should not be updated via UpdateUserSetting", storeKey.String())
	}

	existingUserSetting, _ := s.Store.GetUserSetting(ctx, &store.FindUserSetting{
		UserID: &userID,
		Key:    storeKey,
	})

	generalSetting := &storepb.GeneralUserSetting{}
	if existingUserSetting != nil {
		// Start with existing general setting values
		generalSetting = existingUserSetting.GetGeneral()
	}

	updatedGeneral := &v1pb.UserSetting_GeneralSetting{
		MemoVisibility: generalSetting.GetMemoVisibility(),
		Locale:         generalSetting.GetLocale(),
		Theme:          generalSetting.GetTheme(),
	}

	// Apply updates for fields specified in the update mask
	incomingGeneral := request.Setting.GetGeneralSetting()
	for _, field := range request.UpdateMask.Paths {
		switch field {
		case "memoVisibility":
			updatedGeneral.MemoVisibility = incomingGeneral.MemoVisibility
		case "theme":
			updatedGeneral.Theme = incomingGeneral.Theme
		case "locale":
			updatedGeneral.Locale = incomingGeneral.Locale
		default:
			// Ignore unsupported fields
		}
	}

	// Create the updated setting
	updatedSetting := &v1pb.UserSetting{
		Name: request.Setting.Name,
		Value: &v1pb.UserSetting_GeneralSetting_{
			GeneralSetting: updatedGeneral,
		},
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
	userID, err := ExtractUserIDFromName(request.Parent)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid parent name: %v", err)
	}

	currentUser, err := s.GetCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get current user: %v", err)
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
		apiSetting := convertUserSettingFromStore(storeSetting, userID, storeSetting.Key)
		if apiSetting != nil {
			settings = append(settings, apiSetting)
		}
	}

	// If no general setting exists, add a default one
	hasGeneral := false
	for _, setting := range settings {
		if setting.GetGeneralSetting() != nil {
			hasGeneral = true
			break
		}
	}
	if !hasGeneral {
		defaultGeneral := &v1pb.UserSetting{
			Name: fmt.Sprintf("users/%d/settings/general", userID),
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
		Key:    storepb.UserSetting_ACCESS_TOKENS,
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
			LastAccessedTime: userSession.LastAccessedTime,
		}

		if userSession.ClientInfo != nil {
			sessionResponse.ClientInfo = &v1pb.UserSession_ClientInfo{
				UserAgent:  userSession.ClientInfo.UserAgent,
				IpAddress:  userSession.ClientInfo.IpAddress,
				DeviceType: userSession.ClientInfo.DeviceType,
				Os:         userSession.ClientInfo.Os,
				Browser:    userSession.ClientInfo.Browser,
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
		Key:    storepb.UserSetting_ACCESS_TOKENS,
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

func (s *APIV1Service) ListUserWebhooks(ctx context.Context, request *v1pb.ListUserWebhooksRequest) (*v1pb.ListUserWebhooksResponse, error) {
	userID, err := ExtractUserIDFromName(request.Parent)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid parent: %v", err)
	}

	currentUser, err := s.GetCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get current user: %v", err)
	}
	if currentUser.ID != userID && currentUser.Role != store.RoleHost && currentUser.Role != store.RoleAdmin {
		return nil, status.Errorf(codes.PermissionDenied, "permission denied")
	}

	webhooks, err := s.Store.GetUserWebhooks(ctx, userID)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get user webhooks: %v", err)
	}

	userWebhooks := make([]*v1pb.UserWebhook, 0, len(webhooks))
	for _, webhook := range webhooks {
		userWebhooks = append(userWebhooks, convertUserWebhookFromUserSetting(webhook, userID))
	}

	return &v1pb.ListUserWebhooksResponse{
		Webhooks: userWebhooks,
	}, nil
}

func (s *APIV1Service) CreateUserWebhook(ctx context.Context, request *v1pb.CreateUserWebhookRequest) (*v1pb.UserWebhook, error) {
	userID, err := ExtractUserIDFromName(request.Parent)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid parent: %v", err)
	}

	currentUser, err := s.GetCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get current user: %v", err)
	}
	if currentUser.ID != userID && currentUser.Role != store.RoleHost && currentUser.Role != store.RoleAdmin {
		return nil, status.Errorf(codes.PermissionDenied, "permission denied")
	}

	if request.Webhook.Url == "" {
		return nil, status.Errorf(codes.InvalidArgument, "webhook URL is required")
	}

	webhookID := generateUserWebhookID()
	webhook := &storepb.WebhooksUserSetting_Webhook{
		Id:    webhookID,
		Title: request.Webhook.DisplayName,
		Url:   strings.TrimSpace(request.Webhook.Url),
	}

	err = s.Store.AddUserWebhook(ctx, userID, webhook)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to create webhook: %v", err)
	}

	return convertUserWebhookFromUserSetting(webhook, userID), nil
}

func (s *APIV1Service) UpdateUserWebhook(ctx context.Context, request *v1pb.UpdateUserWebhookRequest) (*v1pb.UserWebhook, error) {
	if request.Webhook == nil {
		return nil, status.Errorf(codes.InvalidArgument, "webhook is required")
	}

	webhookID, userID, err := parseUserWebhookName(request.Webhook.Name)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid webhook name: %v", err)
	}

	currentUser, err := s.GetCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get current user: %v", err)
	}
	if currentUser.ID != userID && currentUser.Role != store.RoleHost && currentUser.Role != store.RoleAdmin {
		return nil, status.Errorf(codes.PermissionDenied, "permission denied")
	}

	// Get existing webhooks
	webhooks, err := s.Store.GetUserWebhooks(ctx, userID)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get user webhooks: %v", err)
	}

	// Find the webhook to update
	var targetWebhook *storepb.WebhooksUserSetting_Webhook
	for _, webhook := range webhooks {
		if webhook.Id == webhookID {
			targetWebhook = webhook
			break
		}
	}

	if targetWebhook == nil {
		return nil, status.Errorf(codes.NotFound, "webhook not found")
	}

	// Update the webhook
	updatedWebhook := &storepb.WebhooksUserSetting_Webhook{
		Id:    webhookID,
		Title: targetWebhook.Title,
		Url:   targetWebhook.Url,
	}

	if request.UpdateMask != nil {
		for _, path := range request.UpdateMask.Paths {
			switch path {
			case "url":
				if request.Webhook.Url != "" {
					updatedWebhook.Url = strings.TrimSpace(request.Webhook.Url)
				}
			case "display_name":
				updatedWebhook.Title = request.Webhook.DisplayName
			default:
				// Ignore unsupported fields
			}
		}
	} else {
		// If no update mask is provided, update all fields
		if request.Webhook.Url != "" {
			updatedWebhook.Url = strings.TrimSpace(request.Webhook.Url)
		}
		updatedWebhook.Title = request.Webhook.DisplayName
	}

	err = s.Store.UpdateUserWebhook(ctx, userID, updatedWebhook)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to update webhook: %v", err)
	}

	return convertUserWebhookFromUserSetting(updatedWebhook, userID), nil
}

func (s *APIV1Service) DeleteUserWebhook(ctx context.Context, request *v1pb.DeleteUserWebhookRequest) (*emptypb.Empty, error) {
	webhookID, userID, err := parseUserWebhookName(request.Name)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid webhook name: %v", err)
	}

	currentUser, err := s.GetCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get current user: %v", err)
	}
	if currentUser.ID != userID && currentUser.Role != store.RoleHost && currentUser.Role != store.RoleAdmin {
		return nil, status.Errorf(codes.PermissionDenied, "permission denied")
	}

	// Get existing webhooks to verify the webhook exists
	webhooks, err := s.Store.GetUserWebhooks(ctx, userID)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get user webhooks: %v", err)
	}

	// Check if webhook exists
	found := false
	for _, webhook := range webhooks {
		if webhook.Id == webhookID {
			found = true
			break
		}
	}

	if !found {
		return nil, status.Errorf(codes.NotFound, "webhook not found")
	}

	err = s.Store.RemoveUserWebhook(ctx, userID, webhookID)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to delete webhook: %v", err)
	}

	return &emptypb.Empty{}, nil
}

// Helper functions for webhook operations

// generateUserWebhookID generates a unique ID for user webhooks.
func generateUserWebhookID() string {
	b := make([]byte, 8)
	rand.Read(b)
	return hex.EncodeToString(b)
}

// parseUserWebhookName parses a webhook name and returns the webhook ID and user ID.
// Format: users/{user}/webhooks/{webhook}.
func parseUserWebhookName(name string) (string, int32, error) {
	parts := strings.Split(name, "/")
	if len(parts) != 4 || parts[0] != "users" || parts[2] != "webhooks" {
		return "", 0, errors.New("invalid webhook name format")
	}

	userID, err := strconv.ParseInt(parts[1], 10, 32)
	if err != nil {
		return "", 0, errors.New("invalid user ID in webhook name")
	}

	return parts[3], int32(userID), nil
}

// convertUserWebhookFromUserSetting converts a storepb webhook to a v1pb UserWebhook.
func convertUserWebhookFromUserSetting(webhook *storepb.WebhooksUserSetting_Webhook, userID int32) *v1pb.UserWebhook {
	return &v1pb.UserWebhook{
		Name:        fmt.Sprintf("users/%d/webhooks/%s", userID, webhook.Id),
		Url:         webhook.Url,
		DisplayName: webhook.Title,
		// Note: create_time and update_time are not available in the user setting webhook structure
		// This is a limitation of storing webhooks in user settings vs the dedicated webhook table
	}
}

func convertUserFromStore(user *store.User) *v1pb.User {
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
	}
	// Use the avatar URL instead of raw base64 image data to reduce the response size.
	if user.AvatarURL != "" {
		// Check if avatar url is base64 format.
		_, _, err := extractImageInfo(user.AvatarURL)
		if err == nil {
			userpb.AvatarUrl = fmt.Sprintf("/api/v1/%s/avatar", userpb.Name)
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

// Helper functions for user settings

// ExtractUserIDAndSettingKeyFromName extracts user ID and setting key from resource name.
// e.g., "users/123/settings/general" -> 123, "general".
func ExtractUserIDAndSettingKeyFromName(name string) (int32, string, error) {
	// Expected format: users/{user}/settings/{setting}
	parts := strings.Split(name, "/")
	if len(parts) != 4 || parts[0] != "users" || parts[2] != "settings" {
		return 0, "", errors.Errorf("invalid resource name format: %s", name)
	}

	userID, err := util.ConvertStringToInt32(parts[1])
	if err != nil {
		return 0, "", errors.Errorf("invalid user ID: %s", parts[1])
	}

	settingKey := parts[3]
	return userID, settingKey, nil
}

// convertSettingKeyToStore converts API setting key to store enum.
func convertSettingKeyToStore(key string) (storepb.UserSetting_Key, error) {
	switch key {
	case v1pb.UserSetting_Key_name[int32(v1pb.UserSetting_GENERAL)]:
		return storepb.UserSetting_GENERAL, nil
	case v1pb.UserSetting_Key_name[int32(v1pb.UserSetting_SESSIONS)]:
		return storepb.UserSetting_SESSIONS, nil
	case v1pb.UserSetting_Key_name[int32(v1pb.UserSetting_ACCESS_TOKENS)]:
		return storepb.UserSetting_ACCESS_TOKENS, nil
	case v1pb.UserSetting_Key_name[int32(v1pb.UserSetting_WEBHOOKS)]:
		return storepb.UserSetting_WEBHOOKS, nil
	default:
		return storepb.UserSetting_KEY_UNSPECIFIED, errors.Errorf("unknown setting key: %s", key)
	}
}

// convertSettingKeyFromStore converts store enum to API setting key.
func convertSettingKeyFromStore(key storepb.UserSetting_Key) string {
	switch key {
	case storepb.UserSetting_GENERAL:
		return v1pb.UserSetting_Key_name[int32(v1pb.UserSetting_GENERAL)]
	case storepb.UserSetting_SESSIONS:
		return v1pb.UserSetting_Key_name[int32(v1pb.UserSetting_SESSIONS)]
	case storepb.UserSetting_ACCESS_TOKENS:
		return v1pb.UserSetting_Key_name[int32(v1pb.UserSetting_ACCESS_TOKENS)]
	case storepb.UserSetting_SHORTCUTS:
		return "SHORTCUTS" // Not defined in API proto
	case storepb.UserSetting_WEBHOOKS:
		return v1pb.UserSetting_Key_name[int32(v1pb.UserSetting_WEBHOOKS)]
	default:
		return "unknown"
	}
}

// convertUserSettingFromStore converts store UserSetting to API UserSetting.
func convertUserSettingFromStore(storeSetting *storepb.UserSetting, userID int32, key storepb.UserSetting_Key) *v1pb.UserSetting {
	if storeSetting == nil {
		// Return default setting if none exists
		settingKey := convertSettingKeyFromStore(key)
		setting := &v1pb.UserSetting{
			Name: fmt.Sprintf("users/%d/settings/%s", userID, settingKey),
		}

		switch key {
		case storepb.UserSetting_GENERAL:
			setting.Value = &v1pb.UserSetting_GeneralSetting_{
				GeneralSetting: getDefaultUserGeneralSetting(),
			}
		case storepb.UserSetting_SESSIONS:
			setting.Value = &v1pb.UserSetting_SessionsSetting_{
				SessionsSetting: &v1pb.UserSetting_SessionsSetting{
					Sessions: []*v1pb.UserSession{},
				},
			}
		case storepb.UserSetting_ACCESS_TOKENS:
			setting.Value = &v1pb.UserSetting_AccessTokensSetting_{
				AccessTokensSetting: &v1pb.UserSetting_AccessTokensSetting{
					AccessTokens: []*v1pb.UserAccessToken{},
				},
			}
		case storepb.UserSetting_WEBHOOKS:
			setting.Value = &v1pb.UserSetting_WebhooksSetting_{
				WebhooksSetting: &v1pb.UserSetting_WebhooksSetting{
					Webhooks: []*v1pb.UserWebhook{},
				},
			}
		default:
			// Default to general setting
			setting.Value = &v1pb.UserSetting_GeneralSetting_{
				GeneralSetting: getDefaultUserGeneralSetting(),
			}
		}
		return setting
	}

	settingKey := convertSettingKeyFromStore(storeSetting.Key)
	setting := &v1pb.UserSetting{
		Name: fmt.Sprintf("users/%d/settings/%s", userID, settingKey),
	}

	switch storeSetting.Key {
	case storepb.UserSetting_GENERAL:
		if general := storeSetting.GetGeneral(); general != nil {
			setting.Value = &v1pb.UserSetting_GeneralSetting_{
				GeneralSetting: &v1pb.UserSetting_GeneralSetting{
					Locale:         general.Locale,
					MemoVisibility: general.MemoVisibility,
					Theme:          general.Theme,
				},
			}
		} else {
			setting.Value = &v1pb.UserSetting_GeneralSetting_{
				GeneralSetting: getDefaultUserGeneralSetting(),
			}
		}
	case storepb.UserSetting_SESSIONS:
		sessions := storeSetting.GetSessions()
		apiSessions := make([]*v1pb.UserSession, 0, len(sessions.Sessions))
		for _, session := range sessions.Sessions {
			apiSession := &v1pb.UserSession{
				Name:             fmt.Sprintf("users/%d/sessions/%s", userID, session.SessionId),
				SessionId:        session.SessionId,
				CreateTime:       session.CreateTime,
				LastAccessedTime: session.LastAccessedTime,
				ClientInfo: &v1pb.UserSession_ClientInfo{
					UserAgent:  session.ClientInfo.UserAgent,
					IpAddress:  session.ClientInfo.IpAddress,
					DeviceType: session.ClientInfo.DeviceType,
					Os:         session.ClientInfo.Os,
					Browser:    session.ClientInfo.Browser,
				},
			}
			apiSessions = append(apiSessions, apiSession)
		}
		setting.Value = &v1pb.UserSetting_SessionsSetting_{
			SessionsSetting: &v1pb.UserSetting_SessionsSetting{
				Sessions: apiSessions,
			},
		}
	case storepb.UserSetting_ACCESS_TOKENS:
		accessTokens := storeSetting.GetAccessTokens()
		apiTokens := make([]*v1pb.UserAccessToken, 0, len(accessTokens.AccessTokens))
		for _, token := range accessTokens.AccessTokens {
			apiToken := &v1pb.UserAccessToken{
				Name:        fmt.Sprintf("users/%d/accessTokens/%s", userID, token.AccessToken),
				AccessToken: token.AccessToken,
				Description: token.Description,
			}
			apiTokens = append(apiTokens, apiToken)
		}
		setting.Value = &v1pb.UserSetting_AccessTokensSetting_{
			AccessTokensSetting: &v1pb.UserSetting_AccessTokensSetting{
				AccessTokens: apiTokens,
			},
		}
	case storepb.UserSetting_WEBHOOKS:
		webhooks := storeSetting.GetWebhooks()
		apiWebhooks := make([]*v1pb.UserWebhook, 0, len(webhooks.Webhooks))
		for _, webhook := range webhooks.Webhooks {
			apiWebhook := &v1pb.UserWebhook{
				Name:        fmt.Sprintf("users/%d/webhooks/%s", userID, webhook.Id),
				Url:         webhook.Url,
				DisplayName: webhook.Title,
			}
			apiWebhooks = append(apiWebhooks, apiWebhook)
		}
		setting.Value = &v1pb.UserSetting_WebhooksSetting_{
			WebhooksSetting: &v1pb.UserSetting_WebhooksSetting{
				Webhooks: apiWebhooks,
			},
		}
	default:
		// Default to general setting if unknown key
		setting.Value = &v1pb.UserSetting_GeneralSetting_{
			GeneralSetting: getDefaultUserGeneralSetting(),
		}
	}

	return setting
}

// convertUserSettingToStore converts API UserSetting to store UserSetting.
func convertUserSettingToStore(apiSetting *v1pb.UserSetting, userID int32, key storepb.UserSetting_Key) (*storepb.UserSetting, error) {
	storeSetting := &storepb.UserSetting{
		UserId: userID,
		Key:    key,
	}

	switch key {
	case storepb.UserSetting_GENERAL:
		if general := apiSetting.GetGeneralSetting(); general != nil {
			storeSetting.Value = &storepb.UserSetting_General{
				General: &storepb.GeneralUserSetting{
					Locale:         general.Locale,
					MemoVisibility: general.MemoVisibility,
					Theme:          general.Theme,
				},
			}
		} else {
			return nil, errors.Errorf("general setting is required")
		}
	case storepb.UserSetting_SESSIONS:
		if sessions := apiSetting.GetSessionsSetting(); sessions != nil {
			storeSessions := make([]*storepb.SessionsUserSetting_Session, 0, len(sessions.Sessions))
			for _, session := range sessions.Sessions {
				storeSession := &storepb.SessionsUserSetting_Session{
					SessionId:        session.SessionId,
					CreateTime:       session.CreateTime,
					LastAccessedTime: session.LastAccessedTime,
					ClientInfo: &storepb.SessionsUserSetting_ClientInfo{
						UserAgent:  session.ClientInfo.UserAgent,
						IpAddress:  session.ClientInfo.IpAddress,
						DeviceType: session.ClientInfo.DeviceType,
						Os:         session.ClientInfo.Os,
						Browser:    session.ClientInfo.Browser,
					},
				}
				storeSessions = append(storeSessions, storeSession)
			}
			storeSetting.Value = &storepb.UserSetting_Sessions{
				Sessions: &storepb.SessionsUserSetting{
					Sessions: storeSessions,
				},
			}
		} else {
			return nil, errors.Errorf("sessions setting is required")
		}
	case storepb.UserSetting_ACCESS_TOKENS:
		if accessTokens := apiSetting.GetAccessTokensSetting(); accessTokens != nil {
			storeTokens := make([]*storepb.AccessTokensUserSetting_AccessToken, 0, len(accessTokens.AccessTokens))
			for _, token := range accessTokens.AccessTokens {
				storeToken := &storepb.AccessTokensUserSetting_AccessToken{
					AccessToken: token.AccessToken,
					Description: token.Description,
				}
				storeTokens = append(storeTokens, storeToken)
			}
			storeSetting.Value = &storepb.UserSetting_AccessTokens{
				AccessTokens: &storepb.AccessTokensUserSetting{
					AccessTokens: storeTokens,
				},
			}
		} else {
			return nil, errors.Errorf("access tokens setting is required")
		}
	case storepb.UserSetting_WEBHOOKS:
		if webhooks := apiSetting.GetWebhooksSetting(); webhooks != nil {
			storeWebhooks := make([]*storepb.WebhooksUserSetting_Webhook, 0, len(webhooks.Webhooks))
			for _, webhook := range webhooks.Webhooks {
				storeWebhook := &storepb.WebhooksUserSetting_Webhook{
					Id:    extractWebhookIDFromName(webhook.Name),
					Title: webhook.DisplayName,
					Url:   webhook.Url,
				}
				storeWebhooks = append(storeWebhooks, storeWebhook)
			}
			storeSetting.Value = &storepb.UserSetting_Webhooks{
				Webhooks: &storepb.WebhooksUserSetting{
					Webhooks: storeWebhooks,
				},
			}
		} else {
			return nil, errors.Errorf("webhooks setting is required")
		}
	default:
		return nil, errors.Errorf("unsupported setting key: %v", key)
	}

	return storeSetting, nil
}

// extractWebhookIDFromName extracts webhook ID from resource name.
// e.g., "users/123/webhooks/webhook-id" -> "webhook-id".
func extractWebhookIDFromName(name string) string {
	parts := strings.Split(name, "/")
	if len(parts) >= 4 && parts[0] == "users" && parts[2] == "webhooks" {
		return parts[3]
	}
	return ""
}

// validateUserFilter validates the user filter string.
func (s *APIV1Service) validateUserFilter(_ context.Context, filterStr string) error {
	if filterStr == "" {
		return errors.New("filter cannot be empty")
	}
	// Validate the filter.
	parsedExpr, err := filter.Parse(filterStr, filter.UserFilterCELAttributes...)
	if err != nil {
		return errors.Wrap(err, "failed to parse filter")
	}
	convertCtx := filter.NewConvertContext()

	// Determine the dialect based on the actual database driver
	var dialect filter.SQLDialect
	switch s.Profile.Driver {
	case "sqlite":
		dialect = &filter.SQLiteDialect{}
	case "mysql":
		dialect = &filter.MySQLDialect{}
	case "postgres":
		dialect = &filter.PostgreSQLDialect{}
	default:
		// Default to SQLite for unknown drivers
		dialect = &filter.SQLiteDialect{}
	}

	converter := filter.NewUserSQLConverter(dialect)
	err = converter.ConvertExprToSQL(convertCtx, parsedExpr.GetExpr())
	if err != nil {
		return errors.Wrap(err, "failed to convert filter to SQL")
	}
	return nil
}
