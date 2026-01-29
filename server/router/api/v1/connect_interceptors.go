package v1

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"reflect"
	"runtime/debug"

	"connectrpc.com/connect"
	pkgerrors "github.com/pkg/errors"
	"google.golang.org/grpc/metadata"

	"github.com/usememos/memos/server/auth"
	"github.com/usememos/memos/store"
)

// MetadataInterceptor converts Connect HTTP headers to gRPC metadata.
//
// This ensures service methods can use metadata.FromIncomingContext() to access
// headers like User-Agent, X-Forwarded-For, etc., regardless of whether the
// request came via Connect RPC or gRPC-Gateway.
type MetadataInterceptor struct{}

// NewMetadataInterceptor creates a new metadata interceptor.
func NewMetadataInterceptor() *MetadataInterceptor {
	return &MetadataInterceptor{}
}

func (*MetadataInterceptor) WrapUnary(next connect.UnaryFunc) connect.UnaryFunc {
	return func(ctx context.Context, req connect.AnyRequest) (connect.AnyResponse, error) {
		// Convert HTTP headers to gRPC metadata
		header := req.Header()
		md := metadata.MD{}

		// Copy important headers for client info extraction
		if ua := header.Get("User-Agent"); ua != "" {
			md.Set("user-agent", ua)
		}
		if xff := header.Get("X-Forwarded-For"); xff != "" {
			md.Set("x-forwarded-for", xff)
		}
		if xri := header.Get("X-Real-Ip"); xri != "" {
			md.Set("x-real-ip", xri)
		}
		// Forward Cookie header for authentication methods that need it (e.g., RefreshToken)
		if cookie := header.Get("Cookie"); cookie != "" {
			md.Set("cookie", cookie)
		}

		// Set metadata in context so services can use metadata.FromIncomingContext()
		ctx = metadata.NewIncomingContext(ctx, md)

		// Execute the request
		resp, err := next(ctx, req)

		// Prevent browser caching of API responses to avoid stale data issues
		// See: https://github.com/usememos/memos/issues/5470
		if !isNilAnyResponse(resp) && resp.Header() != nil {
			resp.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
			resp.Header().Set("Pragma", "no-cache")
			resp.Header().Set("Expires", "0")
		}

		return resp, err
	}
}

func isNilAnyResponse(resp connect.AnyResponse) bool {
	if resp == nil {
		return true
	}
	val := reflect.ValueOf(resp)
	return val.Kind() == reflect.Ptr && val.IsNil()
}

func (*MetadataInterceptor) WrapStreamingClient(next connect.StreamingClientFunc) connect.StreamingClientFunc {
	return next
}

func (*MetadataInterceptor) WrapStreamingHandler(next connect.StreamingHandlerFunc) connect.StreamingHandlerFunc {
	return next
}

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

func (*LoggingInterceptor) WrapStreamingClient(next connect.StreamingClientFunc) connect.StreamingClientFunc {
	return next // No-op for server-side interceptor
}

func (*LoggingInterceptor) WrapStreamingHandler(next connect.StreamingHandlerFunc) connect.StreamingHandlerFunc {
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

func (*LoggingInterceptor) classifyError(err error) (slog.Level, string) {
	if err == nil {
		return slog.LevelInfo, "OK"
	}

	var connectErr *connect.Error
	if !pkgerrors.As(err, &connectErr) {
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
	default:
		// Server errors
		return slog.LevelError, "server error"
	}
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
				err = connect.NewError(connect.CodeInternal, pkgerrors.New("internal server error"))
			}
		}()
		return next(ctx, req)
	}
}

func (*RecoveryInterceptor) WrapStreamingClient(next connect.StreamingClientFunc) connect.StreamingClientFunc {
	return next
}

func (*RecoveryInterceptor) WrapStreamingHandler(next connect.StreamingHandlerFunc) connect.StreamingHandlerFunc {
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
// It enforces authentication for all endpoints except those listed in PublicMethods.
// Role-based authorization (admin checks) remains in the service layer.
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
		header := req.Header()
		authHeader := header.Get("Authorization")

		result := in.authenticator.Authenticate(ctx, authHeader)

		// Enforce authentication for non-public methods
		if result == nil && !IsPublicMethod(req.Spec().Procedure) {
			return nil, connect.NewError(connect.CodeUnauthenticated, errors.New("authentication required"))
		}

		// Set context based on auth result
		if result != nil {
			if result.Claims != nil {
				// Access Token V2 - stateless, use claims
				ctx = auth.SetUserClaimsInContext(ctx, result.Claims)
				ctx = context.WithValue(ctx, auth.UserIDContextKey, result.Claims.UserID)
			} else if result.User != nil {
				// PAT - have full user
				ctx = auth.SetUserInContext(ctx, result.User, result.AccessToken)
			}
		}

		return next(ctx, req)
	}
}

func (*AuthInterceptor) WrapStreamingClient(next connect.StreamingClientFunc) connect.StreamingClientFunc {
	return next
}

func (*AuthInterceptor) WrapStreamingHandler(next connect.StreamingHandlerFunc) connect.StreamingHandlerFunc {
	return next
}
