package server

import (
	"context"
	"fmt"
	"log/slog"
	"math"
	"net"
	"net/http"
	"runtime"
	"runtime/debug"
	"time"

	"github.com/google/uuid"
	grpcrecovery "github.com/grpc-ecosystem/go-grpc-middleware/recovery"
	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
	"github.com/pkg/errors"
	"github.com/soheilhy/cmux"
	"google.golang.org/grpc"

	"github.com/usememos/memos/internal/profile"
	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/server/profiler"
	apiv1 "github.com/usememos/memos/server/router/api/v1"
	"github.com/usememos/memos/server/router/frontend"
	"github.com/usememos/memos/server/router/rss"
	"github.com/usememos/memos/server/runner/s3presign"
	"github.com/usememos/memos/store"
)

type Server struct {
	Secret  string
	Profile *profile.Profile
	Store   *store.Store

	echoServer        *echo.Echo
	grpcServer        *grpc.Server
	profiler          *profiler.Profiler
	runnerCancelFuncs []context.CancelFunc
}

func NewServer(ctx context.Context, profile *profile.Profile, store *store.Store) (*Server, error) {
	s := &Server{
		Store:   store,
		Profile: profile,
	}

	echoServer := echo.New()
	echoServer.Debug = true
	echoServer.HideBanner = true
	echoServer.HidePort = true
	echoServer.Use(middleware.Recover())
	s.echoServer = echoServer

	if profile.Mode != "prod" {
		// Initialize profiler
		s.profiler = profiler.NewProfiler()
		s.profiler.RegisterRoutes(echoServer)
		s.profiler.StartMemoryMonitor(ctx)
	}

	workspaceBasicSetting, err := s.getOrUpsertWorkspaceBasicSetting(ctx)
	if err != nil {
		return nil, errors.Wrap(err, "failed to get workspace basic setting")
	}

	secret := "usememos"
	if profile.Mode == "prod" {
		secret = workspaceBasicSetting.SecretKey
	}
	s.Secret = secret

	// Register healthz endpoint.
	echoServer.GET("/healthz", func(c echo.Context) error {
		return c.String(http.StatusOK, "Service ready.")
	})

	// Serve frontend static files.
	frontend.NewFrontendService(profile, store).Serve(ctx, echoServer)

	rootGroup := echoServer.Group("")

	// Create and register RSS routes.
	rss.NewRSSService(s.Profile, s.Store).RegisterRoutes(rootGroup)

	// Log full stacktraces if we're in dev
	logStacktraces := profile.IsDev()

	grpcServer := grpc.NewServer(
		// Override the maximum receiving message size to math.MaxInt32 for uploading large attachments.
		grpc.MaxRecvMsgSize(math.MaxInt32),
		grpc.ChainUnaryInterceptor(
			apiv1.NewLoggerInterceptor(logStacktraces).LoggerInterceptor,
			newRecoveryInterceptor(logStacktraces),
			apiv1.NewGRPCAuthInterceptor(store, secret).AuthenticationInterceptor,
		))
	s.grpcServer = grpcServer

	apiV1Service := apiv1.NewAPIV1Service(s.Secret, profile, store, grpcServer)
	// Register gRPC gateway as api v1.
	if err := apiV1Service.RegisterGateway(ctx, echoServer); err != nil {
		return nil, errors.Wrap(err, "failed to register gRPC gateway")
	}

	return s, nil
}

func newRecoveryInterceptor(logStacktraces bool) grpc.UnaryServerInterceptor {
	var recoveryOptions []grpcrecovery.Option
	if logStacktraces {
		recoveryOptions = append(recoveryOptions, grpcrecovery.WithRecoveryHandler(func(p any) error {
			if p == nil {
				return nil
			}

			switch val := p.(type) {
			case runtime.Error:
				return &stacktraceError{err: val, stacktrace: debug.Stack()}
			default:
				return nil
			}
		}))
	}

	return grpcrecovery.UnaryServerInterceptor(recoveryOptions...)
}

func (s *Server) Start(ctx context.Context) error {
	var address, network string
	if len(s.Profile.UNIXSock) == 0 {
		address = fmt.Sprintf("%s:%d", s.Profile.Addr, s.Profile.Port)
		network = "tcp"
	} else {
		address = s.Profile.UNIXSock
		network = "unix"
	}
	listener, err := net.Listen(network, address)
	if err != nil {
		return errors.Wrap(err, "failed to listen")
	}

	muxServer := cmux.New(listener)
	go func() {
		grpcListener := muxServer.MatchWithWriters(cmux.HTTP2MatchHeaderFieldSendSettings("content-type", "application/grpc"))
		if err := s.grpcServer.Serve(grpcListener); err != nil {
			slog.Error("failed to serve gRPC", "error", err)
		}
	}()
	go func() {
		httpListener := muxServer.Match(cmux.HTTP1Fast(http.MethodPatch))
		s.echoServer.Listener = httpListener
		if err := s.echoServer.Start(address); err != nil {
			slog.Error("failed to start echo server", "error", err)
		}
	}()
	go func() {
		if err := muxServer.Serve(); err != nil {
			slog.Error("mux server listen error", "error", err)
		}
	}()
	s.StartBackgroundRunners(ctx)

	return nil
}

func (s *Server) Shutdown(ctx context.Context) {
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	slog.Info("server shutting down")

	// Cancel all background runners
	for _, cancelFunc := range s.runnerCancelFuncs {
		if cancelFunc != nil {
			cancelFunc()
		}
	}

	// Shutdown echo server.
	if err := s.echoServer.Shutdown(ctx); err != nil {
		slog.Error("failed to shutdown server", slog.String("error", err.Error()))
	}

	// Shutdown gRPC server.
	s.grpcServer.GracefulStop()

	// Stop the profiler
	if s.profiler != nil {
		slog.Info("stopping profiler")
		// Log final memory stats
		var m runtime.MemStats
		runtime.ReadMemStats(&m)
		slog.Info("final memory stats before exit",
			"heapAlloc", m.Alloc,
			"heapSys", m.Sys,
			"heapObjects", m.HeapObjects,
			"numGoroutine", runtime.NumGoroutine(),
		)
	}

	// Close database connection.
	if err := s.Store.Close(); err != nil {
		slog.Error("failed to close database", slog.String("error", err.Error()))
	}

	slog.Info("memos stopped properly")
}

func (s *Server) StartBackgroundRunners(ctx context.Context) {
	// Create a separate context for each background runner
	// This allows us to control cancellation for each runner independently
	s3Context, s3Cancel := context.WithCancel(ctx)

	// Store the cancel function so we can properly shut down runners
	s.runnerCancelFuncs = append(s.runnerCancelFuncs, s3Cancel)

	// Create and start S3 presign runner
	s3presignRunner := s3presign.NewRunner(s.Store)
	s3presignRunner.RunOnce(ctx)

	// Start continuous S3 presign runner
	go func() {
		s3presignRunner.Run(s3Context)
		slog.Info("s3presign runner stopped")
	}()

	// Log the number of goroutines running
	slog.Info("background runners started", "goroutines", runtime.NumGoroutine())
}

func (s *Server) getOrUpsertWorkspaceBasicSetting(ctx context.Context) (*storepb.WorkspaceBasicSetting, error) {
	workspaceBasicSetting, err := s.Store.GetWorkspaceBasicSetting(ctx)
	if err != nil {
		return nil, errors.Wrap(err, "failed to get workspace basic setting")
	}
	modified := false
	if workspaceBasicSetting.SecretKey == "" {
		workspaceBasicSetting.SecretKey = uuid.NewString()
		modified = true
	}
	if modified {
		workspaceSetting, err := s.Store.UpsertWorkspaceSetting(ctx, &storepb.WorkspaceSetting{
			Key:   storepb.WorkspaceSettingKey_BASIC,
			Value: &storepb.WorkspaceSetting_BasicSetting{BasicSetting: workspaceBasicSetting},
		})
		if err != nil {
			return nil, errors.Wrap(err, "failed to upsert workspace setting")
		}
		workspaceBasicSetting = workspaceSetting.GetBasicSetting()
	}
	return workspaceBasicSetting, nil
}

// stacktraceError wraps an underlying error and captures the stacktrace. It
// implements fmt.Formatter, so it'll be rendered when invoked by something like
// `fmt.Sprint("%v", err)`.
type stacktraceError struct {
	err        error
	stacktrace []byte
}

func (e *stacktraceError) Error() string {
	return e.err.Error()
}

func (e *stacktraceError) Unwrap() error {
	return e.err
}

func (e *stacktraceError) Format(f fmt.State, _ rune) {
	f.Write(e.stacktrace)
}
