package v2

import (
	"context"
	"fmt"
	"regexp"
	"time"

	"github.com/pkg/errors"
	"golang.org/x/crypto/bcrypt"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/proto"

	"github.com/usememos/memos/api/auth"
	"github.com/usememos/memos/internal/util"
	"github.com/usememos/memos/plugin/idp"
	"github.com/usememos/memos/plugin/idp/oauth2"
	apiv2pb "github.com/usememos/memos/proto/gen/api/v2"
	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/server/service/metric"
	"github.com/usememos/memos/store"
)

func (s *APIV2Service) GetAuthStatus(ctx context.Context, _ *apiv2pb.GetAuthStatusRequest) (*apiv2pb.GetAuthStatusResponse, error) {
	user, err := getCurrentUser(ctx, s.Store)
	if err != nil {
		return nil, status.Errorf(codes.Unauthenticated, "failed to get current user: %v", err)
	}
	if user == nil {
		// Set the cookie header to expire access token.
		if err := clearAccessTokenCookie(ctx); err != nil {
			return nil, status.Errorf(codes.Internal, "failed to set grpc header")
		}
		return nil, status.Errorf(codes.Unauthenticated, "user not found")
	}
	return &apiv2pb.GetAuthStatusResponse{
		User: convertUserFromStore(user),
	}, nil
}

func (s *APIV2Service) SignIn(ctx context.Context, request *apiv2pb.SignInRequest) (*apiv2pb.SignInResponse, error) {
	user, err := s.Store.GetUser(ctx, &store.FindUser{
		Username: &request.Username,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, fmt.Sprintf("failed to find user by username %s", request.Username))
	}
	if user == nil {
		return nil, status.Errorf(codes.InvalidArgument, fmt.Sprintf("user not found with username %s", request.Username))
	} else if user.RowStatus == store.Archived {
		return nil, status.Errorf(codes.PermissionDenied, fmt.Sprintf("user has been archived with username %s", request.Username))
	}

	// Compare the stored hashed password, with the hashed version of the password that was received.
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(request.Password)); err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "unmatched email and password")
	}

	expireTime := time.Now().Add(auth.AccessTokenDuration)
	if request.NeverExpire {
		// Zero time means never expire.
		expireTime = time.Time{}
	}
	if err := s.doSignIn(ctx, user, expireTime); err != nil {
		return nil, status.Errorf(codes.Internal, fmt.Sprintf("failed to sign in, err: %s", err))
	}
	return &apiv2pb.SignInResponse{
		User: convertUserFromStore(user),
	}, nil
}

func (s *APIV2Service) SignInWithSSO(ctx context.Context, request *apiv2pb.SignInWithSSORequest) (*apiv2pb.SignInWithSSOResponse, error) {
	identityProvider, err := s.Store.GetIdentityProvider(ctx, &store.FindIdentityProvider{
		ID: &request.IdpId,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, fmt.Sprintf("failed to get identity provider, err: %s", err))
	}
	if identityProvider == nil {
		return nil, status.Errorf(codes.InvalidArgument, fmt.Sprintf("identity provider not found with id %d", request.IdpId))
	}

	var userInfo *idp.IdentityProviderUserInfo
	if identityProvider.Type == store.IdentityProviderOAuth2Type {
		oauth2IdentityProvider, err := oauth2.NewIdentityProvider(identityProvider.Config.OAuth2Config)
		if err != nil {
			return nil, status.Errorf(codes.Internal, fmt.Sprintf("failed to create oauth2 identity provider, err: %s", err))
		}
		token, err := oauth2IdentityProvider.ExchangeToken(ctx, request.RedirectUri, request.Code)
		if err != nil {
			return nil, status.Errorf(codes.Internal, fmt.Sprintf("failed to exchange token, err: %s", err))
		}
		userInfo, err = oauth2IdentityProvider.UserInfo(token)
		if err != nil {
			return nil, status.Errorf(codes.Internal, fmt.Sprintf("failed to get user info, err: %s", err))
		}
	}

	identifierFilter := identityProvider.IdentifierFilter
	if identifierFilter != "" {
		identifierFilterRegex, err := regexp.Compile(identifierFilter)
		if err != nil {
			return nil, status.Errorf(codes.Internal, fmt.Sprintf("failed to compile identifier filter regex, err: %s", err))
		}
		if !identifierFilterRegex.MatchString(userInfo.Identifier) {
			return nil, status.Errorf(codes.PermissionDenied, fmt.Sprintf("identifier %s is not allowed", userInfo.Identifier))
		}
	}

	user, err := s.Store.GetUser(ctx, &store.FindUser{
		Username: &userInfo.Identifier,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, fmt.Sprintf("failed to find user by username %s", userInfo.Identifier))
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
			return nil, status.Errorf(codes.Internal, fmt.Sprintf("failed to generate random password, err: %s", err))
		}
		passwordHash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
		if err != nil {
			return nil, status.Errorf(codes.Internal, fmt.Sprintf("failed to generate password hash, err: %s", err))
		}
		userCreate.PasswordHash = string(passwordHash)
		user, err = s.Store.CreateUser(ctx, userCreate)
		if err != nil {
			return nil, status.Errorf(codes.Internal, fmt.Sprintf("failed to create user, err: %s", err))
		}
	}
	if user.RowStatus == store.Archived {
		return nil, status.Errorf(codes.PermissionDenied, fmt.Sprintf("user has been archived with username %s", userInfo.Identifier))
	}

	if err := s.doSignIn(ctx, user, time.Now().Add(auth.AccessTokenDuration)); err != nil {
		return nil, status.Errorf(codes.Internal, fmt.Sprintf("failed to sign in, err: %s", err))
	}
	return &apiv2pb.SignInWithSSOResponse{
		User: convertUserFromStore(user),
	}, nil
}

func (s *APIV2Service) doSignIn(ctx context.Context, user *store.User, expireTime time.Time) error {
	accessToken, err := auth.GenerateAccessToken(user.Email, user.ID, expireTime, []byte(s.Secret))
	if err != nil {
		return status.Errorf(codes.Internal, fmt.Sprintf("failed to generate tokens, err: %s", err))
	}
	if err := s.UpsertAccessTokenToStore(ctx, user, accessToken, "user login"); err != nil {
		return status.Errorf(codes.Internal, fmt.Sprintf("failed to upsert access token to store, err: %s", err))
	}

	cookieExpires := time.Now().Add(auth.CookieExpDuration)
	if expireTime.IsZero() {
		// Set cookie expires to 100 years.
		cookieExpires = time.Now().AddDate(100, 0, 0)
	}
	if err := grpc.SetHeader(ctx, metadata.New(map[string]string{
		"Set-Cookie": fmt.Sprintf("%s=%s; Path=/; Expires=%s; HttpOnly; SameSite=Strict", auth.AccessTokenCookieName, accessToken, cookieExpires.Format(time.RFC1123)),
	})); err != nil {
		return status.Errorf(codes.Internal, "failed to set grpc header, error: %v", err)
	}

	metric.Enqueue("user sign in")
	return nil
}

func (s *APIV2Service) SignUp(ctx context.Context, request *apiv2pb.SignUpRequest) (*apiv2pb.SignUpResponse, error) {
	workspaceGeneralSetting, err := s.GetWorkspaceGeneralSetting(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, fmt.Sprintf("failed to get workspace setting, err: %s", err))
	}
	if workspaceGeneralSetting.DisallowSignup || workspaceGeneralSetting.DisallowPasswordLogin {
		return nil, status.Errorf(codes.PermissionDenied, "sign up is not allowed")
	}

	passwordHash, err := bcrypt.GenerateFromPassword([]byte(request.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, status.Errorf(codes.Internal, fmt.Sprintf("failed to generate password hash, err: %s", err))
	}

	create := &store.User{
		Username:     request.Username,
		Nickname:     request.Username,
		PasswordHash: string(passwordHash),
	}

	hostUserType := store.RoleHost
	existedHostUsers, err := s.Store.ListUsers(ctx, &store.FindUser{
		Role: &hostUserType,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, fmt.Sprintf("failed to list users, err: %s", err))
	}
	if len(existedHostUsers) == 0 {
		// Change the default role to host if there is no host user.
		create.Role = store.RoleHost
	} else {
		create.Role = store.RoleUser
	}

	user, err := s.Store.CreateUser(ctx, create)
	if err != nil {
		return nil, status.Errorf(codes.Internal, fmt.Sprintf("failed to create user, err: %s", err))
	}

	if err := s.doSignIn(ctx, user, time.Now().Add(auth.AccessTokenDuration)); err != nil {
		return nil, status.Errorf(codes.Internal, fmt.Sprintf("failed to sign in, err: %s", err))
	}
	metric.Enqueue("user sign up")
	return &apiv2pb.SignUpResponse{
		User: convertUserFromStore(user),
	}, nil
}

func (*APIV2Service) SignOut(ctx context.Context, _ *apiv2pb.SignOutRequest) (*apiv2pb.SignOutResponse, error) {
	if err := clearAccessTokenCookie(ctx); err != nil {
		return nil, status.Errorf(codes.Internal, "failed to set grpc header, error: %v", err)
	}
	return &apiv2pb.SignOutResponse{}, nil
}

func clearAccessTokenCookie(ctx context.Context) error {
	if err := grpc.SetHeader(ctx, metadata.New(map[string]string{
		"Set-Cookie": fmt.Sprintf("%s=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Strict", auth.AccessTokenCookieName),
	})); err != nil {
		return errors.Wrap(err, "failed to set grpc header")
	}
	return nil
}

func (s *APIV2Service) GetWorkspaceGeneralSetting(ctx context.Context) (*storepb.WorkspaceGeneralSetting, error) {
	workspaceSetting, err := s.Store.GetWorkspaceSetting(ctx, &store.FindWorkspaceSetting{
		Name: storepb.WorkspaceSettingKey_WORKSPACE_SETTING_GENERAL.String(),
	})
	if err != nil {
		return nil, errors.Wrap(err, "failed to get workspace setting")
	}
	workspaceGeneralSetting := &storepb.WorkspaceGeneralSetting{}
	if workspaceSetting != nil {
		if err := proto.Unmarshal([]byte(workspaceSetting.Value), workspaceGeneralSetting); err != nil {
			return nil, errors.Wrap(err, "failed to unmarshal workspace setting")
		}
	}
	return workspaceGeneralSetting, nil
}
