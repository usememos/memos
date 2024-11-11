package v1

import (
	"context"
	"fmt"
	"log/slog"
	"regexp"
	"strings"
	"time"

	"github.com/pkg/errors"
	"golang.org/x/crypto/bcrypt"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/emptypb"

	"github.com/usememos/memos/internal/util"
	"github.com/usememos/memos/plugin/idp"
	"github.com/usememos/memos/plugin/idp/oauth2"
	v1pb "github.com/usememos/memos/proto/gen/api/v1"
	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
)

const (
	unmatchedUsernameAndPasswordError = "unmatched username and password"
)

func (s *APIV1Service) GetAuthStatus(ctx context.Context, _ *v1pb.GetAuthStatusRequest) (*v1pb.User, error) {
	user, err := s.GetCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Unauthenticated, "failed to get current user: %v", err)
	}
	if user == nil {
		// Set the cookie header to expire access token.
		if err := s.clearAccessTokenCookie(ctx); err != nil {
			return nil, status.Errorf(codes.Internal, "failed to set grpc header: %v", err)
		}
		return nil, status.Errorf(codes.Unauthenticated, "user not found")
	}
	return convertUserFromStore(user), nil
}

func (s *APIV1Service) SignIn(ctx context.Context, request *v1pb.SignInRequest) (*v1pb.User, error) {
	user, err := s.Store.GetUser(ctx, &store.FindUser{
		Username: &request.Username,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get user, error: %v", err)
	}
	if user == nil {
		return nil, status.Errorf(codes.InvalidArgument, unmatchedUsernameAndPasswordError)
	}
	// Compare the stored hashed password, with the hashed version of the password that was received.
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(request.Password)); err != nil {
		return nil, status.Errorf(codes.InvalidArgument, unmatchedUsernameAndPasswordError)
	}

	workspaceGeneralSetting, err := s.Store.GetWorkspaceGeneralSetting(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get workspace general setting, error: %v", err)
	}
	// Check if the password auth in is allowed.
	if workspaceGeneralSetting.DisallowPasswordAuth && user.Role == store.RoleUser {
		return nil, status.Errorf(codes.PermissionDenied, "password signin is not allowed")
	}
	if user.RowStatus == store.Archived {
		return nil, status.Errorf(codes.PermissionDenied, "user has been archived with username %s", request.Username)
	}

	expireTime := time.Now().Add(AccessTokenDuration)
	if request.NeverExpire {
		// Set the expire time to 100 years.
		expireTime = time.Now().Add(100 * 365 * 24 * time.Hour)
	}
	if err := s.doSignIn(ctx, user, expireTime); err != nil {
		return nil, status.Errorf(codes.Internal, "failed to sign in, error: %v", err)
	}
	return convertUserFromStore(user), nil
}

func (s *APIV1Service) SignInWithSSO(ctx context.Context, request *v1pb.SignInWithSSORequest) (*v1pb.User, error) {
	identityProvider, err := s.Store.GetIdentityProvider(ctx, &store.FindIdentityProvider{
		ID: &request.IdpId,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get identity provider, error: %v", err)
	}
	if identityProvider == nil {
		return nil, status.Errorf(codes.InvalidArgument, "identity provider not found")
	}

	var userInfo *idp.IdentityProviderUserInfo
	if identityProvider.Type == storepb.IdentityProvider_OAUTH2 {
		oauth2IdentityProvider, err := oauth2.NewIdentityProvider(identityProvider.Config.GetOauth2Config())
		if err != nil {
			return nil, status.Errorf(codes.Internal, "failed to create oauth2 identity provider, error: %v", err)
		}
		token, err := oauth2IdentityProvider.ExchangeToken(ctx, request.RedirectUri, request.Code)
		if err != nil {
			return nil, status.Errorf(codes.Internal, "failed to exchange token, error: %v", err)
		}
		userInfo, err = oauth2IdentityProvider.UserInfo(token)
		if err != nil {
			return nil, status.Errorf(codes.Internal, "failed to get user info, error: %v", err)
		}
	}

	identifierFilter := identityProvider.IdentifierFilter
	if identifierFilter != "" {
		identifierFilterRegex, err := regexp.Compile(identifierFilter)
		if err != nil {
			return nil, status.Errorf(codes.Internal, "failed to compile identifier filter regex, error: %v", err)
		}
		if !identifierFilterRegex.MatchString(userInfo.Identifier) {
			return nil, status.Errorf(codes.PermissionDenied, "identifier %s does not match the filter %s", userInfo.Identifier, identifierFilter)
		}
	}

	user, err := s.Store.GetUser(ctx, &store.FindUser{
		Username: &userInfo.Identifier,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get user, error: %v", err)
	}
	if user == nil {
		userCreate := &store.User{
			Username: userInfo.Identifier,
			// The new signup user should be normal user by default.
			Role:     store.RoleUser,
			Nickname: userInfo.DisplayName,
			Email:    userInfo.Email,
		}
		password, err := util.RandomString(20)
		if err != nil {
			return nil, status.Errorf(codes.Internal, "failed to generate random password, error: %v", err)
		}
		passwordHash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
		if err != nil {
			return nil, status.Errorf(codes.Internal, "failed to generate password hash, error: %v", err)
		}
		userCreate.PasswordHash = string(passwordHash)
		user, err = s.Store.CreateUser(ctx, userCreate)
		if err != nil {
			return nil, status.Errorf(codes.Internal, "failed to create user, error: %v", err)
		}
	}
	if user.RowStatus == store.Archived {
		return nil, status.Errorf(codes.PermissionDenied, "user has been archived with username %s", userInfo.Identifier)
	}

	if err := s.doSignIn(ctx, user, time.Now().Add(AccessTokenDuration)); err != nil {
		return nil, status.Errorf(codes.Internal, "failed to sign in, error: %v", err)
	}
	return convertUserFromStore(user), nil
}

func (s *APIV1Service) doSignIn(ctx context.Context, user *store.User, expireTime time.Time) error {
	accessToken, err := GenerateAccessToken(user.Email, user.ID, expireTime, []byte(s.Secret))
	if err != nil {
		return status.Errorf(codes.Internal, "failed to generate access token, error: %v", err)
	}
	if err := s.UpsertAccessTokenToStore(ctx, user, accessToken, "user login"); err != nil {
		return status.Errorf(codes.Internal, "failed to upsert access token to store, error: %v", err)
	}

	cookie, err := s.buildAccessTokenCookie(ctx, accessToken, expireTime)
	if err != nil {
		return status.Errorf(codes.Internal, "failed to build access token cookie, error: %v", err)
	}
	if err := grpc.SetHeader(ctx, metadata.New(map[string]string{
		"Set-Cookie": cookie,
	})); err != nil {
		return status.Errorf(codes.Internal, "failed to set grpc header, error: %v", err)
	}

	return nil
}

func (s *APIV1Service) SignUp(ctx context.Context, request *v1pb.SignUpRequest) (*v1pb.User, error) {
	workspaceGeneralSetting, err := s.Store.GetWorkspaceGeneralSetting(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get workspace general setting, error: %v", err)
	}
	if workspaceGeneralSetting.DisallowUserRegistration {
		return nil, status.Errorf(codes.PermissionDenied, "sign up is not allowed")
	}

	passwordHash, err := bcrypt.GenerateFromPassword([]byte(request.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to generate password hash, error: %v", err)
	}

	create := &store.User{
		Username:     request.Username,
		Nickname:     request.Username,
		PasswordHash: string(passwordHash),
	}
	if !util.UIDMatcher.MatchString(strings.ToLower(create.Username)) {
		return nil, status.Errorf(codes.InvalidArgument, "invalid username: %s", create.Username)
	}

	hostUserType := store.RoleHost
	existedHostUsers, err := s.Store.ListUsers(ctx, &store.FindUser{
		Role: &hostUserType,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list host users, error: %v", err)
	}
	if len(existedHostUsers) == 0 {
		// Change the default role to host if there is no host user.
		create.Role = store.RoleHost
	} else {
		create.Role = store.RoleUser
	}

	user, err := s.Store.CreateUser(ctx, create)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to create user, error: %v", err)
	}

	if err := s.doSignIn(ctx, user, time.Now().Add(AccessTokenDuration)); err != nil {
		return nil, status.Errorf(codes.Internal, "failed to sign in, error: %v", err)
	}
	return convertUserFromStore(user), nil
}

func (s *APIV1Service) SignOut(ctx context.Context, _ *v1pb.SignOutRequest) (*emptypb.Empty, error) {
	accessToken, ok := ctx.Value(accessTokenContextKey).(string)
	// Try to delete the access token from the store.
	if ok {
		user, _ := s.GetCurrentUser(ctx)
		if user != nil {
			if _, err := s.DeleteUserAccessToken(ctx, &v1pb.DeleteUserAccessTokenRequest{
				Name:        fmt.Sprintf("%s%d", UserNamePrefix, user.ID),
				AccessToken: accessToken,
			}); err != nil {
				slog.Error("failed to delete access token", "error", err)
			}
		}
	}

	if err := s.clearAccessTokenCookie(ctx); err != nil {
		return nil, status.Errorf(codes.Internal, "failed to set grpc header, error: %v", err)
	}
	return &emptypb.Empty{}, nil
}

func (s *APIV1Service) clearAccessTokenCookie(ctx context.Context) error {
	cookie, err := s.buildAccessTokenCookie(ctx, "", time.Time{})
	if err != nil {
		return errors.Wrap(err, "failed to build access token cookie")
	}
	if err := grpc.SetHeader(ctx, metadata.New(map[string]string{
		"Set-Cookie": cookie,
	})); err != nil {
		return errors.Wrap(err, "failed to set grpc header")
	}
	return nil
}

func (*APIV1Service) buildAccessTokenCookie(ctx context.Context, accessToken string, expireTime time.Time) (string, error) {
	attrs := []string{
		fmt.Sprintf("%s=%s", AccessTokenCookieName, accessToken),
		"Path=/",
		"HttpOnly",
	}
	if expireTime.IsZero() {
		attrs = append(attrs, "Expires=Thu, 01 Jan 1970 00:00:00 GMT")
	} else {
		attrs = append(attrs, "Expires="+expireTime.Format(time.RFC1123))
	}

	md, ok := metadata.FromIncomingContext(ctx)
	if !ok {
		return "", errors.New("failed to get metadata from context")
	}
	var origin string
	for _, v := range md.Get("origin") {
		origin = v
	}
	isHTTPS := strings.HasPrefix(origin, "https://")
	if isHTTPS {
		attrs = append(attrs, "SameSite=None")
		attrs = append(attrs, "Secure")
	} else {
		attrs = append(attrs, "SameSite=Strict")
	}
	return strings.Join(attrs, "; "), nil
}

func (s *APIV1Service) GetCurrentUser(ctx context.Context) (*store.User, error) {
	username, ok := ctx.Value(usernameContextKey).(string)
	if !ok {
		return nil, nil
	}
	user, err := s.Store.GetUser(ctx, &store.FindUser{
		Username: &username,
	})
	if err != nil {
		return nil, err
	}
	return user, nil
}
