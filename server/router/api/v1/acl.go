package v1

// gRPC Authentication Interceptor
//
// This file implements the authentication interceptor for gRPC requests.
// It extracts credentials from gRPC metadata and delegates to the shared Authenticator.
//
// Authentication flow:
// 1. Extract session cookie or bearer token from metadata
// 2. Validate credentials using Authenticator
// 3. Check authorization (admin-only methods)
// 4. Set user context and proceed with request
//
// For public methods (defined in acl_config.go), authentication is skipped.

import (
	"context"

	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"

	"github.com/usememos/memos/server/auth"
	"github.com/usememos/memos/store"
)

// GRPCAuthInterceptor is the authentication interceptor for gRPC server.
// It validates incoming requests and sets user context for authenticated requests.
type GRPCAuthInterceptor struct {
	authenticator *auth.Authenticator
}

// NewGRPCAuthInterceptor creates a new gRPC authentication interceptor.
func NewGRPCAuthInterceptor(store *store.Store, secret string) *GRPCAuthInterceptor {
	return &GRPCAuthInterceptor{
		authenticator: auth.NewAuthenticator(store, secret),
	}
}

// AuthenticationInterceptor is the unary interceptor for gRPC API.
//
// Authentication strategy (in priority order):
// 1. Session Cookie: "user_session" cookie with format "{userID}-{sessionID}"
// 2. Bearer Token: "Authorization: Bearer {jwt_token}" header
// 3. Public Methods: Allow without auth if method is in public allowlist
// 4. Reject: Return Unauthenticated error
//
// On successful authentication, context values are set:
// - auth.UserIDContextKey: The authenticated user's ID
// - auth.SessionIDContextKey: Session ID (cookie auth only)
// - auth.AccessTokenContextKey: JWT token (bearer auth only).
func (in *GRPCAuthInterceptor) AuthenticationInterceptor(ctx context.Context, request any, serverInfo *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (any, error) {
	md, ok := metadata.FromIncomingContext(ctx)
	if !ok {
		return nil, status.Errorf(codes.Unauthenticated, "failed to parse metadata from incoming context")
	}

	// Try session cookie authentication
	if sessionCookie := extractSessionCookieFromMetadata(md); sessionCookie != "" {
		user, err := in.authenticator.AuthenticateBySession(ctx, sessionCookie)
		if err == nil && user != nil {
			_, sessionID, _ := auth.ParseSessionCookieValue(sessionCookie)
			ctx, err = in.authenticator.AuthorizeAndSetContext(ctx, serverInfo.FullMethod, user, sessionID, "", IsAdminOnlyMethod)
			if err != nil {
				return nil, toGRPCError(err, codes.PermissionDenied)
			}
			return handler(ctx, request)
		}
	}

	// Try bearer token authentication
	if token := extractBearerTokenFromMetadata(md); token != "" {
		user, err := in.authenticator.AuthenticateByJWT(ctx, token)
		if err == nil && user != nil {
			ctx, err = in.authenticator.AuthorizeAndSetContext(ctx, serverInfo.FullMethod, user, "", token, IsAdminOnlyMethod)
			if err != nil {
				return nil, toGRPCError(err, codes.PermissionDenied)
			}
			return handler(ctx, request)
		}
	}

	// Allow public methods without authentication
	if IsPublicMethod(serverInfo.FullMethod) {
		return handler(ctx, request)
	}

	return nil, status.Errorf(codes.Unauthenticated, "authentication required")
}

// toGRPCError converts an error to a gRPC status error with the given code.
// If the error is already a gRPC status error, it is returned as-is.
func toGRPCError(err error, code codes.Code) error {
	if err == nil {
		return nil
	}
	if _, ok := status.FromError(err); ok {
		return err
	}
	return status.Errorf(code, "%v", err)
}

// extractSessionCookieFromMetadata extracts the session cookie value from gRPC metadata.
// Checks both "grpcgateway-cookie" (from gRPC-Gateway) and "cookie" (native gRPC).
// Returns empty string if no session cookie is found.
func extractSessionCookieFromMetadata(md metadata.MD) string {
	// gRPC-Gateway puts cookies in "grpcgateway-cookie", native gRPC uses "cookie"
	for _, cookieHeader := range append(md.Get("grpcgateway-cookie"), md.Get("cookie")...) {
		if cookie := auth.ExtractSessionCookieFromHeader(cookieHeader); cookie != "" {
			return cookie
		}
	}
	return ""
}

// extractBearerTokenFromMetadata extracts JWT token from Authorization header in gRPC metadata.
// Returns empty string if no valid bearer token is found.
func extractBearerTokenFromMetadata(md metadata.MD) string {
	authHeaders := md.Get("Authorization")
	if len(authHeaders) == 0 {
		return ""
	}
	return auth.ExtractBearerToken(authHeaders[0])
}
