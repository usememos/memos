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

	// Try to authenticate via session ID (from cookie) first
	if sessionCookieValue, err := getSessionIDFromMetadata(md); err == nil && sessionCookieValue != "" {
		user, err := in.authenticateBySession(ctx, sessionCookieValue)
		if err == nil && user != nil {
			// Extract just the sessionID part for context storage
			_, sessionID, parseErr := ParseSessionCookieValue(sessionCookieValue)
			if parseErr != nil {
				return nil, status.Errorf(codes.Internal, "failed to parse session cookie: %v", parseErr)
			}
			return in.handleAuthenticatedRequest(ctx, request, serverInfo, handler, user, sessionID, "")
		}
	}

	// Try to authenticate via JWT access token (from Authorization header)
	if accessToken, err := getAccessTokenFromMetadata(md); err == nil && accessToken != "" {
		user, err := in.authenticateByJWT(ctx, accessToken)
		if err == nil && user != nil {
			return in.handleAuthenticatedRequest(ctx, request, serverInfo, handler, user, "", accessToken)
		}
	}

	// If no valid authentication found, check if this method is in the allowlist (public endpoints)
	if isUnauthorizeAllowedMethod(serverInfo.FullMethod) {
		return handler(ctx, request)
	}

	// If authentication is required but not found, reject the request
	return nil, status.Errorf(codes.Unauthenticated, "authentication required")
}

// handleAuthenticatedRequest processes an authenticated request with the given user and auth info.
func (in *GRPCAuthInterceptor) handleAuthenticatedRequest(ctx context.Context, request any, serverInfo *grpc.UnaryServerInfo, handler grpc.UnaryHandler, user *store.User, sessionID, accessToken string) (any, error) {
	// Check user status
	if user.RowStatus == store.Archived {
		return nil, errors.Errorf("user %q is archived", user.Username)
	}
	if isOnlyForAdminAllowedMethod(serverInfo.FullMethod) && user.Role != store.RoleHost && user.Role != store.RoleAdmin {
		return nil, errors.Errorf("user %q is not admin", user.Username)
	}

	// Set context values
	ctx = context.WithValue(ctx, userIDContextKey, user.ID)

	if sessionID != "" {
		// Session-based authentication
		ctx = context.WithValue(ctx, sessionIDContextKey, sessionID)
		// Update session last accessed time
		_ = in.updateSessionLastAccessed(ctx, user.ID, sessionID)
	} else if accessToken != "" {
		// JWT access token-based authentication
		ctx = context.WithValue(ctx, accessTokenContextKey, accessToken)
	}

	return handler(ctx, request)
}

// authenticateByJWT authenticates a user using JWT access token from Authorization header.
func (in *GRPCAuthInterceptor) authenticateByJWT(ctx context.Context, accessToken string) (*store.User, error) {
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

	// Get user from JWT claims
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

	// Validate that this access token exists in the user's access tokens
	accessTokens, err := in.Store.GetUserAccessTokens(ctx, user.ID)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to get user access tokens")
	}
	if !validateAccessToken(accessToken, accessTokens) {
		return nil, status.Errorf(codes.Unauthenticated, "invalid access token")
	}

	return user, nil
}

// authenticateBySession authenticates a user using session ID from cookie.
func (in *GRPCAuthInterceptor) authenticateBySession(ctx context.Context, sessionCookieValue string) (*store.User, error) {
	if sessionCookieValue == "" {
		return nil, status.Errorf(codes.Unauthenticated, "session cookie value not found")
	}

	// Parse the cookie value to extract userID and sessionID
	userID, sessionID, err := ParseSessionCookieValue(sessionCookieValue)
	if err != nil {
		return nil, status.Errorf(codes.Unauthenticated, "invalid session cookie format: %v", err)
	}

	// Get the user directly using the userID from the cookie
	user, err := in.Store.GetUser(ctx, &store.FindUser{
		ID: &userID,
	})
	if err != nil {
		return nil, errors.Wrap(err, "failed to get user")
	}
	if user == nil {
		return nil, status.Errorf(codes.Unauthenticated, "user not found")
	}
	if user.RowStatus == store.Archived {
		return nil, status.Errorf(codes.Unauthenticated, "user is archived")
	}

	// Get user sessions and validate the sessionID
	sessions, err := in.Store.GetUserSessions(ctx, userID)
	if err != nil {
		return nil, errors.Wrap(err, "failed to get user sessions")
	}

	if !validateUserSession(sessionID, sessions) {
		return nil, status.Errorf(codes.Unauthenticated, "invalid or expired session")
	}

	return user, nil
}

// updateSessionLastAccessed updates the last accessed time for a user session.
func (in *GRPCAuthInterceptor) updateSessionLastAccessed(ctx context.Context, userID int32, sessionID string) error {
	return in.Store.UpdateUserSessionLastAccessed(ctx, userID, sessionID, timestamppb.Now())
}

// validateUserSession checks if a session exists and is still valid using sliding expiration.
func validateUserSession(sessionID string, userSessions []*storepb.SessionsUserSetting_Session) bool {
	for _, session := range userSessions {
		if sessionID == session.SessionId {
			// Use sliding expiration: check if last_accessed_time + 2 weeks > current_time
			if session.LastAccessedTime != nil {
				expirationTime := session.LastAccessedTime.AsTime().Add(SessionSlidingDuration)
				if expirationTime.Before(time.Now()) {
					return false
				}
			}
			return true
		}
	}
	return false
}

// getSessionIDFromMetadata extracts session cookie value from cookie.
func getSessionIDFromMetadata(md metadata.MD) (string, error) {
	// Check the cookie header for session cookie value
	var sessionCookieValue string
	for _, t := range append(md.Get("grpcgateway-cookie"), md.Get("cookie")...) {
		header := http.Header{}
		header.Add("Cookie", t)
		request := http.Request{Header: header}
		if v, _ := request.Cookie(SessionCookieName); v != nil {
			sessionCookieValue = v.Value
		}
	}
	if sessionCookieValue == "" {
		return "", errors.New("session cookie not found")
	}
	return sessionCookieValue, nil
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

func validateAccessToken(accessTokenString string, userAccessTokens []*storepb.AccessTokensUserSetting_AccessToken) bool {
	for _, userAccessToken := range userAccessTokens {
		if accessTokenString == userAccessToken.AccessToken {
			return true
		}
	}
	return false
}
