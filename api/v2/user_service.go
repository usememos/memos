package v2

import (
	"context"
	"net/http"
	"time"

	"github.com/golang-jwt/jwt/v4"
	"github.com/labstack/echo/v4"
	"github.com/pkg/errors"
	"golang.org/x/crypto/bcrypt"
	"golang.org/x/exp/slices"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/timestamppb"

	"github.com/usememos/memos/api/auth"
	apiv2pb "github.com/usememos/memos/proto/gen/api/v2"
	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
)

type UserService struct {
	apiv2pb.UnimplementedUserServiceServer

	Store  *store.Store
	Secret string
}

// NewUserService creates a new UserService.
func NewUserService(store *store.Store, secret string) *UserService {
	return &UserService{
		Store:  store,
		Secret: secret,
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
	response := &apiv2pb.GetUserResponse{
		User: userMessage,
	}
	return response, nil
}

func (s *UserService) UpdateUser(ctx context.Context, request *apiv2pb.UpdateUserRequest) (*apiv2pb.UpdateUserResponse, error) {
	currentUser, err := getCurrentUser(ctx, s.Store)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get user: %v", err)
	}
	if currentUser.Username != request.Username && currentUser.Role != store.RoleAdmin {
		return nil, status.Errorf(codes.PermissionDenied, "permission denied")
	}
	if request.UpdateMask == nil || len(request.UpdateMask) == 0 {
		return nil, status.Errorf(codes.InvalidArgument, "update mask is empty")
	}

	currentTs := time.Now().Unix()
	update := &store.UpdateUser{
		ID:        currentUser.ID,
		UpdatedTs: &currentTs,
	}
	for _, path := range request.UpdateMask {
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

func (s *UserService) ListUserAccessTokens(ctx context.Context, request *apiv2pb.ListUserAccessTokensRequest) (*apiv2pb.ListUserAccessTokensResponse, error) {
	user, err := getCurrentUser(ctx, s.Store)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get current user: %v", err)
	}
	if user == nil || user.Username != request.Username {
		return nil, status.Errorf(codes.PermissionDenied, "permission denied")
	}

	userAccessTokens, err := s.Store.GetUserAccessTokens(ctx, user.ID)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list access tokens: %v", err)
	}

	accessTokens := []*apiv2pb.UserAccessToken{}
	for _, userAccessToken := range userAccessTokens {
		claims := &auth.ClaimsMessage{}
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

		userAccessToken := &apiv2pb.UserAccessToken{
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
	slices.SortFunc(accessTokens, func(i, j *apiv2pb.UserAccessToken) bool {
		return i.IssuedAt.Seconds > j.IssuedAt.Seconds
	})
	response := &apiv2pb.ListUserAccessTokensResponse{
		AccessTokens: accessTokens,
	}
	return response, nil
}

func (s *UserService) CreateUserAccessToken(ctx context.Context, request *apiv2pb.CreateUserAccessTokenRequest) (*apiv2pb.CreateUserAccessTokenResponse, error) {
	user, err := getCurrentUser(ctx, s.Store)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get current user: %v", err)
	}

	accessToken, err := auth.GenerateAccessToken(user.Username, user.ID, request.UserAccessToken.ExpiresAt.AsTime(), s.Secret)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to generate access token: %v", err)
	}

	claims := &auth.ClaimsMessage{}
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
	if err := s.UpsertAccessTokenToStore(ctx, user, accessToken, request.UserAccessToken.Description); err != nil {
		return nil, status.Errorf(codes.Internal, "failed to upsert access token to store: %v", err)
	}

	userAccessToken := &apiv2pb.UserAccessToken{
		AccessToken: accessToken,
		Description: request.UserAccessToken.Description,
		IssuedAt:    timestamppb.New(claims.IssuedAt.Time),
	}
	if claims.ExpiresAt != nil {
		userAccessToken.ExpiresAt = timestamppb.New(claims.ExpiresAt.Time)
	}
	response := &apiv2pb.CreateUserAccessTokenResponse{
		AccessToken: userAccessToken,
	}
	return response, nil
}

func (s *UserService) DeleteUserAccessToken(ctx context.Context, request *apiv2pb.DeleteUserAccessTokenRequest) (*apiv2pb.DeleteUserAccessTokenResponse, error) {
	user, err := getCurrentUser(ctx, s.Store)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get current user: %v", err)
	}

	userAccessTokens, err := s.Store.GetUserAccessTokens(ctx, user.ID)
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
	if _, err := s.Store.UpsertUserSettingV1(ctx, &storepb.UserSetting{
		UserId: user.ID,
		Key:    storepb.UserSettingKey_USER_SETTING_ACCESS_TOKENS,
		Value: &storepb.UserSetting_AccessTokens{
			AccessTokens: &storepb.AccessTokensUserSetting{
				AccessTokens: updatedUserAccessTokens,
			},
		},
	}); err != nil {
		return nil, status.Errorf(codes.Internal, "failed to upsert user setting: %v", err)
	}

	return &apiv2pb.DeleteUserAccessTokenResponse{}, nil
}

func (s *UserService) UpsertAccessTokenToStore(ctx context.Context, user *store.User, accessToken, description string) error {
	userAccessTokens, err := s.Store.GetUserAccessTokens(ctx, user.ID)
	if err != nil {
		return errors.Wrap(err, "failed to get user access tokens")
	}
	userAccessToken := storepb.AccessTokensUserSetting_AccessToken{
		AccessToken: accessToken,
		Description: description,
	}
	userAccessTokens = append(userAccessTokens, &userAccessToken)
	if _, err := s.Store.UpsertUserSettingV1(ctx, &storepb.UserSetting{
		UserId: user.ID,
		Key:    storepb.UserSettingKey_USER_SETTING_ACCESS_TOKENS,
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
