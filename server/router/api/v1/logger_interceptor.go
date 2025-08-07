package v1

import (
	"context"
	"fmt"
	"log/slog"

	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

type LoggerInterceptor struct {
	logStacktrace bool
}

func NewLoggerInterceptor(logStacktrace bool) *LoggerInterceptor {
	return &LoggerInterceptor{logStacktrace: logStacktrace}
}

func (in *LoggerInterceptor) LoggerInterceptor(ctx context.Context, request any, serverInfo *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (any, error) {
	resp, err := handler(ctx, request)
	in.loggerInterceptorDo(ctx, serverInfo.FullMethod, err)
	return resp, err
}

func (in *LoggerInterceptor) loggerInterceptorDo(ctx context.Context, fullMethod string, err error) {
	st := status.Convert(err)
	var logLevel slog.Level
	var logMsg string
	switch st.Code() {
	case codes.OK:
		logLevel = slog.LevelInfo
		logMsg = "OK"
	case codes.Unauthenticated, codes.OutOfRange, codes.PermissionDenied, codes.NotFound:
		logLevel = slog.LevelInfo
		logMsg = "client error"
	case codes.Internal, codes.Unknown, codes.DataLoss, codes.Unavailable, codes.DeadlineExceeded:
		logLevel = slog.LevelError
		logMsg = "server error"
	default:
		logLevel = slog.LevelError
		logMsg = "unknown error"
	}
	logAttrs := []slog.Attr{slog.String("method", fullMethod)}
	if err != nil {
		logAttrs = append(logAttrs, slog.String("error", err.Error()))
		if in.logStacktrace {
			logAttrs = append(logAttrs, slog.String("stacktrace", fmt.Sprintf("%v", err)))
		}
	}
	slog.LogAttrs(ctx, logLevel, logMsg, logAttrs...)
}
