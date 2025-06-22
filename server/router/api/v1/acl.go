package v1

import (
	"context"
	"net/http"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/pkg/errors"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/timestamppb"

	"github.com/usememos/memos/internal/util"
	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
)

// ContextKey is the key type of context value.
type ContextKey int

const (
	// The key name used to store user's ID in the context (for user-based auth).
	userIDContextKey ContextKey = iota
	// The key name used to store session ID in the context (for session-based auth).
	sessionIDContextKey
	// The key name used to store access token in the context (for token-based auth).
	accessTokenContextKey
)

// GRPCAuthInterceptor is the auth interceptor for gRPC server.
type GRPCAuthInterceptor struct {
	Store  *store.Store
	secret string
}

// NewGRPCAuthInterceptor returns a new API auth interceptor.
func NewGRPCAuthInterceptor(store *store.Store, secret string) *GRPCAuthInterceptor {
	return &GRPCAuthInterceptor{
		Store:  store,
		secret: secret,
	}
}

// AuthenticationInterceptor is the unary interceptor for gRPC API.
func (in *GRPCAuthInterceptor) AuthenticationInterceptor(ctx context.Context, request any, serverInfo *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (any, error) {
	md, ok := metadata.FromIncomingContext(ctx)
	if !ok {
		return nil, status.Errorf(codes.Unauthenticated, "failed to parse metadata from incoming context")
	}

	// Try to get access token from either Authorization header or cookie
	accessToken, err := getTokenFromMetadata(md)
	if err != nil {
		return nil, status.Errorf(codes.Unauthenticated, "failed to get access token: %v", err)
	}

	// Authenticate using access token (which also validates sessions when it's from cookie)
	user, err := in.authenticateByAccessToken(ctx, accessToken)
	if err != nil {
		// Check if this method is in the allowlist first
		if isUnauthorizeAllowedMethod(serverInfo.FullMethod) {
			return handler(ctx, request)
		}
		return nil, err
	}

	// Check user status
	if user.RowStatus == store.Archived {
		return nil, errors.Errorf("user %q is archived", user.Username)
	}
	if isOnlyForAdminAllowedMethod(serverInfo.FullMethod) && user.Role != store.RoleHost && user.Role != store.RoleAdmin {
		return nil, errors.Errorf("user %q is not admin", user.Username)
	}

	// Set context values
	ctx = context.WithValue(ctx, userIDContextKey, user.ID)

	// Determine if this came from cookie (session) or header (API token)
	if _, headerErr := getAccessTokenFromMetadata(md); headerErr != nil {
		// Came from cookie, treat as session
		ctx = context.WithValue(ctx, sessionIDContextKey, accessToken)
		// Update session last accessed time
		_ = in.updateSessionLastAccessed(ctx, user.ID, accessToken)
	} else {
		// Came from Authorization header, treat as API token
		ctx = context.WithValue(ctx, accessTokenContextKey, accessToken)
	}

	return handler(ctx, request)
}

// authenticateByAccessToken authenticates a user using access token from Authorization header or cookie.
func (in *GRPCAuthInterceptor) authenticateByAccessToken(ctx context.Context, accessToken string) (*store.User, error) {
	if accessToken == "" {
		return nil, status.Errorf(codes.Unauthenticated, "access token not found")
	}
	claims := &ClaimsMessage{}
	_, err := jwt.ParseWithClaims(accessToken, claims, func(t *jwt.Token) (any, error) {
		if t.Method.Alg() != jwt.SigningMethodHS256.Name {
			return nil, status.Errorf(codes.Unauthenticated, "unexpected access token signing method=%v, expect %v", t.Header["alg"], jwt.SigningMethodHS256)
		}
		if kid, ok := t.Header["kid"].(string); ok {
			if kid == "v1" {
				return []byte(in.secret), nil
			}
		}
		return nil, status.Errorf(codes.Unauthenticated, "unexpected access token kid=%v", t.Header["kid"])
	})
	if err != nil {
		return nil, status.Errorf(codes.Unauthenticated, "Invalid or expired access token")
	}

	// We either have a valid access token or we will attempt to generate new access token.
	userID, err := util.ConvertStringToInt32(claims.Subject)
	if err != nil {
		return nil, errors.Wrap(err, "malformed ID in the token")
	}
	user, err := in.Store.GetUser(ctx, &store.FindUser{
		ID: &userID,
	})
	if err != nil {
		return nil, errors.Wrap(err, "failed to get user")
	}
	if user == nil {
		return nil, errors.Errorf("user %q not exists", userID)
	}
	if user.RowStatus == store.Archived {
		return nil, errors.Errorf("user %q is archived", userID)
	}

	accessTokens, err := in.Store.GetUserAccessTokens(ctx, user.ID)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to get user access tokens")
	}
	if !validateAccessToken(accessToken, accessTokens) {
		return nil, status.Errorf(codes.Unauthenticated, "invalid access token")
	}

	// For tokens that might be used as session IDs (from cookies), also validate session existence
	// This is a best-effort check - if sessions can't be retrieved or token isn't a session, that's ok
	if sessions, err := in.Store.GetUserSessions(ctx, user.ID); err == nil {
		validateUserSession(accessToken, sessions) // Result doesn't matter for API tokens
	}

	return user, nil
}

// updateSessionLastAccessed updates the last accessed time for a user session.
func (in *GRPCAuthInterceptor) updateSessionLastAccessed(ctx context.Context, userID int32, sessionID string) error {
	return in.Store.UpdateUserSessionLastAccessed(ctx, userID, sessionID, timestamppb.Now())
}

// validateUserSession checks if a session exists and is still valid.
func validateUserSession(sessionID string, userSessions []*storepb.SessionsUserSetting_Session) bool {
	for _, session := range userSessions {
		if sessionID == session.SessionId {
			// Check if session has expired
			if session.ExpireTime != nil && session.ExpireTime.AsTime().Before(time.Now()) {
				return false
			}
			return true
		}
	}
	return false
}

// getAccessTokenFromMetadata extracts access token from Authorization header.
func getAccessTokenFromMetadata(md metadata.MD) (string, error) {
	// Check the HTTP request Authorization header.
	authorizationHeaders := md.Get("Authorization")
	if len(authorizationHeaders) == 0 {
		return "", errors.New("authorization header not found")
	}
	authHeaderParts := strings.Fields(authorizationHeaders[0])
	if len(authHeaderParts) != 2 || strings.ToLower(authHeaderParts[0]) != "bearer" {
		return "", errors.New("authorization header format must be Bearer {token}")
	}
	return authHeaderParts[1], nil
}

func getTokenFromMetadata(md metadata.MD) (string, error) {
	// Check the HTTP request header first.
	authorizationHeaders := md.Get("Authorization")
	if len(authorizationHeaders) > 0 {
		authHeaderParts := strings.Fields(authorizationHeaders[0])
		if len(authHeaderParts) != 2 || strings.ToLower(authHeaderParts[0]) != "bearer" {
			return "", errors.New("authorization header format must be Bearer {token}")
		}
		return authHeaderParts[1], nil
	}
	// Check the cookie header.
	var accessToken string
	for _, t := range append(md.Get("grpcgateway-cookie"), md.Get("cookie")...) {
		header := http.Header{}
		header.Add("Cookie", t)
		request := http.Request{Header: header}
		if v, _ := request.Cookie(AccessTokenCookieName); v != nil {
			accessToken = v.Value
		}
	}
	return accessToken, nil
}

func validateAccessToken(accessTokenString string, userAccessTokens []*storepb.AccessTokensUserSetting_AccessToken) bool {
	for _, userAccessToken := range userAccessTokens {
		if accessTokenString == userAccessToken.AccessToken {
			return true
		}
	}
	return false
}
