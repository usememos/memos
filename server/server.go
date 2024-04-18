package server

import (
	"context"
	"fmt"
	"log/slog"
	"net"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/labstack/echo/v4"
	"github.com/pkg/errors"
	"github.com/soheilhy/cmux"
	"google.golang.org/grpc"

	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/server/profile"
	"github.com/usememos/memos/server/route/api/auth"
	apiv2 "github.com/usememos/memos/server/route/api/v2"
	"github.com/usememos/memos/server/route/frontend"
	"github.com/usememos/memos/server/route/resource"
	"github.com/usememos/memos/server/route/rss"
	versionchecker "github.com/usememos/memos/server/service/version_checker"
	"github.com/usememos/memos/store"
)

type Server struct {
	ID      string
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
	s.echoServer = echoServer

	// Register CORS middleware.
	echoServer.Use(CORSMiddleware(s.Profile.Origins))

	workspaceBasicSetting, err := s.getOrUpsertWorkspaceBasicSetting(ctx)
	if err != nil {
		return nil, errors.Wrap(err, "failed to get workspace basic setting")
	}

	secret := "usememos"
	if profile.Mode == "prod" {
		secret = workspaceBasicSetting.SecretKey
	}
	s.ID = workspaceBasicSetting.ServerId
	s.Secret = secret

	// Register healthz endpoint.
	echoServer.GET("/healthz", func(c echo.Context) error {
		return c.String(http.StatusOK, "Service ready.")
	})

	// Only serve frontend when it's enabled.
	if profile.Frontend {
		frontendService := frontend.NewFrontendService(profile, store)
		frontendService.Serve(ctx, echoServer)
	}

	rootGroup := echoServer.Group("")

	// Register public routes.
	publicGroup := rootGroup.Group("/o")
	publicGroup.Use(func(next echo.HandlerFunc) echo.HandlerFunc {
		return auth.JWTMiddleware(s.Store, next, s.Secret)
	})

	// Create and register resource public routes.
	resource.NewResourceService(s.Profile, s.Store).RegisterRoutes(publicGroup)

	// Create and register RSS routes.
	rss.NewRSSService(s.Profile, s.Store).RegisterRoutes(rootGroup)

	grpcServer := grpc.NewServer(grpc.ChainUnaryInterceptor(
		apiv2.NewLoggerInterceptor().LoggerInterceptor,
		apiv2.NewGRPCAuthInterceptor(store, secret).AuthenticationInterceptor,
	))
	s.grpcServer = grpcServer

	apiV2Service := apiv2.NewAPIV2Service(s.Secret, profile, store, grpcServer)
	// Register gRPC gateway as api v2.
	if err := apiV2Service.RegisterGateway(ctx, echoServer); err != nil {
		return nil, errors.Wrap(err, "failed to register gRPC gateway")
	}

	return s, nil
}

func (s *Server) Start(ctx context.Context) error {
	address := fmt.Sprintf(":%d", s.Profile.Port)
	listener, err := net.Listen("tcp", address)
	if err != nil {
		return errors.Wrap(err, "failed to listen")
	}

	muxServer := cmux.New(listener)
	go func() {
		grpcListener := muxServer.Match(cmux.HTTP2HeaderField("content-type", "application/grpc"))
		if err := s.grpcServer.Serve(grpcListener); err != nil {
			slog.Error("failed to serve gRPC", err)
		}
	}()
	go func() {
		httpListener := muxServer.Match(cmux.HTTP1Fast(), cmux.Any())
		s.echoServer.Listener = httpListener
		if err := s.echoServer.Start(address); err != nil {
			slog.Error("failed to start echo server", err)
		}
	}()

	return muxServer.Serve()
}

func (s *Server) Shutdown(ctx context.Context) {
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	// Shutdown echo server
	if err := s.echoServer.Shutdown(ctx); err != nil {
		fmt.Printf("failed to shutdown server, error: %v\n", err)
	}

	// Close database connection
	if err := s.Store.Close(); err != nil {
		fmt.Printf("failed to close database, error: %v\n", err)
	}

	fmt.Printf("memos stopped properly\n")
}

func (s *Server) StartRunners(ctx context.Context) {
	go versionchecker.NewVersionChecker(s.Store, s.Profile).Start(ctx)
}

func (s *Server) getOrUpsertWorkspaceBasicSetting(ctx context.Context) (*storepb.WorkspaceBasicSetting, error) {
	workspaceBasicSetting, err := s.Store.GetWorkspaceBasicSetting(ctx)
	if err != nil {
		return nil, errors.Wrap(err, "failed to get workspace basic setting")
	}
	modified := false
	if workspaceBasicSetting.ServerId == "" {
		workspaceBasicSetting.ServerId = uuid.NewString()
		modified = true
	}
	if workspaceBasicSetting.SecretKey == "" {
		workspaceBasicSetting.SecretKey = uuid.NewString()
		modified = true
	}
	if modified {
		workspaceSetting, err := s.Store.UpsertWorkspaceSetting(ctx, &storepb.WorkspaceSetting{
			Key:   storepb.WorkspaceSettingKey_WORKSPACE_SETTING_BASIC,
			Value: &storepb.WorkspaceSetting_BasicSetting{BasicSetting: workspaceBasicSetting},
		})
		if err != nil {
			return nil, errors.Wrap(err, "failed to upsert workspace setting")
		}
		workspaceBasicSetting = workspaceSetting.GetBasicSetting()
	}
	return workspaceBasicSetting, nil
}

func grpcRequestSkipper(c echo.Context) bool {
	return strings.HasPrefix(c.Request().URL.Path, "/memos.api.v2.")
}

func CORSMiddleware(origins []string) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			if grpcRequestSkipper(c) {
				return next(c)
			}

			r := c.Request()
			w := c.Response().Writer

			requestOrigin := r.Header.Get("Origin")
			if len(origins) == 0 {
				w.Header().Set("Access-Control-Allow-Origin", requestOrigin)
			} else {
				for _, origin := range origins {
					if origin == requestOrigin {
						w.Header().Set("Access-Control-Allow-Origin", origin)
						break
					}
				}
			}

			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
			w.Header().Set("Access-Control-Allow-Credentials", "true")

			// If it's preflight request, return immediately.
			if r.Method == "OPTIONS" {
				w.WriteHeader(http.StatusOK)
				return nil
			}
			return next(c)
		}
	}
}
