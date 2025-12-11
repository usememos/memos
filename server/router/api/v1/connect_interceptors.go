package v1

import (
	"context"
	"fmt"
	"log/slog"
	"runtime/debug"

	"connectrpc.com/connect"
	"github.com/pkg/errors"

	"github.com/usememos/memos/server/auth"
	"github.com/usememos/memos/store"
)

// LoggingInterceptor logs Connect RPC requests with appropriate log levels.
//
// Log levels:
// - INFO: Successful requests and expected client errors (not found, permission denied, etc.)
// - ERROR: Server errors (internal, unavailable, etc.)
type LoggingInterceptor struct {
	logStacktrace bool
}

// NewLoggingInterceptor creates a new logging interceptor.
func NewLoggingInterceptor(logStacktrace bool) *LoggingInterceptor {
	return &LoggingInterceptor{logStacktrace: logStacktrace}
}

func (in *LoggingInterceptor) WrapUnary(next connect.UnaryFunc) connect.UnaryFunc {
	return func(ctx context.Context, req connect.AnyRequest) (connect.AnyResponse, error) {
		resp, err := next(ctx, req)
		in.log(req.Spec().Procedure, err)
		return resp, err
	}
}

func (in *LoggingInterceptor) WrapStreamingClient(next connect.StreamingClientFunc) connect.StreamingClientFunc {
	return next // No-op for server-side interceptor
}

func (in *LoggingInterceptor) WrapStreamingHandler(next connect.StreamingHandlerFunc) connect.StreamingHandlerFunc {
	return next // Streaming not used in this service
}

func (in *LoggingInterceptor) log(procedure string, err error) {
	level, msg := in.classifyError(err)
	attrs := []slog.Attr{slog.String("method", procedure)}
	if err != nil {
		attrs = append(attrs, slog.String("error", err.Error()))
		if in.logStacktrace {
			attrs = append(attrs, slog.String("stacktrace", fmt.Sprintf("%+v", err)))
		}
	}
	slog.LogAttrs(context.Background(), level, msg, attrs...)
}

func (in *LoggingInterceptor) classifyError(err error) (slog.Level, string) {
	if err == nil {
		return slog.LevelInfo, "OK"
	}

	var connectErr *connect.Error
	if !errors.As(err, &connectErr) {
		return slog.LevelError, "unknown error"
	}

	// Client errors (expected, log at INFO)
	switch connectErr.Code() {
	case connect.CodeCanceled,
		connect.CodeInvalidArgument,
		connect.CodeNotFound,
		connect.CodeAlreadyExists,
		connect.CodePermissionDenied,
		connect.CodeUnauthenticated,
		connect.CodeResourceExhausted,
		connect.CodeFailedPrecondition,
		connect.CodeAborted,
		connect.CodeOutOfRange:
		return slog.LevelInfo, "client error"
	}

	// Server errors
	return slog.LevelError, "server error"
}

// RecoveryInterceptor recovers from panics in Connect handlers and returns an internal error.
type RecoveryInterceptor struct {
	logStacktrace bool
}

// NewRecoveryInterceptor creates a new recovery interceptor.
func NewRecoveryInterceptor(logStacktrace bool) *RecoveryInterceptor {
	return &RecoveryInterceptor{logStacktrace: logStacktrace}
}

func (in *RecoveryInterceptor) WrapUnary(next connect.UnaryFunc) connect.UnaryFunc {
	return func(ctx context.Context, req connect.AnyRequest) (resp connect.AnyResponse, err error) {
		defer func() {
			if r := recover(); r != nil {
				in.logPanic(req.Spec().Procedure, r)
				err = connect.NewError(connect.CodeInternal, errors.New("internal server error"))
			}
		}()
		return next(ctx, req)
	}
}

func (in *RecoveryInterceptor) WrapStreamingClient(next connect.StreamingClientFunc) connect.StreamingClientFunc {
	return next
}

func (in *RecoveryInterceptor) WrapStreamingHandler(next connect.StreamingHandlerFunc) connect.StreamingHandlerFunc {
	return next
}

func (in *RecoveryInterceptor) logPanic(procedure string, panicValue any) {
	attrs := []slog.Attr{
		slog.String("method", procedure),
		slog.Any("panic", panicValue),
	}
	if in.logStacktrace {
		attrs = append(attrs, slog.String("stacktrace", string(debug.Stack())))
	}
	slog.LogAttrs(context.Background(), slog.LevelError, "panic recovered in Connect handler", attrs...)
}

// AuthInterceptor handles authentication for Connect handlers.
//
// It reuses the same authentication logic as GRPCAuthInterceptor by delegating
// to a shared Authenticator instance. This ensures consistent authentication
// behavior across both gRPC and Connect protocols.
type AuthInterceptor struct {
	authenticator *auth.Authenticator
}

// NewAuthInterceptor creates a new auth interceptor.
func NewAuthInterceptor(store *store.Store, secret string) *AuthInterceptor {
	return &AuthInterceptor{
		authenticator: auth.NewAuthenticator(store, secret),
	}
}

func (in *AuthInterceptor) WrapUnary(next connect.UnaryFunc) connect.UnaryFunc {
	return func(ctx context.Context, req connect.AnyRequest) (connect.AnyResponse, error) {
		procedure := req.Spec().Procedure
		header := req.Header()

		// Try session cookie authentication first
		if sessionCookie := auth.ExtractSessionCookieFromHeader(header.Get("Cookie")); sessionCookie != "" {
			user, err := in.authenticator.AuthenticateBySession(ctx, sessionCookie)
			if err == nil && user != nil {
				_, sessionID, _ := auth.ParseSessionCookieValue(sessionCookie)
				ctx, err = in.authenticator.AuthorizeAndSetContext(ctx, procedure, user, sessionID, "", IsAdminOnlyMethod)
				if err != nil {
					return nil, convertAuthError(err)
				}
				return next(ctx, req)
			}
		}

		// Try JWT token authentication
		if accessToken := auth.ExtractBearerToken(header.Get("Authorization")); accessToken != "" {
			user, err := in.authenticator.AuthenticateByJWT(ctx, accessToken)
			if err == nil && user != nil {
				ctx, err = in.authenticator.AuthorizeAndSetContext(ctx, procedure, user, "", accessToken, IsAdminOnlyMethod)
				if err != nil {
					return nil, convertAuthError(err)
				}
				return next(ctx, req)
			}
		}

		// Allow public methods without authentication
		if IsPublicMethod(procedure) {
			return next(ctx, req)
		}

		return nil, connect.NewError(connect.CodeUnauthenticated, errors.New("authentication required"))
	}
}

func (in *AuthInterceptor) WrapStreamingClient(next connect.StreamingClientFunc) connect.StreamingClientFunc {
	return next
}

func (in *AuthInterceptor) WrapStreamingHandler(next connect.StreamingHandlerFunc) connect.StreamingHandlerFunc {
	return next
}

// convertAuthError converts authentication/authorization errors to Connect errors.
func convertAuthError(err error) error {
	if err == nil {
		return nil
	}
	// Check if it's already a Connect error
	var connectErr *connect.Error
	if errors.As(err, &connectErr) {
		return err
	}
	// Default to permission denied for auth errors
	return connect.NewError(connect.CodePermissionDenied, err)
}
