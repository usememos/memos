package v1

import (
	"context"
	"encoding/base64"
	"fmt"
	"net/http"
	"regexp"
	"slices"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/cel-go/cel"
	"github.com/labstack/echo/v4"
	"github.com/pkg/errors"
	"golang.org/x/crypto/bcrypt"
	expr "google.golang.org/genproto/googleapis/api/expr/v1alpha1"
	"google.golang.org/genproto/googleapis/api/httpbody"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/emptypb"
	"google.golang.org/protobuf/types/known/timestamppb"

	"github.com/usememos/memos/internal/util"
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

	response := &v1pb.ListUsersResponse{
		Users: []*v1pb.User{},
	}
	for _, user := range users {
		response.Users = append(response.Users, convertUserFromStore(user))
	}
	return response, nil
}

func (s *APIV1Service) SearchUsers(ctx context.Context, request *v1pb.SearchUsersRequest) (*v1pb.SearchUsersResponse, error) {
	if request.Filter == "" {
		return nil, status.Errorf(codes.InvalidArgument, "filter is empty")
	}
	filter, err := parseSearchUsersFilter(request.Filter)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "failed to parse filter: %v", err)
	}
	userFind := &store.FindUser{}
	if filter.Username != nil {
		userFind.Username = filter.Username
	}
	if filter.Random {
		userFind.Random = true
	}
	if filter.Limit != nil {
		userFind.Limit = filter.Limit
	}

	users, err := s.Store.ListUsers(ctx, userFind)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to search users: %v", err)
	}

	response := &v1pb.SearchUsersResponse{
		Users: []*v1pb.User{},
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

func (s *APIV1Service) GetUserAvatarBinary(ctx context.Context, request *v1pb.GetUserAvatarBinaryRequest) (*httpbody.HttpBody, error) {
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
	if !util.UIDMatcher.MatchString(strings.ToLower(request.User.Username)) {
		return nil, status.Errorf(codes.InvalidArgument, "invalid username: %s", request.User.Username)
	}
	passwordHash, err := bcrypt.GenerateFromPassword([]byte(request.User.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, echo.NewHTTPError(http.StatusInternalServerError, "failed to generate password hash").SetInternal(err)
	}

	user, err := s.Store.CreateUser(ctx, &store.User{
		Username:     request.User.Username,
		Role:         convertUserRoleToStore(request.User.Role),
		Email:        request.User.Email,
		Nickname:     request.User.Nickname,
		PasswordHash: string(passwordHash),
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to create user: %v", err)
	}

	return convertUserFromStore(user), nil
}

func (s *APIV1Service) UpdateUser(ctx context.Context, request *v1pb.UpdateUserRequest) (*v1pb.User, error) {
	workspaceGeneralSetting, err := s.Store.GetWorkspaceGeneralSetting(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get workspace general setting: %v", err)
	}

	userID, err := ExtractUserIDFromName(request.User.Name)
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
	if request.UpdateMask == nil || len(request.UpdateMask.Paths) == 0 {
		return nil, status.Errorf(codes.InvalidArgument, "update mask is empty")
	}

	user, err := s.Store.GetUser(ctx, &store.FindUser{ID: &userID})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get user: %v", err)
	}
	if user == nil {
		return nil, status.Errorf(codes.NotFound, "user not found")
	}

	currentTs := time.Now().Unix()
	update := &store.UpdateUser{
		ID:        user.ID,
		UpdatedTs: &currentTs,
	}
	for _, field := range request.UpdateMask.Paths {
		if field == "username" {
			if workspaceGeneralSetting.DisallowChangeUsername {
				return nil, status.Errorf(codes.PermissionDenied, "permission denied: disallow change username")
			}
			if !util.UIDMatcher.MatchString(strings.ToLower(request.User.Username)) {
				return nil, status.Errorf(codes.InvalidArgument, "invalid username: %s", request.User.Username)
			}
			update.Username = &request.User.Username
		} else if field == "nickname" {
			if workspaceGeneralSetting.DisallowChangeNickname {
				return nil, status.Errorf(codes.PermissionDenied, "permission denied: disallow change nickname")
			}
			update.Nickname = &request.User.Nickname
		} else if field == "email" {
			update.Email = &request.User.Email
		} else if field == "avatar_url" {
			update.AvatarURL = &request.User.AvatarUrl
		} else if field == "description" {
			update.Description = &request.User.Description
		} else if field == "role" {
			role := convertUserRoleToStore(request.User.Role)
			update.Role = &role
		} else if field == "password" {
			passwordHash, err := bcrypt.GenerateFromPassword([]byte(request.User.Password), bcrypt.DefaultCost)
			if err != nil {
				return nil, echo.NewHTTPError(http.StatusInternalServerError, "failed to generate password hash").SetInternal(err)
			}
			passwordHashStr := string(passwordHash)
			update.PasswordHash = &passwordHashStr
		} else if field == "row_status" {
			rowStatus := convertRowStatusToStore(request.User.RowStatus)
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

func getDefaultUserSetting(workspaceMemoRelatedSetting *storepb.WorkspaceMemoRelatedSetting) *v1pb.UserSetting {
	defaultVisibility := "PRIVATE"
	if workspaceMemoRelatedSetting.DefaultVisibility != "" {
		defaultVisibility = workspaceMemoRelatedSetting.DefaultVisibility
	}
	return &v1pb.UserSetting{
		Locale:         "en",
		Appearance:     "system",
		MemoVisibility: defaultVisibility,
	}
}

func (s *APIV1Service) GetUserSetting(ctx context.Context, _ *v1pb.GetUserSettingRequest) (*v1pb.UserSetting, error) {
	user, err := s.GetCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get current user: %v", err)
	}

	workspaceMemoRelatedSetting, err := s.Store.GetWorkspaceMemoRelatedSetting(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get workspace general setting: %v", err)
	}

	userSettings, err := s.Store.ListUserSettings(ctx, &store.FindUserSetting{
		UserID: &user.ID,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list user settings: %v", err)
	}
	// getDefaultUserSetting By workspaceSetting
	userSettingMessage := getDefaultUserSetting(workspaceMemoRelatedSetting)
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
	user, err := s.GetCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get current user: %v", err)
	}

	if request.UpdateMask == nil || len(request.UpdateMask.Paths) == 0 {
		return nil, status.Errorf(codes.InvalidArgument, "update mask is empty")
	}

	for _, field := range request.UpdateMask.Paths {
		if field == "locale" {
			if _, err := s.Store.UpsertUserSetting(ctx, &storepb.UserSetting{
				UserId: user.ID,
				Key:    storepb.UserSettingKey_LOCALE,
				Value: &storepb.UserSetting_Locale{
					Locale: request.Setting.Locale,
				},
			}); err != nil {
				return nil, status.Errorf(codes.Internal, "failed to upsert user setting: %v", err)
			}
		} else if field == "appearance" {
			if _, err := s.Store.UpsertUserSetting(ctx, &storepb.UserSetting{
				UserId: user.ID,
				Key:    storepb.UserSettingKey_APPEARANCE,
				Value: &storepb.UserSetting_Appearance{
					Appearance: request.Setting.Appearance,
				},
			}); err != nil {
				return nil, status.Errorf(codes.Internal, "failed to upsert user setting: %v", err)
			}
		} else if field == "memo_visibility" {
			if _, err := s.Store.UpsertUserSetting(ctx, &storepb.UserSetting{
				UserId: user.ID,
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

	return s.GetUserSetting(ctx, &v1pb.GetUserSettingRequest{})
}

func (s *APIV1Service) ListUserAccessTokens(ctx context.Context, request *v1pb.ListUserAccessTokensRequest) (*v1pb.ListUserAccessTokensResponse, error) {
	userID, err := ExtractUserIDFromName(request.Name)
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

		userAccessToken := &v1pb.UserAccessToken{
			AccessToken: userAccessToken.AccessToken,
			Description: userAccessToken.Description,
			IssuedAt:    timestamppb.New(claims.IssuedAt.Time),
		}
		if claims.ExpiresAt != nil {
			userAccessToken.ExpiresAt = timestamppb.New(claims.ExpiresAt.Time)
		}
		accessTokens = append(accessTokens, userAccessToken)
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
	userID, err := ExtractUserIDFromName(request.Name)
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
	if request.ExpiresAt != nil {
		expiresAt = request.ExpiresAt.AsTime()
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
	if err := s.UpsertAccessTokenToStore(ctx, currentUser, accessToken, request.Description); err != nil {
		return nil, status.Errorf(codes.Internal, "failed to upsert access token to store: %v", err)
	}

	userAccessToken := &v1pb.UserAccessToken{
		AccessToken: accessToken,
		Description: request.Description,
		IssuedAt:    timestamppb.New(claims.IssuedAt.Time),
	}
	if claims.ExpiresAt != nil {
		userAccessToken.ExpiresAt = timestamppb.New(claims.ExpiresAt.Time)
	}
	return userAccessToken, nil
}

func (s *APIV1Service) DeleteUserAccessToken(ctx context.Context, request *v1pb.DeleteUserAccessTokenRequest) (*emptypb.Empty, error) {
	userID, err := ExtractUserIDFromName(request.Name)
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

	userAccessTokens, err := s.Store.GetUserAccessTokens(ctx, currentUser.ID)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list access tokens: %v", err)
	}
	updatedUserAccessTokens := []*storepb.AccessTokensUserSetting_AccessToken{}
	for _, userAccessToken := range userAccessTokens {
		if userAccessToken.AccessToken == request.AccessToken {
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
	userpb := &v1pb.User{
		Name:        fmt.Sprintf("%s%d", UserNamePrefix, user.ID),
		Id:          user.ID,
		RowStatus:   convertRowStatusFromStore(user.RowStatus),
		CreateTime:  timestamppb.New(time.Unix(user.CreatedTs, 0)),
		UpdateTime:  timestamppb.New(time.Unix(user.UpdatedTs, 0)),
		Role:        convertUserRoleFromStore(user.Role),
		Username:    user.Username,
		Email:       user.Email,
		Nickname:    user.Nickname,
		AvatarUrl:   user.AvatarURL,
		Description: user.Description,
	}
	// Use the avatar URL instead of raw base64 image data to reduce the response size.
	if user.AvatarURL != "" {
		userpb.AvatarUrl = fmt.Sprintf("/file/%s/avatar", userpb.Name)
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

// SearchUsersFilterCELAttributes are the CEL attributes for SearchUsersFilter.
var SearchUsersFilterCELAttributes = []cel.EnvOption{
	cel.Variable("username", cel.StringType),
	cel.Variable("random", cel.BoolType),
	cel.Variable("limit", cel.IntType),
}

type SearchUsersFilter struct {
	Username *string
	Random   bool
	Limit    *int
}

func parseSearchUsersFilter(expression string) (*SearchUsersFilter, error) {
	e, err := cel.NewEnv(SearchUsersFilterCELAttributes...)
	if err != nil {
		return nil, err
	}
	ast, issues := e.Compile(expression)
	if issues != nil {
		return nil, errors.Errorf("found issue %v", issues)
	}
	filter := &SearchUsersFilter{}
	expr, err := cel.AstToParsedExpr(ast)
	if err != nil {
		return nil, err
	}
	callExpr := expr.GetExpr().GetCallExpr()
	findSearchUsersField(callExpr, filter)
	return filter, nil
}

func findSearchUsersField(callExpr *expr.Expr_Call, filter *SearchUsersFilter) {
	if len(callExpr.Args) == 2 {
		idExpr := callExpr.Args[0].GetIdentExpr()
		if idExpr != nil {
			if idExpr.Name == "username" {
				username := callExpr.Args[1].GetConstExpr().GetStringValue()
				filter.Username = &username
			} else if idExpr.Name == "random" {
				random := callExpr.Args[1].GetConstExpr().GetBoolValue()
				filter.Random = random
			} else if idExpr.Name == "limit" {
				limit := int(callExpr.Args[1].GetConstExpr().GetInt64Value())
				filter.Limit = &limit
			}
			return
		}
	}
	for _, arg := range callExpr.Args {
		callExpr := arg.GetCallExpr()
		if callExpr != nil {
			findSearchUsersField(callExpr, filter)
		}
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
