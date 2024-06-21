package server

import (
	"context"
	"fmt"
	"log/slog"
	"net"
	"net/http"
	"time"

	"github.com/google/uuid"
	grpc_recovery "github.com/grpc-ecosystem/go-grpc-middleware/recovery"
	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
	"github.com/pkg/errors"
	"github.com/soheilhy/cmux"
	"google.golang.org/grpc"

	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/server/profile"
	apiv1 "github.com/usememos/memos/server/router/api/v1"
	"github.com/usememos/memos/server/router/frontend"
	"github.com/usememos/memos/server/router/rss"
	s3objectpresigner "github.com/usememos/memos/server/service/s3_object_presigner"
	versionchecker "github.com/usememos/memos/server/service/version_checker"
	"github.com/usememos/memos/store"
)

type Server struct {
	Secret  string
	Profile *profile.Profile
	Store   *store.Store

	echoServer *echo.Echo
	grpcServer *grpc.Server
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

	// Serve frontend resources.
	frontend.NewFrontendService(profile, store).Serve(ctx, echoServer)

	rootGroup := echoServer.Group("")

	// Create and register RSS routes.
	rss.NewRSSService(s.Profile, s.Store).RegisterRoutes(rootGroup)

	grpcServer := grpc.NewServer(
		// Override the maximum receiving message size to 100M for uploading large resources.
		grpc.MaxRecvMsgSize(100*1024*1024),
		grpc.ChainUnaryInterceptor(
			apiv1.NewLoggerInterceptor().LoggerInterceptor,
			grpc_recovery.UnaryServerInterceptor(),
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

func (s *Server) Start(ctx context.Context) error {
	address := fmt.Sprintf("%s:%d", s.Profile.Addr, s.Profile.Port)
	listener, err := net.Listen("tcp", address)
	if err != nil {
		return errors.Wrap(err, "failed to listen")
	}

	muxServer := cmux.New(listener)
	go func() {
		grpcListener := muxServer.MatchWithWriters(cmux.HTTP2MatchHeaderFieldSendSettings("content-type", "application/grpc"))
		if err := s.grpcServer.Serve(grpcListener); err != nil {
			slog.Error("failed to serve gRPC", err)
		}
	}()
	go func() {
		httpListener := muxServer.Match(cmux.HTTP1Fast(http.MethodPatch))
		s.echoServer.Listener = httpListener
		if err := s.echoServer.Start(address); err != nil {
			slog.Error("failed to start echo server", err)
		}
	}()
	go func() {
		if err := muxServer.Serve(); err != nil {
			slog.Error("mux server listen error", err)
		}
	}()
	s.StartBackgroundRunners(ctx)

	return nil
}

func (s *Server) Shutdown(ctx context.Context) {
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	// Shutdown echo server.
	if err := s.echoServer.Shutdown(ctx); err != nil {
		fmt.Printf("failed to shutdown server, error: %v\n", err)
	}

	// Close database connection.
	if err := s.Store.Close(); err != nil {
		fmt.Printf("failed to close database, error: %v\n", err)
	}

	fmt.Printf("memos stopped properly\n")
}

func (s *Server) StartBackgroundRunners(ctx context.Context) {
	go versionchecker.NewVersionChecker(s.Store, s.Profile).Start(ctx)
	go s3objectpresigner.NewS3ObjectPresigner(s.Store).Start(ctx)
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
