package v1

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/google/cel-go/cel"
	"github.com/google/cel-go/common/ast"
	"github.com/labstack/echo/v4"
	"github.com/pkg/errors"
	"golang.org/x/crypto/bcrypt"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/emptypb"
	"google.golang.org/protobuf/types/known/timestamppb"

	"github.com/usememos/memos/internal/base"
	"github.com/usememos/memos/internal/util"
	v1pb "github.com/usememos/memos/proto/gen/api/v1"
	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/server/auth"
	"github.com/usememos/memos/store"
)

func (s *APIV1Service) ListUsers(ctx context.Context, request *v1pb.ListUsersRequest) (*v1pb.ListUsersResponse, error) {
	currentUser, err := s.fetchCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get user: %v", err)
	}
	if currentUser == nil {
		return nil, status.Errorf(codes.Unauthenticated, "user not authenticated")
	}
	if currentUser.Role != store.RoleAdmin {
		return nil, status.Errorf(codes.PermissionDenied, "permission denied")
	}

	userFind := &store.FindUser{}

	if request.Filter != "" {
		username, err := extractUsernameFromFilter(request.Filter)
		if err != nil {
			return nil, status.Errorf(codes.InvalidArgument, "invalid filter: %v", err)
		}
		if username != "" {
			userFind.Username = &username
		}
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
	// Extract identifier from "users/{id_or_username}"
	identifier := extractUserIdentifierFromName(request.Name)
	if identifier == "" {
		return nil, status.Errorf(codes.InvalidArgument, "invalid user name: %s", request.Name)
	}

	var user *store.User
	var err error

	// Try to parse as numeric ID first
	if userID, parseErr := strconv.ParseInt(identifier, 10, 32); parseErr == nil {
		// It's a numeric ID
		userID32 := int32(userID)
		user, err = s.Store.GetUser(ctx, &store.FindUser{
			ID: &userID32,
		})
	} else {
		// It's a username
		user, err = s.Store.GetUser(ctx, &store.FindUser{
			Username: &identifier,
		})
	}

	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get user: %v", err)
	}
	if user == nil {
		return nil, status.Errorf(codes.NotFound, "user not found")
	}
	return convertUserFromStore(user), nil
}

func (s *APIV1Service) CreateUser(ctx context.Context, request *v1pb.CreateUserRequest) (*v1pb.User, error) {
	// Get current user (might be nil for unauthenticated requests)
	currentUser, _ := s.fetchCurrentUser(ctx)

	// Check if there are any existing users (for first-time setup detection)
	limitOne := 1
	allUsers, err := s.Store.ListUsers(ctx, &store.FindUser{Limit: &limitOne})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list users: %v", err)
	}
	isFirstUser := len(allUsers) == 0

	// Check registration settings FIRST (unless it's the very first user)
	if !isFirstUser {
		// Only allow user registration if it is enabled in the settings, or if the user is a superuser
		if currentUser == nil || !isSuperUser(currentUser) {
			instanceGeneralSetting, err := s.Store.GetInstanceGeneralSetting(ctx)
			if err != nil {
				return nil, status.Errorf(codes.Internal, "failed to get instance general setting, error: %v", err)
			}
			if instanceGeneralSetting.DisallowUserRegistration {
				return nil, status.Errorf(codes.PermissionDenied, "user registration is not allowed")
			}
		}
	}

	// Determine the role to assign
	var roleToAssign store.Role
	if isFirstUser {
		// First-time setup: create the first user as ADMIN (no authentication required)
		roleToAssign = store.RoleAdmin
	} else if currentUser != nil && currentUser.Role == store.RoleAdmin {
		// Authenticated ADMIN user can create users with any role specified in request
		if request.User.Role != v1pb.User_ROLE_UNSPECIFIED {
			roleToAssign = convertUserRoleToStore(request.User.Role)
		} else {
			roleToAssign = store.RoleUser
		}
	} else {
		// Unauthenticated or non-ADMIN users can only create normal users
		roleToAssign = store.RoleUser
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
	currentUser, err := s.fetchCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get user: %v", err)
	}
	if currentUser == nil {
		return nil, status.Errorf(codes.Unauthenticated, "user not authenticated")
	}
	// Check permission.
	// Only allow admin or self to update user.
	if currentUser.ID != userID && currentUser.Role != store.RoleAdmin {
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
	instanceGeneralSetting, err := s.Store.GetInstanceGeneralSetting(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get instance general setting: %v", err)
	}
	for _, field := range request.UpdateMask.Paths {
		switch field {
		case "username":
			if instanceGeneralSetting.DisallowChangeUsername {
				return nil, status.Errorf(codes.PermissionDenied, "permission denied: disallow change username")
			}
			if !base.UIDMatcher.MatchString(strings.ToLower(request.User.Username)) {
				return nil, status.Errorf(codes.InvalidArgument, "invalid username: %s", request.User.Username)
			}
			update.Username = &request.User.Username
		case "display_name":
			if instanceGeneralSetting.DisallowChangeNickname {
				return nil, status.Errorf(codes.PermissionDenied, "permission denied: disallow change nickname")
			}
			update.Nickname = &request.User.DisplayName
		case "email":
			update.Email = &request.User.Email
		case "avatar_url":
			// Validate avatar MIME type to prevent XSS during upload
			if request.User.AvatarUrl != "" {
				imageType, _, err := extractImageInfo(request.User.AvatarUrl)
				if err != nil {
					return nil, status.Errorf(codes.InvalidArgument, "invalid avatar format: %v", err)
				}
				// Only allow safe image formats for avatars
				allowedAvatarTypes := map[string]bool{
					"image/png":  true,
					"image/jpeg": true,
					"image/jpg":  true,
					"image/gif":  true,
					"image/webp": true,
				}
				if !allowedAvatarTypes[imageType] {
					return nil, status.Errorf(codes.InvalidArgument, "invalid avatar image type: %s. Only PNG, JPEG, GIF, and WebP are allowed", imageType)
				}
			}
			update.AvatarURL = &request.User.AvatarUrl
		case "description":
			update.Description = &request.User.Description
		case "role":
			// Only allow admin to update role.
			if currentUser.Role != store.RoleAdmin {
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
	currentUser, err := s.fetchCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get user: %v", err)
	}
	if currentUser == nil {
		return nil, status.Errorf(codes.Unauthenticated, "user not authenticated")
	}
	if currentUser.ID != userID && currentUser.Role != store.RoleAdmin {
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

	return convertUserSettingFromStore(userSetting, userID, storeKey), nil
}

func (s *APIV1Service) UpdateUserSetting(ctx context.Context, request *v1pb.UpdateUserSettingRequest) (*v1pb.UserSetting, error) {
	// Parse resource name: users/{user}/settings/{setting}
	userID, settingKey, err := ExtractUserIDAndSettingKeyFromName(request.Setting.Name)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid resource name: %v", err)
	}

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
		case "memo_visibility":
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

// ListPersonalAccessTokens retrieves all Personal Access Tokens (PATs) for a user.
//
// Personal Access Tokens are used for:
// - Mobile app authentication
// - CLI tool authentication
// - API client authentication
// - Any programmatic access requiring Bearer token auth
//
// Security:
// - Only the token owner can list their tokens
// - Returns token metadata only (not the actual token value)
// - Invalid or expired tokens are filtered out
//
// Authentication: Required (session cookie or access token)
// Authorization: User can only list their own tokens.
func (s *APIV1Service) ListPersonalAccessTokens(ctx context.Context, request *v1pb.ListPersonalAccessTokensRequest) (*v1pb.ListPersonalAccessTokensResponse, error) {
	userID, err := ExtractUserIDFromName(request.Parent)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid user name: %v", err)
	}

	// Verify permission
	claims := auth.GetUserClaims(ctx)
	if claims == nil || claims.UserID != userID {
		currentUser, _ := s.fetchCurrentUser(ctx)
		if currentUser == nil || (currentUser.ID != userID && currentUser.Role != store.RoleAdmin) {
			return nil, status.Errorf(codes.PermissionDenied, "permission denied")
		}
	}

	tokens, err := s.Store.GetUserPersonalAccessTokens(ctx, userID)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get access tokens: %v", err)
	}

	personalAccessTokens := make([]*v1pb.PersonalAccessToken, len(tokens))
	for i, token := range tokens {
		personalAccessTokens[i] = &v1pb.PersonalAccessToken{
			Name:        fmt.Sprintf("%s/personalAccessTokens/%s", request.Parent, token.TokenId),
			Description: token.Description,
			ExpiresAt:   token.ExpiresAt,
			CreatedAt:   token.CreatedAt,
			LastUsedAt:  token.LastUsedAt,
		}
	}

	return &v1pb.ListPersonalAccessTokensResponse{PersonalAccessTokens: personalAccessTokens}, nil
}

// CreatePersonalAccessToken creates a new Personal Access Token (PAT) for a user.
//
// Use cases:
// - User manually creates token in settings for mobile app
// - User creates token for CLI tool
// - User creates token for third-party integration
//
// Token properties:
// - Random string with memos_pat_ prefix
// - SHA-256 hash stored in database
// - Optional expiration time (can be never-expiring)
// - User-provided description for identification
//
// Security considerations:
// - Full token is only shown ONCE (in this response)
// - User should copy and store it securely
// - Token can be revoked by deleting it from settings
//
// Authentication: Required (session cookie or access token)
// Authorization: User can only create tokens for themselves.
func (s *APIV1Service) CreatePersonalAccessToken(ctx context.Context, request *v1pb.CreatePersonalAccessTokenRequest) (*v1pb.CreatePersonalAccessTokenResponse, error) {
	userID, err := ExtractUserIDFromName(request.Parent)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid user name: %v", err)
	}

	// Verify permission
	claims := auth.GetUserClaims(ctx)
	if claims == nil || claims.UserID != userID {
		currentUser, _ := s.fetchCurrentUser(ctx)
		if currentUser == nil || currentUser.ID != userID {
			return nil, status.Errorf(codes.PermissionDenied, "permission denied")
		}
	}

	// Generate PAT
	tokenID := util.GenUUID()
	token := auth.GeneratePersonalAccessToken()
	tokenHash := auth.HashPersonalAccessToken(token)

	var expiresAt *timestamppb.Timestamp
	if request.ExpiresInDays > 0 {
		expiresAt = timestamppb.New(time.Now().AddDate(0, 0, int(request.ExpiresInDays)))
	}

	patRecord := &storepb.PersonalAccessTokensUserSetting_PersonalAccessToken{
		TokenId:     tokenID,
		TokenHash:   tokenHash,
		Description: request.Description,
		ExpiresAt:   expiresAt,
		CreatedAt:   timestamppb.Now(),
	}

	if err := s.Store.AddUserPersonalAccessToken(ctx, userID, patRecord); err != nil {
		return nil, status.Errorf(codes.Internal, "failed to create access token: %v", err)
	}

	return &v1pb.CreatePersonalAccessTokenResponse{
		PersonalAccessToken: &v1pb.PersonalAccessToken{
			Name:        fmt.Sprintf("%s/personalAccessTokens/%s", request.Parent, tokenID),
			Description: request.Description,
			ExpiresAt:   expiresAt,
			CreatedAt:   patRecord.CreatedAt,
		},
		Token: token, // Only returned on creation
	}, nil
}

// DeletePersonalAccessToken revokes a Personal Access Token.
//
// This endpoint:
// 1. Removes the token from the user's access tokens list
// 2. Immediately invalidates the token (subsequent API calls with it will fail)
//
// Use cases:
// - User revokes a compromised token
// - User removes token for unused app/device
// - User cleans up old tokens
//
// Authentication: Required (session cookie or access token)
// Authorization: User can only delete their own tokens.
func (s *APIV1Service) DeletePersonalAccessToken(ctx context.Context, request *v1pb.DeletePersonalAccessTokenRequest) (*emptypb.Empty, error) {
	// Parse name: users/{user_id}/personalAccessTokens/{token_id}
	parts := strings.Split(request.Name, "/")
	if len(parts) != 4 || parts[0] != "users" || parts[2] != "personalAccessTokens" {
		return nil, status.Errorf(codes.InvalidArgument, "invalid personal access token name")
	}

	userID, err := util.ConvertStringToInt32(parts[1])
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid user ID: %v", err)
	}
	tokenID := parts[3]

	// Verify permission
	claims := auth.GetUserClaims(ctx)
	if claims == nil || claims.UserID != userID {
		currentUser, _ := s.fetchCurrentUser(ctx)
		if currentUser == nil || currentUser.ID != userID {
			return nil, status.Errorf(codes.PermissionDenied, "permission denied")
		}
	}

	if err := s.Store.RemoveUserPersonalAccessToken(ctx, userID, tokenID); err != nil {
		return nil, status.Errorf(codes.Internal, "failed to delete access token: %v", err)
	}

	return &emptypb.Empty{}, nil
}

func (s *APIV1Service) ListUserWebhooks(ctx context.Context, request *v1pb.ListUserWebhooksRequest) (*v1pb.ListUserWebhooksResponse, error) {
	userID, err := ExtractUserIDFromName(request.Parent)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid parent: %v", err)
	}

	currentUser, err := s.fetchCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get current user: %v", err)
	}
	if currentUser == nil {
		return nil, status.Errorf(codes.Unauthenticated, "user not authenticated")
	}
	if currentUser.ID != userID && currentUser.Role != store.RoleAdmin {
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

	currentUser, err := s.fetchCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get current user: %v", err)
	}
	if currentUser == nil {
		return nil, status.Errorf(codes.Unauthenticated, "user not authenticated")
	}
	if currentUser.ID != userID && currentUser.Role != store.RoleAdmin {
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

	currentUser, err := s.fetchCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get current user: %v", err)
	}
	if currentUser == nil {
		return nil, status.Errorf(codes.Unauthenticated, "user not authenticated")
	}
	if currentUser.ID != userID && currentUser.Role != store.RoleAdmin {
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

	currentUser, err := s.fetchCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get current user: %v", err)
	}
	if currentUser == nil {
		return nil, status.Errorf(codes.Unauthenticated, "user not authenticated")
	}
	if currentUser.ID != userID && currentUser.Role != store.RoleAdmin {
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
			userpb.AvatarUrl = fmt.Sprintf("/file/%s/avatar", userpb.Name)
		} else {
			userpb.AvatarUrl = user.AvatarURL
		}
	}
	return userpb
}

func convertUserRoleFromStore(role store.Role) v1pb.User_Role {
	switch role {
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
	case v1pb.User_ADMIN:
		return store.RoleAdmin
	default:
		return store.RoleUser
	}
}

// extractImageInfo extracts image type and base64 data from a data URI.
// Data URI format: data:image/png;base64,iVBORw0KGgo...
func extractImageInfo(dataURI string) (string, string, error) {
	dataURIRegex := regexp.MustCompile(`^data:(?P<type>.+);base64,(?P<base64>.+)`)
	matches := dataURIRegex.FindStringSubmatch(dataURI)
	if len(matches) != 3 {
		return "", "", errors.New("invalid data URI format")
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

// extractUsernameFromFilter extracts username from the filter string using CEL.
// Supported filter format: "username == 'steven'"
// Returns the username value and an error if the filter format is invalid.
func extractUsernameFromFilter(filterStr string) (string, error) {
	filterStr = strings.TrimSpace(filterStr)
	if filterStr == "" {
		return "", nil
	}

	// Create CEL environment with username variable
	env, err := cel.NewEnv(
		cel.Variable("username", cel.StringType),
	)
	if err != nil {
		return "", errors.Wrap(err, "failed to create CEL environment")
	}

	// Parse and check the filter expression
	celAST, issues := env.Compile(filterStr)
	if issues != nil && issues.Err() != nil {
		return "", errors.Wrapf(issues.Err(), "invalid filter expression: %s", filterStr)
	}

	// Extract username from the AST
	username, err := extractUsernameFromAST(celAST.NativeRep().Expr())
	if err != nil {
		return "", err
	}

	return username, nil
}

// extractUsernameFromAST extracts the username value from a CEL AST expression.
func extractUsernameFromAST(expr ast.Expr) (string, error) {
	if expr == nil {
		return "", errors.New("empty expression")
	}

	// Check if this is a call expression (for ==, !=, etc.)
	if expr.Kind() != ast.CallKind {
		return "", errors.New("filter must be a comparison expression (e.g., username == 'value')")
	}

	call := expr.AsCall()

	// We only support == operator
	if call.FunctionName() != "_==_" {
		return "", errors.Errorf("unsupported operator: %s (only '==' is supported)", call.FunctionName())
	}

	// The call should have exactly 2 arguments
	args := call.Args()
	if len(args) != 2 {
		return "", errors.New("invalid comparison expression")
	}

	// Try to extract username from either left or right side
	if username, ok := extractUsernameFromComparison(args[0], args[1]); ok {
		return username, nil
	}
	if username, ok := extractUsernameFromComparison(args[1], args[0]); ok {
		return username, nil
	}

	return "", errors.New("filter must compare 'username' field with a string constant")
}

// extractUsernameFromComparison tries to extract username value if left is 'username' ident and right is a string constant.
func extractUsernameFromComparison(left, right ast.Expr) (string, bool) {
	// Check if left side is 'username' identifier
	if left.Kind() != ast.IdentKind {
		return "", false
	}
	ident := left.AsIdent()
	if ident != "username" {
		return "", false
	}

	// Right side should be a constant string
	if right.Kind() != ast.LiteralKind {
		return "", false
	}
	literal := right.AsLiteral()

	// literal is a ref.Val, we need to get the Go value
	str, ok := literal.Value().(string)
	if !ok || str == "" {
		return "", false
	}

	return str, true
}

// ListUserNotifications lists all notifications for a user.
// Notifications are backed by the inbox storage layer and represent activities
// that require user attention (e.g., memo comments).
func (s *APIV1Service) ListUserNotifications(ctx context.Context, request *v1pb.ListUserNotificationsRequest) (*v1pb.ListUserNotificationsResponse, error) {
	userID, err := ExtractUserIDFromName(request.Parent)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid user name: %v", err)
	}

	// Verify the requesting user has permission to view these notifications
	currentUser, err := s.fetchCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get current user: %v", err)
	}
	if currentUser == nil {
		return nil, status.Errorf(codes.Unauthenticated, "user not authenticated")
	}
	if currentUser.ID != userID {
		return nil, status.Errorf(codes.PermissionDenied, "permission denied")
	}

	// Fetch inbox items from storage
	// Filter at database level to only include MEMO_COMMENT notifications (ignore legacy VERSION_UPDATE entries)
	memoCommentType := storepb.InboxMessage_MEMO_COMMENT
	inboxes, err := s.Store.ListInboxes(ctx, &store.FindInbox{
		ReceiverID:  &userID,
		MessageType: &memoCommentType,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list inboxes: %v", err)
	}

	// Convert storage layer inboxes to API notifications
	notifications := []*v1pb.UserNotification{}
	for _, inbox := range inboxes {
		notification, err := s.convertInboxToUserNotification(ctx, inbox)
		if err != nil {
			return nil, status.Errorf(codes.Internal, "failed to convert inbox: %v", err)
		}
		notifications = append(notifications, notification)
	}

	return &v1pb.ListUserNotificationsResponse{
		Notifications: notifications,
	}, nil
}

// UpdateUserNotification updates a notification's status (e.g., marking as read/archived).
// Only the notification owner can update their notifications.
func (s *APIV1Service) UpdateUserNotification(ctx context.Context, request *v1pb.UpdateUserNotificationRequest) (*v1pb.UserNotification, error) {
	if request.Notification == nil {
		return nil, status.Errorf(codes.InvalidArgument, "notification is required")
	}

	notificationID, err := ExtractNotificationIDFromName(request.Notification.Name)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid notification name: %v", err)
	}

	currentUser, err := s.fetchCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get current user: %v", err)
	}

	if currentUser == nil {
		return nil, status.Errorf(codes.Unauthenticated, "user not authenticated")
	}
	// Verify ownership before updating
	inboxes, err := s.Store.ListInboxes(ctx, &store.FindInbox{
		ID: &notificationID,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get inbox: %v", err)
	}
	if len(inboxes) == 0 {
		return nil, status.Errorf(codes.NotFound, "notification not found")
	}
	inbox := inboxes[0]
	if inbox.ReceiverID != currentUser.ID {
		return nil, status.Errorf(codes.PermissionDenied, "permission denied")
	}

	// Build update request based on field mask
	update := &store.UpdateInbox{
		ID: notificationID,
	}

	for _, path := range request.UpdateMask.Paths {
		switch path {
		case "status":
			// Convert API status enum to storage enum
			var inboxStatus store.InboxStatus
			switch request.Notification.Status {
			case v1pb.UserNotification_UNREAD:
				inboxStatus = store.UNREAD
			case v1pb.UserNotification_ARCHIVED:
				inboxStatus = store.ARCHIVED
			default:
				return nil, status.Errorf(codes.InvalidArgument, "invalid status")
			}
			update.Status = inboxStatus
		default:
			return nil, status.Errorf(codes.InvalidArgument, "invalid update path: %s", path)
		}
	}

	updatedInbox, err := s.Store.UpdateInbox(ctx, update)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to update inbox: %v", err)
	}

	notification, err := s.convertInboxToUserNotification(ctx, updatedInbox)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to convert inbox: %v", err)
	}

	return notification, nil
}

// DeleteUserNotification permanently deletes a notification.
// Only the notification owner can delete their notifications.
func (s *APIV1Service) DeleteUserNotification(ctx context.Context, request *v1pb.DeleteUserNotificationRequest) (*emptypb.Empty, error) {
	notificationID, err := ExtractNotificationIDFromName(request.Name)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid notification name: %v", err)
	}

	currentUser, err := s.fetchCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get current user: %v", err)
	}

	if currentUser == nil {
		return nil, status.Errorf(codes.Unauthenticated, "user not authenticated")
	}
	// Verify ownership before deletion
	inboxes, err := s.Store.ListInboxes(ctx, &store.FindInbox{
		ID: &notificationID,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get inbox: %v", err)
	}
	if len(inboxes) == 0 {
		return nil, status.Errorf(codes.NotFound, "notification not found")
	}
	inbox := inboxes[0]
	if inbox.ReceiverID != currentUser.ID {
		return nil, status.Errorf(codes.PermissionDenied, "permission denied")
	}

	if err := s.Store.DeleteInbox(ctx, &store.DeleteInbox{
		ID: notificationID,
	}); err != nil {
		return nil, status.Errorf(codes.Internal, "failed to delete inbox: %v", err)
	}

	return &emptypb.Empty{}, nil
}

// convertInboxToUserNotification converts a storage-layer inbox to an API notification.
// This handles the mapping between the internal inbox representation and the public API.
func (*APIV1Service) convertInboxToUserNotification(_ context.Context, inbox *store.Inbox) (*v1pb.UserNotification, error) {
	notification := &v1pb.UserNotification{
		Name:       fmt.Sprintf("users/%d/notifications/%d", inbox.ReceiverID, inbox.ID),
		Sender:     fmt.Sprintf("%s%d", UserNamePrefix, inbox.SenderID),
		CreateTime: timestamppb.New(time.Unix(inbox.CreatedTs, 0)),
	}

	// Convert status from storage enum to API enum
	switch inbox.Status {
	case store.UNREAD:
		notification.Status = v1pb.UserNotification_UNREAD
	case store.ARCHIVED:
		notification.Status = v1pb.UserNotification_ARCHIVED
	default:
		notification.Status = v1pb.UserNotification_STATUS_UNSPECIFIED
	}

	// Extract notification type and activity ID from inbox message
	if inbox.Message != nil {
		switch inbox.Message.Type {
		case storepb.InboxMessage_MEMO_COMMENT:
			notification.Type = v1pb.UserNotification_MEMO_COMMENT
		default:
			notification.Type = v1pb.UserNotification_TYPE_UNSPECIFIED
		}

		if inbox.Message.ActivityId != nil {
			notification.ActivityId = inbox.Message.ActivityId
		}
	}

	return notification, nil
}

// ExtractNotificationIDFromName extracts the notification ID from a resource name.
// Expected format: users/{user_id}/notifications/{notification_id}.
func ExtractNotificationIDFromName(name string) (int32, error) {
	pattern := regexp.MustCompile(`^users/(\d+)/notifications/(\d+)$`)
	matches := pattern.FindStringSubmatch(name)
	if len(matches) != 3 {
		return 0, errors.Errorf("invalid notification name: %s", name)
	}

	id, err := strconv.Atoi(matches[2])
	if err != nil {
		return 0, errors.Errorf("invalid notification id: %s", matches[2])
	}

	return int32(id), nil
}
