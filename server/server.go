package server

import (
	"context"
	"fmt"
	"log/slog"
	"net"
	"net/http"
	"runtime"
	"time"

	"github.com/google/uuid"
	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
	"github.com/pkg/errors"

	"github.com/usememos/memos/internal/profile"
	storepb "github.com/usememos/memos/proto/gen/store"
	apiv1 "github.com/usememos/memos/server/router/api/v1"
	"github.com/usememos/memos/server/router/fileserver"
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

	instanceBasicSetting, err := s.getOrUpsertInstanceBasicSetting(ctx)
	if err != nil {
		return nil, errors.Wrap(err, "failed to get instance basic setting")
	}

	secret := "usememos"
	if !profile.Demo {
		secret = instanceBasicSetting.SecretKey
	}
	s.Secret = secret

	// Register healthz endpoint.
	echoServer.GET("/healthz", func(c echo.Context) error {
		return c.String(http.StatusOK, "Service ready.")
	})

	// Serve frontend static files.
	frontend.NewFrontendService(profile, store).Serve(ctx, echoServer)

	rootGroup := echoServer.Group("")

	apiV1Service := apiv1.NewAPIV1Service(s.Secret, profile, store)

	// Register HTTP file server routes BEFORE gRPC-Gateway to ensure proper range request handling for Safari.
	// This uses native HTTP serving (http.ServeContent) instead of gRPC for video/audio files.
	fileServerService := fileserver.NewFileServerService(s.Profile, s.Store, s.Secret)
	fileServerService.RegisterRoutes(echoServer)

	// Create and register RSS routes (needs markdown service from apiV1Service).
	rss.NewRSSService(s.Profile, s.Store, apiV1Service.MarkdownService).RegisterRoutes(rootGroup)
	// Register gRPC gateway as api v1.
	if err := apiV1Service.RegisterGateway(ctx, echoServer); err != nil {
		return nil, errors.Wrap(err, "failed to register gRPC gateway")
	}

	return s, nil
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

	// Start Echo server directly (no cmux needed - all traffic is HTTP).
	s.echoServer.Listener = listener
	go func() {
		if err := s.echoServer.Start(address); err != nil && err != http.ErrServerClosed {
			slog.Error("failed to start echo server", "error", err)
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

func (s *Server) getOrUpsertInstanceBasicSetting(ctx context.Context) (*storepb.InstanceBasicSetting, error) {
	instanceBasicSetting, err := s.Store.GetInstanceBasicSetting(ctx)
	if err != nil {
		return nil, errors.Wrap(err, "failed to get instance basic setting")
	}
	modified := false
	if instanceBasicSetting.SecretKey == "" {
		instanceBasicSetting.SecretKey = uuid.NewString()
		modified = true
	}
	if modified {
		instanceSetting, err := s.Store.UpsertInstanceSetting(ctx, &storepb.InstanceSetting{
			Key:   storepb.InstanceSettingKey_BASIC,
			Value: &storepb.InstanceSetting_BasicSetting{BasicSetting: instanceBasicSetting},
		})
		if err != nil {
			return nil, errors.Wrap(err, "failed to upsert instance setting")
		}
		instanceBasicSetting = instanceSetting.GetBasicSetting()
	}
	return instanceBasicSetting, nil
}
